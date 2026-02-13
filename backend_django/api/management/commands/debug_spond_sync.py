from django.core.management.base import BaseCommand
from api.models import Match
from core.services.spond_service import SpondService
import traceback

class Command(BaseCommand):
    help = 'Debug Spond Sync for Match 26'

    def handle(self, *args, **options):
        try:
            match = Match.objects.get(pk=26)
            print(f"Match found: {match.name}")
            
            service = SpondService()
            print("SpondService initialized")
            
            # Monkey patch get_event if needed or just let it run
            # Assume env vars are set
            
            match.spond_event_id = '12345'
            print(f"Syncing Spond Event ID: {match.spond_event_id}")
            result = service.sync_match_availability(match)
            print(f"Sync Result: {result}")
            
        except Match.DoesNotExist:
            print("Match 26 not found")
        except Exception as e:
            print("ERROR OCCURRED:")
            traceback.print_exc()
