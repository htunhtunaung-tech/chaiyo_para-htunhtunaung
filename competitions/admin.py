from django.contrib import admin
from .models import Sport, Athlete, Event, CompetesIn, PointsTable

admin.site.register(Sport)
admin.site.register(Athlete)
admin.site.register(Event)
admin.site.register(CompetesIn)


@admin.register(PointsTable)
class PointsTableAdmin(admin.ModelAdmin):
    list_display = ['event', 'gender', 'classification', 'measure', 'a', 'b', 'c']
    list_filter = ['gender', 'measure']
    list_editable = ['a', 'b', 'c']
