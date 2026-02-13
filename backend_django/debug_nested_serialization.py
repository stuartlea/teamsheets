import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match
from api.serializers import MatchSerializer

try:
    print("Creating a temporary Match with NO TeamSeason...")
    # Create in memory or DB? DB is better to mimic ViewSet
    m = Match.objects.create(name="Debug Match 500", team_season=None)
    
    print(f"Match Created: {m.id}, TeamSeason: {m.team_season}")
    
    print("Attempting to Serialize...")
    try:
        s = MatchSerializer(m)
        data = s.data
        print("Serialization Result Keys:", data.keys())
        print("team_spond_group_id:", data.get('team_spond_group_id'))
        print("SUCCESS: Did not crash.")
    except Exception as e:
        print("CRASHED during Serialization:")
        traceback.print_exc()
        
    # Clean up
    m.delete()

except Exception as e:
    traceback.print_exc()
