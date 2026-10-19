from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def link_unambiguous_athlete_accounts(apps, schema_editor):
    Athlete = apps.get_model('competitions', 'Athlete')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    db = schema_editor.connection.alias
    # Only link a unique exact first/last-name match among athlete-role accounts.
    # Ambiguous or unmatched profiles stay unlinked for an admin to resolve manually.
    athletes = Athlete.objects.using(db).filter(user__isnull=True)
    users = User.objects.using(db).filter(role='athlete')
    by_name = {}
    for user in users.iterator():
        key = ((user.first_name or '').strip().casefold(), (user.last_name or '').strip().casefold())
        if all(key):
            by_name.setdefault(key, []).append(user.pk)
    used = set(Athlete.objects.using(db).exclude(user__isnull=True).values_list('user_id', flat=True))
    for athlete in athletes.iterator():
        key = ((athlete.first_name or '').strip().casefold(), (athlete.last_name or '').strip().casefold())
        matches = by_name.get(key, [])
        if len(matches) == 1 and matches[0] not in used:
            Athlete.objects.using(db).filter(pk=athlete.pk, user__isnull=True).update(user_id=matches[0])
            used.add(matches[0])


class Migration(migrations.Migration):
    dependencies = [
        ('competitions', '0005_event_auto_status'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField(
            model_name='athlete', name='user',
            field=models.OneToOneField(blank=True, limit_choices_to={'role': 'athlete'}, null=True,
                on_delete=django.db.models.deletion.SET_NULL, related_name='competition_athlete',
                to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(link_unambiguous_athlete_accounts, migrations.RunPython.noop),
    ]
