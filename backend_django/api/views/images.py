import os
from django.conf import settings
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.views.static import serve
from django.urls import reverse

class StaticProxyView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, filepath):
        # Serve from backend_django/static directory
        static_dir = os.path.join(settings.BASE_DIR, 'static')
        return serve(request, filepath, document_root=static_dir)

class PlayerImageView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, player_name):
        clean_name = player_name.lower().replace("'", "")
        parts = clean_name.split()
        
        # Define base directory: backend_django/static/players
        base_dir = os.path.join(settings.BASE_DIR, 'static', 'players')
        
        candidates = []
        
        # Strategy 1: Subdirectories
        if len(parts) >= 2:
            surname = parts[-1]
            forename = parts[0]
            candidates.append(f"{surname}-{forename}/head.png")
            candidates.append(f"{forename}-{surname}/head.png")

        # Strategy 2: Flat file
        slugified = clean_name.replace(' ', '-')
        candidates.append(f"{slugified}.png")
        
        found_path = None
        
        for rel_path in candidates:
            full_path = os.path.join(base_dir, rel_path)
            if os.path.exists(full_path):
                found_path = f"players/{rel_path}"
                break
        
        if found_path:
            # Return URL to StaticProxyView
            # We construct the URL manually or use reverse if properly registered
            # Assuming route name 'static-proxy' taking 'filepath'
            proxy_url = request.build_absolute_uri(reverse('static-proxy', kwargs={'filepath': found_path}))
            return JsonResponse({'success': True, 'image_url': proxy_url})
        
        # Fallback
        fallback_path = "pitch-assets/player-silhouette.png"
        fallback_url = request.build_absolute_uri(reverse('static-proxy', kwargs={'filepath': fallback_path}))
        return JsonResponse({'success': True, 'image_url': fallback_url})
