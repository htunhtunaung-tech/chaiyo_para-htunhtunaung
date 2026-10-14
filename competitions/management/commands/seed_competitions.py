import random
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
# 30 real Paralympic delegations, one man and one woman each. Country names match
# competitions/countries.py, so the website shows the right flag.
ATHLETES = [
    ('Somchai', 'Rattana', 'Thailand', 'Men', 'T54'), ('Mali', 'Suksan', 'Thailand', 'Women', 'T54'),
    ('Haoran', 'Li', 'China', 'Men', 'T11'), ('Mei', 'Zhang', 'China', 'Women', 'F46'),
    ('Lucas', 'Ferreira', 'Brazil', 'Men', 'T11'), ('Camila', 'Souza', 'Brazil', 'Women', 'T47'),
    ('Daniel', 'Brooks', 'United States', 'Men', 'T54'), ('Ashley', 'Carter', 'United States', 'Women', 'T54'),
    ('Tom', 'Hughes', 'Great Britain', 'Men', 'F46'), ('Emma', 'Clarke', 'Great Britain', 'Women', 'T54'),
    ('Daan', 'de Vries', 'Netherlands', 'Men', 'T64'), ('Fleur', 'Visser', 'Netherlands', 'Women', 'T64'),
    ('Luca', 'Bianchi', 'Italy', 'Men', 'T64'), ('Giulia', 'Romano', 'Italy', 'Women', 'T47'),
    ('Andriy', 'Kovalenko', 'Ukraine', 'Men', 'T11'), ('Olena', 'Shevchuk', 'Ukraine', 'Women', 'T11'),
    ('Jack', 'Thornton', 'Australia', 'Men', 'T54'), ('Sarah', 'Nguyen', 'Australia', 'Women', 'F46'),
    ('Kenji', 'Aoki', 'Japan', 'Men', 'T54'), ('Yuki', 'Tanaka', 'Japan', 'Women', 'T54'),
    ('Arjun', 'Sharma', 'India', 'Men', 'F46'), ('Priya', 'Nair', 'India', 'Women', 'F46'),
    ('Yacine', 'Benali', 'Algeria', 'Men', 'T11'), ('Amina', 'Haddad', 'Algeria', 'Women', 'T11'),
    ('Brian', 'Otieno', 'Kenya', 'Men', 'T11'), ('Faith', 'Wanjiru', 'Kenya', 'Women', 'T11'),
    ('Jonas', 'Keller', 'Germany', 'Men', 'F46'), ('Lena', 'Fischer', 'Germany', 'Women', 'T64'),
    ('Hugo', 'Moreau', 'France', 'Men', 'T64'), ('Chloe', 'Dubois', 'France', 'Women', 'T47'),
    ('Piotr', 'Nowak', 'Poland', 'Men', 'F46'), ('Anna', 'Kowalska', 'Poland', 'Women', 'F46'),
    ('Walid', 'Trabelsi', 'Tunisia', 'Men', 'T11'), ('Rania', 'Gharbi', 'Tunisia', 'Women', 'T47'),
    ('Youssef', 'Alaoui', 'Morocco', 'Men', 'T11'), ('Salma', 'Bennani', 'Morocco', 'Women', 'T11'),
    ('Diego', 'Hernandez', 'Mexico', 'Men', 'T54'), ('Valeria', 'Lopez', 'Mexico', 'Women', 'F46'),
    ('Liam', 'Tremblay', 'Canada', 'Men', 'T54'), ('Olivia', 'Gagnon', 'Canada', 'Women', 'T54'),
    ('Minjun', 'Kim', 'Republic of Korea', 'Men', 'T54'), ('Seoyeon', 'Park', 'Republic of Korea', 'Women', 'T54'),
    ('Mateo', 'Gomez', 'Colombia', 'Men', 'T47'), ('Isabella', 'Rojas', 'Colombia', 'Women', 'T47'),
    ('Pablo', 'Martin', 'Spain', 'Men', 'T64'), ('Lucia', 'Garcia', 'Spain', 'Women', 'T64'),
    ('Emeka', 'Okafor', 'Nigeria', 'Men', 'F46'), ('Ngozi', 'Adeyemi', 'Nigeria', 'Women', 'F46'),
    ('Hafiz', 'Rahim', 'Malaysia', 'Men', 'T54'), ('Siti', 'Zainal', 'Malaysia', 'Women', 'T54'),
    ('Dimas', 'Pratama', 'Indonesia', 'Men', 'T47'), ('Putri', 'Lestari', 'Indonesia', 'Women', 'T47'),
    ('Zaw', 'Min Htet', 'Myanmar', 'Men', 'T54'), ('Thandar', 'Aye', 'Myanmar', 'Women', 'T11'),
    ('Minh', 'Tran', 'Vietnam', 'Men', 'F46'), ('Thu', 'Pham', 'Vietnam', 'Women', 'F46'),
    ('Jerome', 'Dela Cruz', 'Philippines', 'Men', 'T47'), ('Angelica', 'Reyes', 'Philippines', 'Women', 'T64'),
    ('Reza', 'Ahmadi', 'Iran', 'Men', 'F46'), ('Zahra', 'Karimi', 'Iran', 'Women', 'F46'),
]

