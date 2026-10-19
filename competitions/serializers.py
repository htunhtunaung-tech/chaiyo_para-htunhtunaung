from decimal import Decimal, InvalidOperation

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from django.contrib.auth import get_user_model

from .models import Sport, Athlete, Event, CompetesIn

User = get_user_model()


# ---------- time / distance helpers ----------

def parse_score(text):
    """Accept '14.20', '3:58.10' (m:ss.xx) or '1:25:30' (h:mm:ss). Returns Decimal seconds (or metres/points)."""
    parts = str(text).strip().replace(',', '.').split(':')
    if not 1 <= len(parts) <= 3:
        raise ValueError
    total = Decimal(0)
    for part in parts:
        total = total * 60 + Decimal(part)
    return total.quantize(Decimal('0.01'))


def display_score(value, category):
    """How a score is shown: times as m:ss.xx or h:mm:ss, distances/heights with 2 decimals."""
    if value is None:
        return ''
    value = Decimal(value)
    if category in ('Track', 'Road'):
        if value >= 3600:
            whole = int(value)
            return f"{whole // 3600}:{whole % 3600 // 60:02d}:{whole % 60:02d}"
        if value >= 60:
            return f"{int(value // 60)}:{value % 60:05.2f}"
        return f"{value:.2f}"
    if category == 'Combined':
        return f"{value:.0f}"
    return f"{value:.2f}"


class ScoreField(serializers.DecimalField):
    """Decimal that also accepts '' (= empty) and time strings such as 3:58.10."""
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip()
            if data == '':
                return None
            if ':' in data or ',' in data:
                try:
                    data = parse_score(data)
                except (ValueError, InvalidOperation):
                    self.fail('invalid')
        return super().to_internal_value(data)

    def run_validation(self, data=serializers.empty):
        if isinstance(data, str) and data.strip() == '':
            data = None
        return super().run_validation(data)


class BlankableInt(serializers.IntegerField):
    def run_validation(self, data=serializers.empty):
        if isinstance(data, str) and data.strip() == '':
            data = None
        return super().run_validation(data)


# ---------- serializers ----------

class SportSerializer(serializers.ModelSerializer):
    sport_type = serializers.SerializerMethodField()

    class Meta:
        model = Sport
        fields = ['id', 'name', 'sub_type', 'rank_order', 'sport_type']

    def get_sport_type(self, obj) -> str:
        return (obj.name or '').lower()


class AthleteSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='athlete'), required=False, allow_null=True)
    user_username = serializers.CharField(source='user.username', read_only=True, default=None)
    user_email = serializers.EmailField(source='user.email', read_only=True, default=None)

    class Meta:
        model = Athlete
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'country', 'gender', 'classification', 'user', 'user_username', 'user_email']

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}"


class EventSerializer(serializers.ModelSerializer):
    sport_name = serializers.CharField(source='sport.name', read_only=True)
    sport_sub_type = serializers.CharField(source='sport.sub_type', read_only=True)
    sport_type = serializers.SerializerMethodField()
    rank_order = serializers.CharField(source='sport.rank_order', read_only=True)
    judge_name = serializers.CharField(source='judge.username', read_only=True, default='')

    class Meta:
        model = Event
        fields = ['id', 'name', 'date_time', 'gender', 'status', 'venue', 'classification',
                  'sport', 'sport_name', 'sport_sub_type', 'sport_type', 'rank_order',
                  'judge', 'judge_name', 'auto_status']
        read_only_fields = ['status']     # changes only through PATCH /events/<id>/status/

    def get_sport_type(self, obj) -> str:
        return (obj.sport.name or '').lower()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Writing uses the sport id; reading also gives the details the website needs.
        sport = instance.sport
        data['sport'] = {'id': sport.id, 'name': sport.sub_type or sport.name,
                         'category': sport.name, 'sport_type': (sport.name or '').lower(),
                         'rank_order': sport.rank_order}
        return data

    def validate_judge(self, user):
        if user is not None and user.role != 'judge':
            raise serializers.ValidationError('This user is not a judge.')
        return user


class ResultSerializer(serializers.ModelSerializer):
    """Read: athlete is nested. Write (PATCH): score, point, rank, medal only."""
    athlete = AthleteSerializer(read_only=True)
    score = ScoreField(max_digits=8, decimal_places=2, required=False, allow_null=True, min_value=0)
    point = ScoreField(max_digits=8, decimal_places=2, required=False, allow_null=True, min_value=0)
    rank = BlankableInt(required=False, allow_null=True, min_value=1)
    medal = serializers.ChoiceField(choices=CompetesIn.MEDAL_CHOICES, required=False, allow_null=True,
                                    allow_blank=True)
    score_display = serializers.SerializerMethodField()

    class Meta:
        model = CompetesIn
        fields = ['id', 'event', 'athlete', 'score', 'score_display', 'point', 'rank', 'medal']
        read_only_fields = ['event']

    def get_score_display(self, obj) -> str:
        return display_score(obj.score, obj.event.sport.name)

    def validate(self, attrs):
        request = self.context.get('request')
        if 'medal' in attrs:
            attrs['medal'] = attrs['medal'] or None
            # The website sends the unchanged medal with every save, so only a real change needs admin rights.
            changed = self.instance is None or attrs['medal'] != (self.instance.medal or None)
            if changed and request is not None and request.user.role != 'admin':
                raise PermissionDenied('Only admin can set medals manually.')
        return attrs


class AthleteDetailSerializer(AthleteSerializer):
    """One athlete with the events he or she entered (athlete page)."""
    sport = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    class Meta(AthleteSerializer.Meta):
        fields = AthleteSerializer.Meta.fields + ['sport', 'events']

    def _entries(self, obj):
        return [c for c in obj.competesin_set.all()]

    def get_sport(self, obj) -> str:
        entries = self._entries(obj)
        return entries[0].event.sport.name if entries else ''

    def get_events(self, obj) -> list:
        rows = sorted(self._entries(obj), key=lambda c: c.event.date_time)
        return [{
            'id': c.id,
            'event': {'id': c.event.id, 'name': c.event.name, 'date_time': c.event.date_time,
                      'status': c.event.status},
            'score': c.score, 'score_display': display_score(c.score, c.event.sport.name),
            'point': c.point, 'rank': c.rank,
            # a medal only counts once the event is published
            'medal': c.medal if c.event.status == 'result' else None,
        } for c in rows]


class ParticipantInputSerializer(serializers.Serializer):
    athlete = serializers.PrimaryKeyRelatedField(queryset=Athlete.objects.all(), required=False)
    athlete_id = serializers.PrimaryKeyRelatedField(queryset=Athlete.objects.all(), required=False)

    def validate(self, attrs):
        athlete = attrs.get('athlete') or attrs.get('athlete_id')
        if athlete is None:
            raise serializers.ValidationError({'athlete': 'This field is required.'})
        return {'athlete': athlete}


class StatusInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[c[0] for c in Event.STATUS_CHOICES])

    def to_internal_value(self, data):
        data = dict(data)
        if isinstance(data.get('status'), str):
            data['status'] = data['status'].replace('-', '_')      # the website says start-list
        return super().to_internal_value(data)
