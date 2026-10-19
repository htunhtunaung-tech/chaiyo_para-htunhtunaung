from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class Sport(models.Model):
    """name = category (Track / Field / Road / Combined), sub_type = discipline."""
    name = models.CharField(max_length=100)
    sub_type = models.CharField(max_length=100, blank=True, null=True)
    rank_order = models.CharField(
        max_length=4,
        choices=(('asc', 'Lowest wins'), ('desc', 'Highest wins')),
        default='asc',
    )

    def __str__(self):
        return f"{self.name} - {self.sub_type}" if self.sub_type else self.name


class Athlete(models.Model):
    GENDER_CHOICES = (('Men', 'Men'), ('Women', 'Women'))

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    classification = models.CharField(max_length=50)       # e.g. T54, F46
    # Competition identity is separate from the login account; this optional one-to-one
    # link lets an existing athlete account own a competition profile without changing roles.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='competition_athlete', limit_choices_to={'role': 'athlete'},
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.country})"


class Event(models.Model):
    STATUS_CHOICES = (
        ('start_list', 'Start list'),
        ('live', 'Live'),
        ('result', 'Result'),
    )
    GENDER_CHOICES = (('Men', 'Men'), ('Women', 'Women'), ('Mixed', 'Mixed'))

    name = models.CharField(max_length=150)
    date_time = models.DateTimeField(db_index=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='start_list', db_index=True)
    venue = models.CharField(max_length=150, blank=True)               # e.g. "Main Stadium"
    classification = models.CharField(max_length=50, blank=True)      # e.g. T54, F46
    # True = the clock decides the status (start list -> live at the start time -> finished after the
    # event's duration). An admin who changes the status by hand switches this off for that event.
    auto_status = models.BooleanField(default=True)
    sport = models.ForeignKey(Sport, on_delete=models.PROTECT)
    judge = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                              limit_choices_to={'role': 'judge'})

    class Meta:
        ordering = ['date_time', 'id']

    def __str__(self):
        return self.name


class CompetesIn(models.Model):
    MEDAL_CHOICES = (('gold', 'Gold'), ('silver', 'Silver'), ('bronze', 'Bronze'))

    athlete = models.ForeignKey(Athlete, on_delete=models.PROTECT)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    # time (s), distance/height (m) or total points, depending on the sport
    score = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True,
                                validators=[MinValueValidator(Decimal('0'))])
    point = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True,
                                validators=[MinValueValidator(Decimal('0'))])
    rank = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    medal = models.CharField(max_length=20, choices=MEDAL_CHOICES, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['event', 'athlete'], name='one_entry_per_athlete_per_event'),
            models.CheckConstraint(condition=Q(rank__isnull=True) | Q(rank__gte=1), name='rank_at_least_1'),
        ]

    def __str__(self):
        return f"{self.athlete} in {self.event}"