D = lambda d, h: datetime(2026, 10, d, h, 0, tzinfo=timezone.utc)

# name, date, gender, discipline keyword, status, (lowest score, highest score)
# Eight athletes of the right gender are picked for each event; finished events get scores.
EVENT_PLAN = [
    ("Men's 100m T54", D(11, 9), 'Men', 'Sprinting', 'result', (13.9, 15.2)),
    ("Women's 100m T54", D(11, 10), 'Women', 'Sprinting', 'result', (15.6, 17.4)),
    ("Men's Long Jump T64", D(11, 15), 'Men', 'Long jump', 'result', (6.4, 7.9)),
    ("Women's High Jump T47", D(12, 9), 'Women', 'High jump', 'result', (1.42, 1.66)),
    ("Men's 1500m T11", D(12, 10), 'Men', 'Long-distance', 'result', (238.0, 262.0)),
    ("Women's Discus Throw F46", D(12, 15), 'Women', 'Discus', 'result', (28.0, 41.0)),
    ("Men's 400m Hurdles T47", D(13, 9), 'Men', 'Hurdling', 'result', (50.2, 56.9)),
    ("Women's Long Jump T64", D(13, 10), 'Women', 'Long jump', 'result', (4.9, 6.1)),
    ("Men's Discus Throw F46", D(13, 15), 'Men', 'Discus', 'result', (40.0, 52.0)),
    ("Women's 1500m T11", D(14, 9), 'Women', 'Long-distance', 'result', (268.0, 300.0)),
    ("Men's Marathon T54", D(14, 6), 'Men', 'Marathon', 'result', (5100.0, 5600.0)),
    ("Women's 400m T54", D(15, 9), 'Women', 'Sprinting', 'live', None),
    ("Men's High Jump T64", D(15, 14), 'Men', 'High jump', 'live', None),
    ("Women's Marathon T54", D(16, 6), 'Women', 'Marathon', 'start_list', None),
    ("Men's 5000m T11", D(16, 9), 'Men', 'Long-distance', 'start_list', None),
    ("Women's Road Race T54", D(16, 10), 'Women', 'Road race', 'start_list', None),
]


def build_events():
    """Turn EVENT_PLAN into (name, date, gender, keyword, status, [(last name, score)])."""
    rng = random.Random(2026)            # same demo data every time
    events = []
    for name, when, gender, key, status, span in EVENT_PLAN:
        pool = [a[1] for a in ATHLETES if a[3] == gender]
        picked = rng.sample(pool, 8)
        entries = [(last, f'{rng.uniform(*span):.2f}' if span else None) for last in picked]
        events.append((name, when, gender, key, status, entries))
    return events


EVENTS = build_events()


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