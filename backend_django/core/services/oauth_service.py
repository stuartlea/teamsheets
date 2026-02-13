"""
OAuth 2.0 authentication service for Google Sheets
Handles user authentication flow and token management
"""

import os
import json
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
import gspread
from django.conf import settings

class OAuthService:
    def __init__(self):
        # Allow OAuth over HTTP for development
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'openid'
        ]
        
        # OAuth configuration
        self.client_config = {
            "web": {
                "client_id": getattr(settings, 'GOOGLE_CLIENT_ID', os.getenv('GOOGLE_CLIENT_ID', '')),
                "client_secret": getattr(settings, 'GOOGLE_CLIENT_SECRET', os.getenv('GOOGLE_CLIENT_SECRET', '')),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [getattr(settings, 'OAUTH_REDIRECT_URI', os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:8000/oauth/callback'))]
            }
        }
        
        # Store token in project root or configured path
        self.token_file = getattr(settings, 'GOOGLE_TOKEN_PATH', os.path.join(settings.BASE_DIR, 'token.json'))
        
    def get_flow(self):
        """Create OAuth flow for authentication"""
        return Flow.from_client_config(
            self.client_config,
            scopes=self.scopes,
            redirect_uri=self.client_config['web']['redirect_uris'][0]
        )
    
    def get_credentials(self):
        """Get credentials from token file"""
        if os.path.exists(self.token_file):
            try:
                credentials = Credentials.from_authorized_user_file(self.token_file, self.scopes)
                if credentials.valid:
                    return credentials
                elif credentials.expired and credentials.refresh_token:
                    try:
                        credentials.refresh(Request())
                        with open(self.token_file, 'w') as token:
                            token.write(credentials.to_json())
                        return credentials
                    except Exception as e:
                        print(f"Error refreshing credentials: {e}")
                        return None
            except Exception as e:
                 print(f"Error loading credentials: {e}")
                 return None
        return None
    
    def save_credentials(self, credentials):
        """Save credentials to token file"""
        # Also save to file for persistence
        with open(self.token_file, 'w') as token:
            token.write(credentials.to_json())
    
    def get_sheets_client(self):
        """Get authenticated Google Sheets client"""
        credentials = self.get_credentials()
        if credentials:
            return gspread.authorize(credentials)
        return None
    
    def revoke_credentials(self):
        """Revoke stored credentials"""
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
    
    def is_authenticated(self):
        """Check if user is authenticated"""
        return self.get_credentials() is not None
