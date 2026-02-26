import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match
from api.serializers import MatchSerializer

try:
    match_id = 25
    if not Match.objects.filter(id=match_id).exists():
        match = Match.objects.first()
        print(f"Match 25 not found, using {match.id}")
    else:
        match = Match.objects.get(id=match_id)

    print(f"Match {match.id} TeamSeason: {match.team_season}")

    # Simulate PUT with minimal data (should potentially clear team_season if it's not required?)
    # But wait, ModelSerializer PUT requires all fields unless read_only.
    # If team_season is in 'fields', it acts as PrimaryKeyRelatedField.
    # It is nullable in model.
    # If partial=False (standard PUT), and field is missing? DRF raises validation error usually?
    
    # Let's try to mimic exactly what happens.
    data = {
         'home_tries': 5,
         'away_tries': 2,
         'home_cons': 0, 
         'home_pens': 0,
         'home_drop_goals': 0,
         'away_cons': 0,
         'away_pens': 0,
         'away_drop_goals': 0
         # Missing name, date, team_season, etc.
    }
    
    # NOTE: frontend uses PUT matches/:id
    # Default DRF UpdateModelMixin uses partial=False.
    
    print("Testing Serializer with partial=False (PUT default) and missing fields...")
    serializer = MatchSerializer(match, data=data, partial=False)
    if serializer.is_valid():
        print("Serializer Valid.")
        instance = serializer.save()
        print(f"Saved. New TeamSeason: {instance.team_season}")
        print("Attempting to read .data (to_representation)...")
        print(serializer.data)
    else:
        print("Serializer Invalid (Expected for PUT with missing fields):")
        print(serializer.errors)
        
    # HYPOTHESIS 2: Frontend actually calling PATCH? User said PUT.
    # But maybe api.put is wrapping PATCH? Unlikely.
    # What if frontend sends PUT but DRF ViewSet behaves unexpectedly?
    
    # Let's also test: What if team_season IS None? Does serializer crash?
    print("\nTesting serialization of a Match with team_season=None...")
    match.team_season = None
    # Don't save, just serialize
    s = MatchSerializer(match)
    try:
        print(s.data['team_season_scoring'])
        print("Serialization Successful (handled None)")
    except Exception as e:
        print("Serialization CRASHED as predicted:")
        traceback.print_exc()

except Exception as e:
    traceback.print_exc()
