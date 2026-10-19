import mimetypes

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Login/register live at /api/auth/ (the team's agreed list). /api/accounts/ is kept as an alias.
    path('api/auth/', include('accounts.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/', include('competitions.urls')),
    # API documentation for Members 3 and 4
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

# While developing, Django also serves the website, so http://127.0.0.1:8000/ opens it (no Live Server needed).
mimetypes.add_type('text/javascript', '.js')      # Windows may report .js wrongly, which breaks module scripts
FRONTEND_DIR = settings.BASE_DIR / 'chai-yo-para-frontend'
if settings.DEBUG and FRONTEND_DIR.exists():
    urlpatterns += [
        path('', serve, {'document_root': FRONTEND_DIR, 'path': 'index.html'}),
        re_path(r'^(?!api/|admin/)(?P<path>.+)$', serve, {'document_root': FRONTEND_DIR}),
    ]
