from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Mock function for oauth callback matching existing Flask structure locally?
# Actually api/urls.py handles it as /api/auth/oauth/callback
# But OAuth service expects /oauth/callback at root?
# We configured OAUTH_REDIRECT_URI in oauth_service.py to /oauth/callback
# So we need to expose that at root level or change the env var.

from api.views.auth import oauth_callback
from django.views.generic import TemplateView
from django.urls import re_path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    
    # Root level OAuth callback to match default env var/Flask structure if needed
    path('oauth/callback/', oauth_callback),
    path('oauth/callback', oauth_callback), # No trailing slash

    # Catch-all for React Frontend (excluding static, api, and admin)
    re_path(r'^(?!static/|api/|admin/|oauth/|__debug__).*$', TemplateView.as_view(template_name='index.html')),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
