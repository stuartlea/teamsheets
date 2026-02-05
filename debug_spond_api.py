import os
import sys
from backend.services.spond_service import SpondService
from dotenv import load_dotenv

load_dotenv()

# Ensure we can import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def debug_spond_event_structure():
    # Instantiate service (picks up env vars)
    service = SpondService()
    if not service.login():
        print("Failed to login to Spond")
        return

    print("Logged in. Fetching groups...")
    groups = service.get_groups()
    if not groups:
        print("No groups found.")
        return

    group_id = groups[0]['id']
    print(f"Using Group ID: {group_id}")

    print("Fetching events...")
    # Fetch 1 event
    events = service.get_events(group_id) 
    # Note: I added 'max' support but checking if my local service instance has it. 
    # The running server code was updated, but this script imports the code on disk. 
    
    # Just use basic get_events and pick one
    if not events:
        print("No events found.")
        return

    # Find one with responses if possible
    target_event = events[0]
    print(f"Inspecting Event: {target_event['id']} - {target_event.get('heading')}")

    # Fetch full details
    full_event = service.get_event(target_event['id'])
    if not full_event:
        print("Failed to fetch full event.")
        return

    responses = full_event.get('responses')
    print(f"\n--- Responses Structure ---")
    print(f"Type: {type(responses)}")
    print(f"Content: {responses}")

    if isinstance(responses, dict):
        print("Responses is a DICT. Keys:", responses.keys())
        for k, v in responses.items():
            print(f"Key '{k}': Type {type(v)}")
            if isinstance(v, list) and v:
                print(f"  Sample item: {v[0]}")

if __name__ == "__main__":
    debug_spond_event_structure()
