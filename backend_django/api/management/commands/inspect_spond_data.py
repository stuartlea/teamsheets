from django.core.management.base import BaseCommand
from api.models import Match, Player, Availability
from core.services.spond_service import SpondService
import json

class Command(BaseCommand):
    help = 'Inspect Spond Data for Match 26'

    def handle(self, *args, **options):
        try:
            match = Match.objects.get(pk=26)
            print(f"Match: {match.name}")
            target_id = match.spond_availability_id or match.spond_event_id
            print(f"Target Spond ID: {target_id}")
            
            if not target_id:
                print("No Spond ID linked.")
                return

            service = SpondService()
            if not service.ensure_auth():
                print("Failed to auth with Spond.")
                return

            print("Fetching Spond Event/Availability...")
            data = service.get_event(target_id)
            if not data:
                print("Failed to fetch data (404/Error).")
                return

            # Print keys to understand structure
            print(f"Root Keys: {list(data.keys())}")
            
            # Check for responses
            if 'responses' in data:
                res = data['responses']
                print(f"Responses Keys: {list(res.keys())}")
                print(f"Accepted Count: {len(res.get('acceptedIds', []))}")
                print(f"Declined Count: {len(res.get('declinedIds', []))}")
                print(f"Unanswered Count: {len(res.get('unansweredIds', []))}")
                print(f"Sample Accepted ID: {res.get('acceptedIds', [])[:1]}")
            else:
                print("WARNING: 'responses' key not found in data!")
                print(json.dumps(data, indent=2))

            # Check Players
            players_with_spond = Player.objects.filter(spond_id__isnull=False).exclude(spond_id='')
            print(f"Players with Spond ID in DB: {players_with_spond.count()}")
            
            if players_with_spond.exists():
                p = players_with_spond.first()
                print(f"Sample Player: {p.name} (SpondID: {p.spond_id})")

            # Check Match Availability
            av_count = Availability.objects.filter(match=match).count()
            print(f"Existing Availability Records for Match: {av_count}")

        except Match.DoesNotExist:
            print("Match 26 not found")
        except Exception as e:
            print(f"Error: {e}")
