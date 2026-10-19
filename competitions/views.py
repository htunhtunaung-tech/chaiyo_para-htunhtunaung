from django.db import transaction
from django.db.models import Count, F, ProtectedError, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import UpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sport, Athlete, Event, CompetesIn, PointsTable
from .points import calculate_points, update_points
from .schedule import sync_event_statuses
from .permissions import IsAdmin, IsAdminOrReadOnly, IsAdminOrJudge
from .serializers import (SportSerializer, AthleteSerializer, AthleteDetailSerializer, EventSerializer,
                          ResultSerializer, ParticipantInputSerializer, StatusInputSerializer,
                          PointsTableSerializer)

STATUS_FLOW = ['start_list', 'live', 'result']
ALLOWED_BACK_STEPS = {('result', 'live')}          # admin may reopen a published event
RESULT_ORDER = (F('rank').asc(nulls_last=True), 'athlete__last_name', 'athlete__first_name')


class ProtectedDeleteMixin:
    """Return 409 instead of a server error when a row is still used elsewhere."""
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'This item is still used by other records and cannot be deleted.'},
                            status=status.HTTP_409_CONFLICT)


# ---------------- Public ----------------

class MedalTableView(APIView):
    """GET /api/medals/ - medal table by country. Only finished events (status = result) count."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: dict})
    def get(self, request):
        sync_event_statuses()
        rows = (CompetesIn.objects
                .filter(event__status='result', medal__in=['gold', 'silver', 'bronze'])
                .values('athlete__country')
                .annotate(gold=Count('id', filter=Q(medal='gold')),
                          silver=Count('id', filter=Q(medal='silver')),
                          bronze=Count('id', filter=Q(medal='bronze'))))
        data = [{
            'country': r['athlete__country'],
            'gold': r['gold'], 'silver': r['silver'], 'bronze': r['bronze'],
            'total': r['gold'] + r['silver'] + r['bronze'],
        } for r in rows]
        data.sort(key=lambda d: (-d['gold'], -d['silver'], -d['bronze'], d['country']))
        for i, d in enumerate(data, start=1):
            d['position'] = i
        return Response(data)


class SportViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Sport.objects.all().order_by('id')
    serializer_class = SportSerializer
    permission_classes = [IsAdminOrReadOnly]


class PointsTableViewSet(viewsets.ModelViewSet):
    """/api/points-tables/ - the a, b, c coefficients. Everyone can read; only admins can change them."""
    queryset = PointsTable.objects.all()
    serializer_class = PointsTableSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None


class AthleteViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Athlete.objects.all().order_by('last_name', 'first_name')
    serializer_class = AthleteSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'country', 'classification']   # ?search=

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'retrieve':
            sync_event_statuses()
            qs = qs.prefetch_related('competesin_set__event__sport')
        return qs

    def get_serializer_class(self):
        return AthleteDetailSerializer if self.action == 'retrieve' else AthleteSerializer


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        sync_event_statuses()                              # statuses follow the real date and time
        qs = Event.objects.select_related('sport', 'judge')
        p = self.request.query_params
        if p.get('gender'):
            qs = qs.filter(gender__iexact=p['gender'])
        if p.get('date'):                                  # YYYY-MM-DD
            try:
                from datetime import date
                qs = qs.filter(date_time__date=date.fromisoformat(p['date']))
            except ValueError:
                raise ValidationError({'date': 'Use the format YYYY-MM-DD.'})
        if p.get('sport_type'):                            # Track / Field / Road / Combined
            qs = qs.filter(sport__name__iexact=p['sport_type'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        return qs

    @extend_schema(responses=ResultSerializer(many=True))
    @action(detail=True, methods=['get'], url_path='results',
            permission_classes=[AllowAny], authentication_classes=[])
    def results(self, request, pk=None):
        """GET /api/events/<id>/results/ - public."""
        event = self.get_object()
        qs = event.competesin_set.select_related('athlete', 'event__sport').order_by(*RESULT_ORDER)
        return Response(ResultSerializer(qs, many=True, context={'request': request}).data)

    @extend_schema(request=ParticipantInputSerializer, responses=ResultSerializer)
    @action(detail=True, methods=['post'], url_path='participants', permission_classes=[IsAdmin])
    def add_participant(self, request, pk=None):
        """POST /api/events/<id>/participants/  body {"athlete": 5}  (only while status = start_list)."""
        event = self.get_object()
        if event.status != 'start_list':
            return Response({'detail': 'Athletes can only be changed while the event is in the start list.'},
                            status=status.HTTP_409_CONFLICT)
        data = ParticipantInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        athlete = data.validated_data['athlete']
        if event.gender and athlete.gender != event.gender and event.gender != 'Mixed':
            raise ValidationError({'athlete': f'This is a {event.gender} event.'})
        entry, created = CompetesIn.objects.get_or_create(event=event, athlete=athlete)
        return Response(ResultSerializer(entry, context={'request': request}).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    @action(detail=True, methods=['delete'], url_path=r'participants/(?P<athlete_id>\d+)',
            permission_classes=[IsAdmin])
    def remove_participant(self, request, pk=None, athlete_id=None):
        """DELETE /api/events/<id>/participants/<athlete_id>/  (only while status = start_list)."""
        event = self.get_object()
        if event.status != 'start_list':
            return Response({'detail': 'Athletes can only be changed while the event is in the start list.'},
                            status=status.HTTP_409_CONFLICT)
        get_object_or_404(CompetesIn, event=event, athlete_id=athlete_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=StatusInputSerializer, responses=EventSerializer)
    @action(detail=True, methods=['patch'], url_path='status', permission_classes=[IsAdmin])
    def set_status(self, request, pk=None):
        """PATCH /api/events/<id>/status/  body {"status": "live"}  (start_list -> live -> result)."""
        event = self.get_object()
        data = StatusInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        new = data.validated_data['status']
        forward = STATUS_FLOW.index(new) == STATUS_FLOW.index(event.status) + 1
        if not forward and (event.status, new) not in ALLOWED_BACK_STEPS:
            raise ValidationError({'status': f'Cannot go from {event.status} to {new}.'})
        if new == 'live' and not event.competesin_set.exists():
            raise ValidationError({'status': 'Add at least one athlete before starting the event.'})
        event.status = new
        event.auto_status = False                          # a manual change overrides the clock for this event
        event.save(update_fields=['status', 'auto_status'])
        return Response(EventSerializer(event).data)

    @extend_schema(request=None, responses=ResultSerializer(many=True))
    @action(detail=True, methods=['post'], url_path='rank', permission_classes=[IsAdminOrJudge])
    def rank(self, request, pk=None):
        """POST /api/events/<id>/rank/ - recalculate points and ranks (no medals).
        Admin any time after the start; a judge only for their own live event."""
        event = self.get_object()
        if event.status == 'start_list':
            return Response({'detail': 'Start the event before ranking it.'}, status=status.HTTP_409_CONFLICT)
        if request.user.role == 'judge' and (event.judge_id != request.user.id or event.status != 'live'):
            raise PermissionDenied('Judges can only rank their own event while it is live.')
        run_auto_medals(event, set_medals=False)
        qs = event.competesin_set.select_related('athlete', 'event__sport').order_by(*RESULT_ORDER)
        return Response(ResultSerializer(qs, many=True, context={'request': request}).data)

    @extend_schema(request=None, responses=ResultSerializer(many=True))
    @action(detail=True, methods=['post'], url_path='auto-medals', permission_classes=[IsAdmin])
    def auto_medals(self, request, pk=None):
        """POST /api/events/<id>/auto-medals/ - rank by points (or score) and give medals 1/2/3."""
        event = self.get_object()
        if event.status == 'start_list':
            return Response({'detail': 'Start the event before ranking it.'}, status=status.HTTP_409_CONFLICT)
        run_auto_medals(event)
        qs = event.competesin_set.select_related('athlete', 'event__sport').order_by(*RESULT_ORDER)
        return Response(ResultSerializer(qs, many=True, context={'request': request}).data)


@transaction.atomic
def run_auto_medals(event, set_medals=True):
    """Recalculate points, then rank. When every result has points the ranking uses points (highest wins),
    as the TOR asks; otherwise it uses the score with the sport's rank_order (asc = lowest wins).
    Ties share a rank (1,1,3). Entries with no score (DNS/DNF) get no rank and no medal."""
    entries = list(event.competesin_set.select_for_update().select_related('athlete', 'event__sport')
                   .exclude(score__isnull=True))
    by_points = bool(entries) and update_points(entries)
    if by_points:
        key, reverse = (lambda r: r.point), True
    else:
        key, reverse = (lambda r: r.score), (event.sport.rank_order == 'desc')
    entries.sort(key=key, reverse=reverse)
    prev, prev_rank = None, 0
    for i, r in enumerate(entries, start=1):
        rank = prev_rank if key(r) == prev else i
        prev, prev_rank = key(r), rank
        r.rank = rank
        fields = ['rank']
        if set_medals:
            r.medal = {1: 'gold', 2: 'silver', 3: 'bronze'}.get(rank)
            fields.append('medal')
        r.save(update_fields=fields)
    blanks = event.competesin_set.filter(score__isnull=True)
    blanks.update(rank=None, point=None, **({'medal': None} if set_medals else {}))


# ---------------- Admin or judge ----------------

class ResultUpdateView(UpdateAPIView):
    """PATCH /api/results/<id>/ - score, point, rank. Medal = admin only.
    A judge may only edit results of their own event, and only while it is live."""
    queryset = CompetesIn.objects.select_related('athlete', 'event__sport')
    serializer_class = ResultSerializer
    permission_classes = [IsAdminOrJudge]
    http_method_names = ['patch', 'options']

    def perform_update(self, serializer):
        sync_event_statuses()
        serializer.instance.event.refresh_from_db()
        event = serializer.instance.event
        user = self.request.user
        if user.role == 'judge':
            if event.judge_id != user.id:
                raise PermissionDenied('You are not the judge of this event.')
            if event.status != 'live':
                raise PermissionDenied('Judges can only enter results while the event is live.')
        entry = serializer.save()
        # Points come from the formula whenever the event has a points table (typed points are kept otherwise).
        pts = calculate_points(entry)
        if pts is not None and pts != entry.point:
            entry.point = pts
            entry.save(update_fields=['point'])

