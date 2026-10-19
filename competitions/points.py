"""Automatic points (TOR: "the final result must be expressed in points").
Every result gets points from the PointsTable formula, then events are ranked by points,
so athletes of different classes can be compared fairly in one event."""
import re
from decimal import Decimal

from .models import PointsTable


def _matches(code, name):
    # whole-word match, so "100m" matches "Men's 100m T54" but not "1100m" or "100m Hurdles" first
    return re.search(r'(?<![0-9a-z])' + re.escape(code.lower()) + r'(?![0-9a-z])', name.lower()) is not None


def find_table(event, classification='', gender=''):
    """The PointsTable row for this event, gender and class (a class-specific row wins over an 'all classes' row)."""
    gender = event.gender if event.gender in ('Men', 'Women') else gender
    if not gender:
        return None
    rows = [r for r in PointsTable.objects.filter(gender=gender) if _matches(r.event, event.name)]
    if not rows:
        return None
    longest = max(len(r.event) for r in rows)           # "100m hurdles" beats "100m"
    rows = [r for r in rows if len(r.event) == longest]
    exact = [r for r in rows if r.classification and r.classification.upper() == (classification or '').upper()]
    general = [r for r in rows if not r.classification]
    return (exact or general or [None])[0]


def has_points_table(event):
    return find_table(event, event.classification) is not None or (event.sport.name == 'Combined')


def calculate_points(entry):
    """Points for one CompetesIn row, or None when there is no formula for it (points stay as typed)."""
    if entry.score is None:
        return None
    event = entry.event
    if event.sport.name == 'Combined':            # decathlon / heptathlon results are already points
        return Decimal(entry.score).quantize(Decimal('1'))
    table = find_table(event, entry.athlete.classification, entry.athlete.gender)
    return None if table is None else Decimal(table.points_for(entry.score))


def update_points(entries):
    """Recalculate and save points for these rows. Returns True when every scored row has points."""
    complete = True
    for e in entries:
        pts = calculate_points(e)
        if pts is not None and pts != e.point:
            e.point = pts
            e.save(update_fields=['point'])
        if e.score is not None and e.point is None:
            complete = False
    return complete
