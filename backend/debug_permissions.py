import os
import django
import traceback
from unittest.mock import Mock

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match, User
from api.permissions import HasTeamAccess

try:
    match_id = 25
    if not Match.objects.filter(id=match_id).exists():
        match = Match.objects.first()
        print(f"Match {match_id} not found, using {match.id}")
    else:
        match = Match.objects.get(id=match_id)

    print(f"Testing Permissions for Match {match.id}")
    print(f"Match TeamSeason: {match.team_season}")

    # Mock Request
    request = Mock()
    request.user = User.objects.first() # Assume first user exists. Or create one?
    # Ensure user has credentials or is superuser? 
    # Let's verify if it crashes first.
    if not request.user:
         print("No users found! Creating dummy.")
         request.user = User.objects.create(username='debug_user')
         
    request.method = 'PUT' 
    
    perm = HasTeamAccess()
    
    print("Calling has_object_permission...")
    try:
        result = perm.has_object_permission(request, None, match)
        print(f"Permission Result: {result}")
    except Exception as e:
        print("CRASHED in Permission Check:")
        traceback.print_exc()
        
    # Also test the NULL TeamSeason case which I suspected
    print("\nTesting with Match.team_season = None...")
    match.team_season = None
    try:
        result = perm.has_object_permission(request, None, match)
        print(f"Permission Result (None TS): {result}")
    except Exception as e:
        print("CRASHED in Permission Check (None TS) as expected:")
        traceback.print_exc()

except Exception as e:
    traceback.print_exc()
