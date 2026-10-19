from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (SportViewSet, AthleteViewSet, EventViewSet, PointsTableViewSet,
                    MedalTableView, ResultUpdateView)

router = DefaultRouter()
router.register('sports', SportViewSet, basename='sport')
router.register('athletes', AthleteViewSet, basename='athlete')
router.register('events', EventViewSet, basename='event')
router.register('points-tables', PointsTableViewSet, basename='points-table')

urlpatterns = [
    path('medals/', MedalTableView.as_view(), name='medals'),
    path('results/<int:pk>/', ResultUpdateView.as_view(), name='result-update'),
    path('', include(router.urls)),
]
