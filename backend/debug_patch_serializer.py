import os
import django
from django.test import RequestFactory
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import TeamSeason
from api.serializers import TeamSeasonSerializer

# Get an existing object
ts = TeamSeason.objects.first()
print(f"Testing PATCH for TeamSeason ID {ts.id}")

# Data payload similar to frontend
data = {
    'spreadsheet_id': 'NEW_SPREADSHEET_ID_TEST',
    'scoring_type': 'tries_only'
}

# Test Serializer directly
serializer = TeamSeasonSerializer(ts, data=data, partial=True)
if serializer.is_valid():
    print("Serializer is valid.")
    # Don't save to avoid messing up DB, just check validation
else:
    print("Serializer errors:", serializer.errors)
