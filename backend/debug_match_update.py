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
    else:
        match = Match.objects.get(id=match_id)

    print(f"Testing update on Match ID {match.id}")
    
    # Test Case 1: Send strings for integers (Frontend might do this)
    data_strings = {
        'id': match.id,
        'home_tries': '4',
        'away_tries': '1', 
        'home_cons': '', # Empty string might cause issue?
        'is_manual': True
    }
    
    print("\n--- Test Case 1: Strings / Empty Strings ---")
    serializer = MatchSerializer(match, data=data_strings, partial=True) # Using partial to simulate
    if serializer.is_valid():
        try:
            serializer.save()
            print("Save Successful")
        except Exception as e:
            print("Save Failed with Exception:")
            traceback.print_exc()
    else:
        print("Serializer Invalid:", serializer.errors)
        
    # Test Case 2: None values
    print("\n--- Test Case 2: None Values ---")
    data_none = {
         'home_tries': None,
         'away_tries': 10
    }
    serializer = MatchSerializer(match, data=data_none, partial=True)
    if serializer.is_valid():
         try:
            serializer.save()
            print("Save Successful")
         except Exception as e:
            print("Save Failed with Exception:")
            traceback.print_exc()
    else:
        print("Serializer Invalid:", serializer.errors)

except Exception as e:
    traceback.print_exc()
