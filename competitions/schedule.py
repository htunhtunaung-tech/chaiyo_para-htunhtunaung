"""Status follows the real clock, like a real competition:
   before the start time  -> start_list
   from the start time    -> live            (needs at least one athlete)
   after start + duration -> result          (medals are worked out from the scores if none are set yet)
Events an admin changed by hand (auto_status = False) are left alone."""
from datetime import timedelta

from django.utils import timezone

# How long an event stays "live" before it counts as finished (minutes), by category.
DURATION_MINUTES = {'Track': 120, 'Field': 180, 'Road': 300, 'Combined': 600}
DEFAULT_DURATION = 180


def duration_of(event):
    return timedelta(minutes=DURATION_MINUTES.get(event.sport.name, DEFAULT_DURATION))


def sync_event_statuses(now=None):
    """Move events forward according to the clock. Cheap: only looks at events not finished yet."""
    from .models import Event
    from .views import run_auto_medals
    now = now or timezone.now()
    changed = 0
    for ev in Event.objects.select_related('sport').filter(auto_status=True, date_time__lte=now).exclude(status='result'):
        has_athletes = ev.competesin_set.exists()
        new = ev.status
        if now >= ev.date_time + duration_of(ev):
            new = 'result'
        elif ev.status == 'start_list' and has_athletes:
            new = 'live'
        if new != ev.status:
            ev.status = new
            ev.save(update_fields=['status'])
            changed += 1
            if new == 'result' and not ev.competesin_set.filter(medal__isnull=False).exists():
                run_auto_medals(ev)
    return changed
