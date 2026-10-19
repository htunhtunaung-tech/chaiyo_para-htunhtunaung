from datetime import datetime, timedelta, timezone
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

# Dates are relative to the day you run the seed, so the demo always has finished, live and upcoming events:
# "day 13" = today, 11/12 = earlier, 14 = tomorrow. Status then follows the real clock (see schedule.py).
_TODAY = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
D = lambda d, h: _TODAY + timedelta(days=d - 13, hours=h)

# name, date, gender, discipline keyword, class, venue, status, [(athlete last name, score)]
# score: seconds for Track/Road, metres for Field, total points for Combined
EVENTS = [
    ("Men's 100m T54", D(11, 9), 'Men', 'Sprinting', 'T54', 'Main Stadium', 'result',
     [('Rattana', '14.20'), ('Aoki', '14.35'), ('Brooks', '14.35'), ('Wongsa', '14.90')]),
    ("Women's 400m T54", D(11, 11), 'Women', 'Sprinting', 'T54', 'Main Stadium', 'result',
     [('Suksan', '55.10'), ('Tanaka', '56.40'), ('Clarke', '57.00')]),
    ("Men's 1500m T54", datetime.now(timezone.utc) - timedelta(minutes=30),   # always live when you seed (demo for judges)
     'Men', 'Long-distance', 'T54', 'Main Stadium', 'live',
     [('Rattana', None), ('Aoki', None), ('Brooks', None)]),
    ("Women's High Jump F46", D(12, 14), 'Women', 'High jump', 'F46', 'Field Arena', 'result',
     [('Wei', '1.62'), ('Zhang', '1.58'), ('Nguyen', '1.55')]),
    ("Men's Long Jump F46", D(13, 10), 'Men', 'Long jump', 'F46', 'Field Arena', 'start_list',
     [('Keller', None), ('Alves', None), ('Hughes', None)]),
    ("Men's Discus Throw F46", D(13, 15), 'Men', 'Discus', 'F46', 'Field Arena', 'start_list',
     [('Keller', None), ('Alves', None), ('Hughes', None)]),
    ("Men's Marathon T54", D(14, 6), 'Men', 'Marathon', 'T54', 'City Road Course', 'start_list',
     [('Rattana', None), ('Wongsa', None), ('Aoki', None), ('Brooks', None)]),
    ("Men's Road Race T54", D(14, 8), 'Men', 'Road race', 'T54', 'City Road Course', 'start_list',
     [('Rattana', None), ('Aoki', None), ('Brooks', None)]),
    ("Men's Decathlon F46", D(13, 8), 'Men', 'Decathlon', 'F46', 'Main Stadium', 'result',
     [('Keller', '7421'), ('Alves', '7110'), ('Hughes', '6980')]),
    ("Women's Heptathlon F46", D(14, 9), 'Women', 'Heptathlon', 'F46', 'Main Stadium', 'start_list',
     [('Wei', None), ('Zhang', None), ('Nguyen', None)]),
]


class Command(BaseCommand):
    help = 'Create demo users, sports, athletes, events and results (safe to run more than once).'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Allow running when DEBUG is off.')

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError('Demo data is for development only (these users have a known password). Use --force to override.')
        User = get_user_model()
        for username, role in [('admin1', 'admin'), ('judge1', 'judge'), ('sporter1', 'athlete')]:
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
        for name, when, gender, key, cls, venue, status, entries in EVENTS:
            sport = next(s for sub, s in sports.items() if key in sub)
            ev, created = Event.objects.get_or_create(
                name=name, defaults={'date_time': when, 'gender': gender, 'status': 'start_list', 'sport': sport,
                                     'judge': judge, 'venue': venue, 'classification': cls})
            if not created:
                if not ev.venue:                       # events seeded before venues existed
                    ev.venue, ev.classification = venue, cls
                    ev.save(update_fields=['venue', 'classification'])
                continue
            for last, score in entries:
                CompetesIn.objects.create(event=ev, athlete=athletes[last],
                                          score=Decimal(score) if score else None)

        # The status listed above is only a hint: the real clock decides (finished / live / upcoming),
        # and finished events get their ranks and medals from the scores.
        from competitions.schedule import sync_event_statuses
        sync_event_statuses()

        self.stdout.write(self.style.SUCCESS(
            'Seed done. Logins: admin1 / judge1 / sporter1  (password: test1234)'))
