import requests
import json
import os
import django
from django.conf import settings

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

# Override settings to allow testserver
from django.test import override_settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import PlayerScore, Match, Player

@override_settings(ALLOWED_HOSTS=['*'])
def run_test():
    # Clean up previous scores
    PlayerScore.objects.all().delete()

    # Create dummy match/player if not exist
    match_id = 1
    try:
        match = Match.objects.filter(id=match_id).first()
        if not match:
             print("Match 1 not found. Using first match.")
             match = Match.objects.first()
             
        player = Player.objects.first()
        print(f"Using Match: {match.id}, Player: {player.id}")
        
        # payload
        payload = {
            "match": match.id,
            "player": player.id,
            "score_type": "con",
            "outcome": "scored",
            # Assuming 'quantity' is passed in body
            "quantity": 3
        }
        
        User = get_user_model()
        user = User.objects.first()
        if not user:
             user = User.objects.create_superuser('test', 'test@test.com', 'pass')
        
        client = APIClient()
        client.force_authenticate(user=user)
        
        print(f"Sending payload: {payload}")
        response = client.post('/api/player-scores/', payload, format='json')
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.data}")
        
        count = PlayerScore.objects.filter(match=match, player=player).count()
        print(f"Total Scores in DB for Player: {count}")
        
        if count == 3:
            print("SUCCESS: 3 items created.")
        else:
            print(f"FAILURE: Expected 3, got {count}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_test()
