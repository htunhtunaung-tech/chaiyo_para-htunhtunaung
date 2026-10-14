from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('judge', 'Judge'),
        ('sporter', 'Sporter'),
        ('agent', 'Agent'),
        ('visitor', 'Visitor'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='visitor')

    def save(self, *args, **kwargs):
        # "python manage.py createsuperuser" does not ask for a role; a superuser is an admin.
        if self.is_superuser and self.role == 'visitor':
            self.role = 'admin'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"