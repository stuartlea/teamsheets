from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import login, logout, authenticate
from django.shortcuts import redirect
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.decorators import method_decorator
from core.services.oauth_service import OAuthService
from core.services.sheets_service import SheetsService
from core.services.sheets_service import SheetsService
import json
import os

@method_decorator(ensure_csrf_cookie, name='dispatch')
class AuthStatusView(APIView):
    permission_classes = [AllowAny] # Allow checking status even if not logged in (to decide to show login btn)

    def get(self, request):
        oauth_service = OAuthService()
        sheets_authenticated = oauth_service.is_authenticated()
        
        return Response({
            'authenticated': request.user.is_authenticated,
            'user': {
                'username': request.user.username,
                'is_staff': request.user.is_staff
            } if request.user.is_authenticated else None,
            'has_credentials': sheets_authenticated
        })

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        
        if user:
            login(request, user)
            return Response({'success': True, 'user': {'username': user.username}})
        else:
            return Response({'success': False, 'error': 'Invalid credentials'}, status=401)

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'success': True})

# OAuth Views
@api_view(['GET'])
@permission_classes([IsAuthenticated]) # Must be admin/user to trigger OAuth?
def auth_login_oauth(request):
    """Start OAuth authentication flow"""
    oauth_service = OAuthService()
    flow = oauth_service.get_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    request.session['oauth_state'] = state
    return redirect(authorization_url)

@api_view(['GET'])
@permission_classes([AllowAny]) # Callback comes from Google
def oauth_callback(request):
    """OAuth callback handler"""
    print("DEBUG: oauth_callback hit")
    oauth_service = OAuthService()
    try:
        flow = oauth_service.get_flow()
        # Build the full authorization response URL including query params
        authorization_response = request.build_absolute_uri()
        print(f"DEBUG: auth_response_uri: {authorization_response}")
        
        # Django's dev server might use http but google expects https or exact match.
        # Flow fetch_token handles it if configured.
        
        flow.fetch_token(authorization_response=authorization_response)
        print("DEBUG: fetch_token success")
        
        # Store credentials
        credentials = flow.credentials
        print(f"DEBUG: credentials obtained. Refresh token present? {bool(credentials.refresh_token)}")
        oauth_service.save_credentials(credentials)
        print(f"DEBUG: credentials saved to {oauth_service.token_file}. Exists? {os.path.exists(oauth_service.token_file)}")
        
        # Reinitialize sheets service with new credentials
        # (Not strictly needed as service is instantiated per request usually)
        
        # Redirect back to Frontend
        # We need to send them back to the Admin Settings page on the frontend port (5173)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173/admin')
        return redirect(frontend_url) 
    except Exception as e:
        print(f"DEBUG: oauth_callback ERROR: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout_oauth(request):
    """Revoke authentication"""
    oauth_service = OAuthService()
    oauth_service.revoke_credentials()
    return Response({'success': True})

@method_decorator(ensure_csrf_cookie, name='dispatch')
class DataView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({'details': 'CSRF cookie set'})
