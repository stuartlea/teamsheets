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
from flask import session

class OAuthService:
    def __init__(self):
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ]
        
        # OAuth configuration
        self.client_config = {
            "web": {
                "client_id": os.getenv('GOOGLE_CLIENT_ID', ''),
                "client_secret": os.getenv('GOOGLE_CLIENT_SECRET', ''),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:5000/oauth/callback')]
            }
        }
        
        self.token_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'token.json')
        
    def get_flow(self):
        """Create OAuth flow for authentication"""
        return Flow.from_client_config(
            self.client_config,
            scopes=self.scopes,
            redirect_uri=os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:5000/oauth/callback')
        )
    
    def get_credentials(self):
        """Get credentials from session or token file"""
        # Check session first (for web app)
        if 'credentials' in session:
            credentials_data = json.loads(session['credentials'])
            return Credentials.from_authorized_user_info(credentials_data, self.scopes)
        
        # Check token file (for development)
        if os.path.exists(self.token_file):
            credentials = Credentials.from_authorized_user_file(self.token_file, self.scopes)
            if credentials.valid:
                # Store in session for web use
                session['credentials'] = credentials.to_json()
                return credentials
            elif credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                with open(self.token_file, 'w') as token:
                    token.write(credentials.to_json())
                session['credentials'] = credentials.to_json()
                return credentials
        
        return None
    
    def save_credentials(self, credentials):
        """Save credentials to session and token file"""
        session['credentials'] = credentials.to_json()
        
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
        if 'credentials' in session:
            del session['credentials']
        
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
    
    def is_authenticated(self):
        """Check if user is authenticated"""
        return self.get_credentials() is not None
