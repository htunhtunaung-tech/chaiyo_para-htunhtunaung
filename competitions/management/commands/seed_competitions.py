from datetime import datetime, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from competitions.models import Sport, Athlete, Event, CompetesIn

# (category, discipline, rank_order)  asc = lowest wins (time), desc = highest wins (distance/height/points)
SPORTS = [
    ('Track', 'Sprinting (วิ่งระยะสั้น)', 'asc'),
    ('Track', 'Hurdling (วิ่งข้ามรั้ว)', 'asc'),
    ('Track', 'Long-distance running (วิ่งระยะไกล)', 'asc'),
    ('Field', 'High jump (กระโดดสูง)', 'desc'),
    ('Field', 'Long jump (กระโดดไกล)', 'desc'),
    ('Field', 'Discus throw (ขว้างจักร)', 'desc'),
    ('Road', 'Marathon (วิ่งมาราธอน)', 'asc'),
    ('Road', 'Road race (วิ่งแข่งบนถนน)', 'asc'),
    ('Combined', 'Decathlon (ทศกรีฑา)', 'desc'),
    ('Combined', 'Heptathlon (สัตตกรีฑา)', 'desc'),
]

# first, last, country, gender, classification   (fictional names)
ATHLETES = [
    ('Somchai', 'Rattana', 'Thailand', 'Men', 'T54'),
    ('Arun', 'Wongsa', 'Thailand', 'Men', 'T54'),
    ('Kenji', 'Aoki', 'Japan', 'Men', 'T54'),
    ('Daniel', 'Brooks', 'USA', 'Men', 'T54'),
    ('Lucas', 'Ferreira', 'Brazil', 'Men', 'T11'),
    ('Mali', 'Suksan', 'Thailand', 'Women', 'T54'),
    ('Yuki', 'Tanaka', 'Japan', 'Women', 'T54'),
    ('Emma', 'Clarke', 'Great Britain', 'Women', 'T54'),
    ('Li', 'Wei', 'China', 'Women', 'F46'),
    ('Mei', 'Zhang', 'China', 'Women', 'F46'),
    ('Sarah', 'Nguyen', 'Australia', 'Women', 'F46'),
    ('Jonas', 'Keller', 'Germany', 'Men', 'F46'),
    ('Pedro', 'Alves', 'Brazil', 'Men', 'F46'),
    ('Tom', 'Hughes', 'Great Britain', 'Men', 'F46'),
]

D = lambda d, h: datetime(2026, 10, d, h, 0, tzinfo=timezone.utc)

# name, date, gender, discipline keyword, status, [(athlete last name, score)]
EVENTS = [
    ("Men's 100m T54", D(11, 9), 'Men', 'Sprinting', 'result',
     [('Rattana', '14.20'), ('Aoki', '14.35'), ('Brooks', '14.35'), ('Wongsa', '14.90')]),
    ("Women's 400m T54", D(11, 11), 'Women', 'Sprinting', 'result',
     [('Suksan', '55.10'), ('Tanaka', '56.40'), ('Clarke', '57.00')]),
    ("Men's 1500m T54", D(12, 9), 'Men', 'Long-distance', 'live',
     [('Rattana', None), ('Aoki', None), ('Brooks', None)]),
    ("Women's High Jump F46", D(12, 14), 'Women', 'High jump', 'result',
     [('Wei', '1.62'), ('Zhang', '1.58'), ('Nguyen', '1.55')]),
    ("Men's Long Jump F46", D(13, 10), 'Men', 'Long jump', 'start_list',
     [('Keller', None), ('Alves', None), ('Hughes', None)]),
    ("Men's Discus Throw F46", D(13, 15), 'Men', 'Discus', 'start_list',
     [('Keller', None), ('Alves', None), ('Hughes', None)]),
    ("Men's Marathon T54", D(14, 6), 'Men', 'Marathon', 'start_list',
     [('Rattana', None), ('Wongsa', None), ('Aoki', None), ('Brooks', None)]),
]


class Command(BaseCommand):
    help = 'Create demo users, sports, athletes, events and results (safe to run more than once).'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Allow running when DEBUG is off.')

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError('Demo data is for development only (these users have a known password). Use --force to override.')
        User = get_user_model()
        for username, role in [('admin1', 'admin'), ('judge1', 'judge'), ('sporter1', 'sporter')]:
            if not User.objects.filter(username=username).exists():
                User.objects.create_user(username=username, password='test1234', role=role,
                                         is_staff=(role == 'admin'),
                                         is_superuser=(role == 'admin'))

        sports = {}
        for cat, sub, order in SPORTS:
            s, _ = Sport.objects.get_or_create(name=cat, sub_type=sub, defaults={'rank_order': order})
            sports[sub] = s

        athletes = {}
        for f, l, c, g, cl in ATHLETES:
            a, _ = Athlete.objects.get_or_create(first_name=f, last_name=l,
                                                 defaults={'country': c, 'gender': g, 'classification': cl})
            athletes[l] = a

        judge = User.objects.get(username='judge1')
        for name, when, gender, key, status, entries in EVENTS:
            sport = next(s for sub, s in sports.items() if key in sub)
            ev, created = Event.objects.get_or_create(
                name=name, defaults={'date_time': when, 'gender': gender, 'status': status,
                                     'sport': sport, 'judge': judge})
            if not created:
                continue
            for last, score in entries:
                CompetesIn.objects.create(event=ev, athlete=athletes[last],
                                          score=Decimal(score) if score else None)
            if status == 'result':   # give finished events ranks + medals
                from competitions.views import run_auto_medals
                run_auto_medals(ev)

        self.stdout.write(self.style.SUCCESS(
            'Seed done. Logins: admin1 / judge1 / sporter1  (password: test1234)'))
