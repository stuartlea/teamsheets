import os
import sys
import django

# Add current directory to path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match
from api.serializers import MatchSerializer
from rest_framework.renderers import JSONRenderer

try:
    match = Match.objects.get(id=25)
    print(f"Match found: {match}")
    print(f"Team Season: {match.team_season}")
    
    serializer = MatchSerializer(match)
    print("Serialization successful")
    print(JSONRenderer().render(serializer.data))
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
