from django.contrib import admin
from .models import Sport, Athlete, Event, CompetesIn

admin.site.register(Sport)
admin.site.register(Athlete)
admin.site.register(Event)
admin.site.register(CompetesIn)
