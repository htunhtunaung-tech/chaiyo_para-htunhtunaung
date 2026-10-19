from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import RegisterAPIView, LoginAPIView, LogoutAPIView, MeAPIView, JudgeListView, JudgeDecisionView, AdminUserViewSet

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='register'),
    path('login/', LoginAPIView.as_view(), name='login'),
    path('logout/', LogoutAPIView.as_view(), name='logout'),
    path('me/', MeAPIView.as_view(), name='me'),
    path('judges/', JudgeListView.as_view(), name='judges'),
    path('judges/<int:pk>/approve/', JudgeDecisionView.as_view(decision='approve'), name='judge-approve'),
    path('judges/<int:pk>/reject/', JudgeDecisionView.as_view(decision='reject'), name='judge-reject'),
]

# /api/auth/users/ and /api/auth/users/<id>/  (admin only)
router = SimpleRouter()
router.register('users', AdminUserViewSet, basename='admin-users')
urlpatterns += router.urls
