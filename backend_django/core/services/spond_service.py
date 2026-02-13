
import os
import requests
import json
from datetime import datetime
from django.conf import settings

class SpondService:
    BASE_URL = "https://api.spond.com/core/v1"
    
    def __init__(self):
        self.username = getattr(settings, 'SPOND_USERNAME', os.environ.get('SPOND_USERNAME'))
        self.password = getattr(settings, 'SPOND_PASSWORD', os.environ.get('SPOND_PASSWORD'))
        self.session = requests.Session()
        
        # Try to restore session from cache
        from django.core.cache import cache
        token = cache.get('spond_token')
        if token:
            print("DEBUG: Spond token found in cache.")
            self.token = token
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
        else:
            print("DEBUG: Spond token NOT found in cache.")
            self.token = None

    def login(self):
        """Authenticate with Spond and get access token"""
        if self.token: 
            print("DEBUG: Already authenticated (memory/cache).")
            return True # Already authenticated via cache
        
        print("DEBUG: Initiating Spond Login via API...")
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
            
            self.token = data.get('loginToken') 
            if not self.token:
                 print(f"Spond Login Response: {data.keys()}")
            
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            
            # Cache token for 1 hour (or less than actual expiry)
            from django.core.cache import cache
            cache.set('spond_token', self.token, 3600)
            
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
        
        # Cache groups too?
        from django.core.cache import cache
        cached_groups = cache.get('spond_groups')
        if cached_groups: 
            return cached_groups

        try:
            response = self.session.get(f"{self.BASE_URL}/groups")
            response.raise_for_status()
            groups = response.json()
            cache.set('spond_groups', groups, 300) # Cache for 5 mins
            return groups
        except Exception as e:
            print(f"Error fetching Spond groups: {e}")
            return []

    def get_group_members(self, group_id):
        """Fetch members of a group"""
        if not self.ensure_auth(): return []
        
        try:
            # The /groups/{id}/members endpoint seems to 404 for many groups.
            # However, get_groups() returns the full list with members embedded.
            groups = self.get_groups() # Uses cache
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
            if response.status_code == 404:
                print(f"Spond event {event_id} not found (404).")
                return None
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching Spond event {event_id}: {e}")
            return None

    def sync_match_availability(self, match):
        """Syncs the availability of players for a match from its linked Spond event."""
        # Prioritize availability ID as per user request, fallback to event ID
        target_id = match.spond_availability_id or match.spond_event_id
        
        if not target_id:
             print(f"Match {match.id} has no linked Spond availability/event.")
             return False

        event = self.get_event(target_id)
        if not event:
             print(f"Could not fetch event/availability {target_id} for match {match.id}")
             return False

        # Attendees are in 'responses' object or list?
        # Spond API structure:
        # event['responses'] = { 'acceptedIds': [...], 'declinedIds': [...], 'unansweredIds': [...], 'waitingListIds': [...] }
        # OR separate endpoint /sponds/{id}/responses?
        # It seems 'responses' is included in full event details.
        
        responses = event.get('responses', {})
        accepted = set(responses.get('acceptedIds', []))
        declined = set(responses.get('declinedIds', []))
        unanswered = set(responses.get('unansweredIds', [])) # Treat as Unknown/Pending?
        waiting = set(responses.get('waitingListIds', [])) # Treat as Available?

        # Map Spond Member IDs to Players in this TeamSeason
        # Need to query Players via spond_id (Player model has spond_id from import)
        from api.models import Availability, Player
        
        # Get all players for this team season context
        # Match -> TeamSeason -> Team -> Players (via Spond ID?)
        # Actually Players are linked to Team Context? No, Player is linked to Spond ID.
        # We need players associated with this context?
        # Availability is for specific match.
        
        # Strategy: Iterate all players in the team roster for this season.
        # Check their spond_id against the lists.
        # Update/Create Availability record.
        
        # Get players in this team context
        # Roster: Player.objects.filter(team_seasons__id=match.team_season.id)?
        # Our Player model is simple. 
        # Using correct relation: Match.team_season -> (Player?)
        # Actually Availability links Match and Player.
        # We should iterate all players that *could* be available.
        # Let's assume all players linked to the Spond Group? Or just try to match by Spond ID globally?
        
        # Safest: Get all players who have a spond_id
        players = Player.objects.filter(spond_id__isnull=False).exclude(spond_id='')
        
        # We can also verify they belong to the team if needed, but spond_id inside the event *implies* membership.
        
        updated_count = 0
        
        for player in players:
            new_status = 'Unknown'
            spond_status = 'Unanswered'
            
            if player.spond_id in accepted:
                new_status = 'Available'
                spond_status = 'Attending'
            elif player.spond_id in declined:
                new_status = 'Unavailable'
                spond_status = 'Declined'
            elif player.spond_id in waiting:
                new_status = 'Available'
                spond_status = 'Waiting List'
            elif player.spond_id in unanswered:
                # Keep as unknown
                pass
            else:
                # Not in event list? Maybe not invited?
                continue 
            
            # Update/Create Availability
            # Note: Availability model needs to be imported inside method to avoid circular imports? Done above.
            
            obj, created = Availability.objects.update_or_create(
                match=match,
                player=player,
                defaults={
                    'status': new_status,
                    'spond_status': spond_status
                }
            )
            updated_count += 1
            
        print(f"Synced availability for {updated_count} players.")
        return True
