"""python manage.py recalculate_points  - fill in points for results saved before automatic points existed.
Only the points change; ranks and medals stay as they are (re-rank an event on the website if needed)."""
from django.core.management.base import BaseCommand

from competitions.models import CompetesIn
from competitions.points import calculate_points


class Command(BaseCommand):
    help = 'Recalculate points for every result that has a score and a matching points table.'

    def handle(self, *args, **options):
        changed = 0
        for entry in CompetesIn.objects.select_related('athlete', 'event__sport').exclude(score__isnull=True):
            pts = calculate_points(entry)
            if pts is not None and pts != entry.point:
                entry.point = pts
                entry.save(update_fields=['point'])
                changed += 1
        self.stdout.write(self.style.SUCCESS(f'{changed} results updated with points.'))
