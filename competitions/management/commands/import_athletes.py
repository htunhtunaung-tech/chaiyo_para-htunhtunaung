"""Add many athletes at once from a CSV file.

    python manage.py import_athletes athletes_sample.csv

Columns (first row = header): first_name,last_name,country,gender,classification
gender must be Men or Women. Rows already in the database (same name + country) are skipped,
so running it twice is safe. Names in the sample file are fictional."""
import csv

from django.core.management.base import BaseCommand, CommandError

from competitions.models import Athlete

NEEDED = ['first_name', 'last_name', 'country', 'gender', 'classification']
GENDERS = {'men': 'Men', 'm': 'Men', 'male': 'Men', 'women': 'Women', 'w': 'Women', 'f': 'Women', 'female': 'Women'}


class Command(BaseCommand):
    help = 'Import athletes from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **opts):
        try:
            f = open(opts['csv_file'], newline='', encoding='utf-8-sig')
        except OSError as e:
            raise CommandError(f'Cannot open file: {e}')
        with f:
            reader = csv.DictReader(f)
            missing = [c for c in NEEDED if c not in (reader.fieldnames or [])]
            if missing:
                raise CommandError(f'Missing column(s): {", ".join(missing)}')
            added = skipped = 0
            for n, row in enumerate(reader, start=2):
                row = {k: (v or '').strip() for k, v in row.items()}
                gender = GENDERS.get(row['gender'].lower())
                if not (row['first_name'] and row['last_name'] and row['country'] and gender and row['classification']):
                    self.stderr.write(f'Line {n}: skipped (empty field or gender not Men/Women)')
                    skipped += 1
                    continue
                _, created = Athlete.objects.get_or_create(
                    first_name=row['first_name'], last_name=row['last_name'], country=row['country'],
                    defaults={'gender': gender, 'classification': row['classification']})
                added += created
                skipped += not created
        self.stdout.write(self.style.SUCCESS(f'{added} athletes added, {skipped} skipped.'))