
import os
import requests
import json
from datetime import datetime
from flask import current_app

class SpondService:
    BASE_URL = "https://api.spond.com/core/v1"
    
    def __init__(self):
        self.username = os.environ.get('SPOND_USERNAME')
        self.password = os.environ.get('SPOND_PASSWORD')
        self.token = None
        self.token_expiry = None
        self.session = requests.Session()

    def login(self):
        """Authenticate with Spond and get access token"""
        if not self.username or not self.password:
            raise ValueError("Spond credentials not configured (SPOND_USERNAME, SPOND_PASSWORD)")
            
        url = f"{self.BASE_URL}/login"
        payload = {
            "email": self.username,
            "password": self.password
        }
        
        try:
            response = self.session.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Token is usually in 'loginToken' or returned directly? 
            # Reverse engineering docs vary. Assuming standard login response.
            # Olen/Spond uses specific auth flow.
            # If standard login fails, we might need to handle 2FA or device ID.
            
            # For now assuming simple response with 'token'
            self.token = data.get('loginToken') 
            if not self.token:
                 # Fallback/Debug
                 print(f"Spond Login Response: {data.keys()}")
            
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            return True
        except Exception as e:
            print(f"Spond Login Failed: {e}")
            return False

    def ensure_auth(self):
        if not self.token:
            return self.login()
        return True

    def get_groups(self):
        """Fetch all groups the user is a member of"""
        if not self.ensure_auth(): return []
        
        try:
            response = self.session.get(f"{self.BASE_URL}/groups")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching Spond groups: {e}")
            return []

    def get_group_members(self, group_id):
        """Fetch members of a group"""
        if not self.ensure_auth(): return []
        
        try:
            # The /groups/{id}/members endpoint seems to 404 for many groups.
            # However, get_groups() returns the full list with members embedded.
            groups = self.get_groups()
            group = next((g for g in groups if g['id'] == group_id), None)
            
            if group and 'members' in group:
                return group['members']
            return []
        except Exception as e:
            print(f"Error fetching Spond members: {e}")
            return []

    def get_events(self, group_id, min_start=None):
        """Fetch events (sponds) for a group"""
        if not self.ensure_auth(): return []
        
        try:
            params = {'groupId': group_id, 'max': 50}
            if min_start:
                params['minStart'] = min_start.isoformat()
            else:
                # Default to showing only future events (or recent past)
                # Spond API 'minEnd' or 'minStart' can be used.
                # Let's filter in python to be safe if API varies.
                pass
            
            response = self.session.get(f"{self.BASE_URL}/sponds", params=params)
            response.raise_for_status()
            events = response.json()
            
            # Filter past events (keep events starting from yesterday onwards)
            # Use a safe buffer (e.g. yesterday) just in case of timezone issues or post-match admin
            from datetime import timedelta
            cutoff = (datetime.now() - timedelta(days=1)).isoformat()
            events = [e for e in events if e.get('startTimestamp') and e.get('startTimestamp') >= cutoff]

            # Sort by startTimestamp ascending (soonest first)
            events.sort(key=lambda x: x.get('startTimestamp', ''))
            return events
        except Exception as e:
            print(f"Error fetching Spond events: {e}")
            return []
            
    def get_event(self, event_id):
        """Fetch single event details including attendees"""
        if not self.ensure_auth(): return None
        
        try:
            response = self.session.get(f"{self.BASE_URL}/sponds/{event_id}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching Spond event {event_id}: {e}")
            return None
