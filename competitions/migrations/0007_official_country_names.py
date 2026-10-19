from django.db import migrations

from competitions.countries import official_country


def use_official_names(apps, schema_editor):
    """Store every athlete's country as the official delegation name ("USA" -> "United States").
    Countries that are not recognised are left as they are, for an admin to fix."""
    Athlete = apps.get_model('competitions', 'Athlete')
    for athlete in Athlete.objects.all().only('id', 'country'):
        name = official_country(athlete.country)
        if name and name != athlete.country:
            Athlete.objects.filter(pk=athlete.pk).update(country=name)


class Migration(migrations.Migration):
    dependencies = [('competitions', '0006_athlete_user_link')]
    operations = [migrations.RunPython(use_official_names, migrations.RunPython.noop)]
