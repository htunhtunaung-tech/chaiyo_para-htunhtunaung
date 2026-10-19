from django.db import migrations


def fix_roles(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    # 'sporter' was renamed to 'athlete' in 0003, but existing rows kept the old value.
    User.objects.filter(role='sporter').update(role='athlete')
    # Superusers are always website admins (User.save() does this, but older rows were saved before that rule).
    User.objects.filter(is_superuser=True).exclude(role='admin').update(role='admin')


class Migration(migrations.Migration):
    dependencies = [('accounts', '0003_alter_user_role')]
    operations = [migrations.RunPython(fix_roles, migrations.RunPython.noop)]
