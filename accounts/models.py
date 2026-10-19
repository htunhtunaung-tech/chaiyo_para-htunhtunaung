from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('judge', 'Judge'),
        ('athlete', 'Athlete'),          
        ('team_official', 'Team Official'), 
        ('visitor', 'Visitor'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='visitor')
    # Judge approval: someone who registers as a judge stays a visitor with judge_status='pending'
    # until an admin approves the request (then role='judge', judge_status='approved').
    JUDGE_STATUS_CHOICES = (('', 'Not a judge request'), ('pending', 'Pending'),
                            ('approved', 'Approved'), ('rejected', 'Rejected'))
    judge_status = models.CharField(max_length=10, choices=JUDGE_STATUS_CHOICES, blank=True, default='')

    def approve_judge(self):
        self.role, self.judge_status = 'judge', 'approved'
        self.save()

    def reject_judge(self):
        self.role, self.judge_status = 'visitor', 'rejected'
        self.save()

    def save(self, *args, **kwargs):
        if self.is_superuser:          # "createsuperuser" accounts are administrators of the website too
            self.role = 'admin'
        if self.role == 'judge' and self.judge_status != 'approved':   # made a judge by an admin in /admin/
            self.judge_status = 'approved'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"