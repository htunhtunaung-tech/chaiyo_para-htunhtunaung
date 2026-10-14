from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .countries import official_country
from .models import Sport, Athlete, Event, CompetesIn


class SportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sport
        fields = ['id', 'name', 'sub_type', 'rank_order']


class AthleteSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Athlete
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'country', 'gender', 'classification']

    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}"

    def validate_country(self, value):
        # Only real Paralympic delegations; "THA" or "thailand" is saved as "Thailand".
        name = official_country(value)
        if not name:
            raise serializers.ValidationError('Use a country that takes part in the Paralympic Games, e.g. Thailand or THA.')
        return name


class EventSerializer(serializers.ModelSerializer):
    sport_name = serializers.CharField(source='sport.name', read_only=True)
    judge_name = serializers.CharField(source='judge.username', read_only=True, default=None)
    # Read only: the athletes in this event, so the frontend can show start lists and counts.
    participants = serializers.SerializerMethodField()
    sport_sub_type = serializers.CharField(source='sport.sub_type', read_only=True)
    rank_order = serializers.CharField(source='sport.rank_order', read_only=True)

    class Meta:
        model = Event
        fields = ['id', 'name', 'date_time', 'gender', 'status', 'sport',
                  'sport_name', 'sport_sub_type', 'rank_order', 'judge', 'judge_name', 'participants']
        read_only_fields = ['status']     # changes only through PATCH /events/<id>/status/

    def get_participants(self, obj) -> list:
        entries = sorted(obj.competesin_set.all(), key=lambda r: (r.rank is None, r.rank or 0, r.athlete.last_name))
        return ResultSerializer(entries, many=True, context=self.context).data

    def validate_judge(self, user):
        if user is not None and user.role != 'judge':
            raise serializers.ValidationError('This user is not a judge.')
        return user


class ResultSerializer(serializers.ModelSerializer):
    """Read: athlete is nested. Write (PATCH): score, point, rank, medal only."""
    athlete = AthleteSerializer(read_only=True)

    class Meta:
        model = CompetesIn
        fields = ['id', 'event', 'athlete', 'score', 'point', 'rank', 'medal']
        read_only_fields = ['event']

    def validate(self, attrs):
        request = self.context.get('request')
        if 'medal' in attrs and request is not None and request.user.role != 'admin':
            raise PermissionDenied('Only admin can set medals manually.')
        return attrs


class AthleteDetailSerializer(AthleteSerializer):
    """GET /api/athletes/<id>/ also lists the athlete's events and results."""
    events = serializers.SerializerMethodField()

    class Meta(AthleteSerializer.Meta):
        fields = AthleteSerializer.Meta.fields + ['events']

    def get_events(self, obj) -> list:
        rows = obj.competesin_set.select_related('event', 'event__sport').order_by('event__date_time')
        return [{
            'id': r.id,
            'event': {'id': r.event.id, 'name': r.event.name, 'date_time': r.event.date_time,
                      'status': r.event.status, 'sport_name': r.event.sport.name},
            'score': None if r.score is None else str(r.score), 'point': None if r.point is None else str(r.point),
            'rank': r.rank, 'medal': r.medal,
        } for r in rows]


class ParticipantInputSerializer(serializers.Serializer):
    athlete = serializers.PrimaryKeyRelatedField(queryset=Athlete.objects.all())


class StatusInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[c[0] for c in Event.STATUS_CHOICES])