from django.db import migrations

# Coefficients from the World Athletics scoring tables for combined events (decathlon / heptathlon).
# They are the standard a, b, c values of the formula; admins can add class-specific rows
# (e.g. T54) in /admin/ or through /api/points-tables/ when official Para values are available.
# (event, gender, measure, a, b, c)
DEFAULT_ROWS = [
    ('100m', 'Men', 's', 25.4347, 18.0, 1.81),
    ('400m', 'Men', 's', 1.53775, 82.0, 1.81),
    ('1500m', 'Men', 's', 0.03768, 480.0, 1.85),
    ('110m hurdles', 'Men', 's', 5.74352, 28.5, 1.92),
    ('High jump', 'Men', 'cm', 0.8465, 75.0, 1.42),
    ('Long jump', 'Men', 'cm', 0.14354, 220.0, 1.40),
    ('Pole vault', 'Men', 'cm', 0.2797, 100.0, 1.35),
    ('Shot put', 'Men', 'm', 51.39, 1.5, 1.05),
    ('Discus throw', 'Men', 'm', 12.91, 4.0, 1.10),
    ('Javelin throw', 'Men', 'm', 10.14, 7.0, 1.08),
    ('100m', 'Women', 's', 17.857, 21.0, 1.81),
    ('200m', 'Women', 's', 4.99087, 42.5, 1.81),
    ('400m', 'Women', 's', 1.34285, 91.7, 1.81),
    ('800m', 'Women', 's', 0.11193, 254.0, 1.88),
    ('1500m', 'Women', 's', 0.02883, 535.0, 1.88),
    ('100m hurdles', 'Women', 's', 9.23076, 26.7, 1.835),
    ('High jump', 'Women', 'cm', 1.84523, 75.0, 1.348),
    ('Long jump', 'Women', 'cm', 0.188807, 210.0, 1.41),
    ('Pole vault', 'Women', 'cm', 0.44125, 100.0, 1.35),
    ('Shot put', 'Women', 'm', 56.0211, 1.5, 1.05),
    ('Discus throw', 'Women', 'm', 12.3311, 3.0, 1.10),
    ('Javelin throw', 'Women', 'm', 15.9803, 3.8, 1.04),
]


def add_rows(apps, schema_editor):
    PointsTable = apps.get_model('competitions', 'PointsTable')
    for event, gender, measure, a, b, c in DEFAULT_ROWS:
        PointsTable.objects.get_or_create(event=event, gender=gender, classification='',
                                          defaults={'measure': measure, 'a': a, 'b': b, 'c': c})


def remove_rows(apps, schema_editor):
    PointsTable = apps.get_model('competitions', 'PointsTable')
    for event, gender, *_ in DEFAULT_ROWS:
        PointsTable.objects.filter(event=event, gender=gender, classification='').delete()


class Migration(migrations.Migration):
    dependencies = [('competitions', '0008_points_table')]
    operations = [migrations.RunPython(add_rows, remove_rows)]
