import os
import sys
import requests
from dotenv import load_dotenv

# Load env before importing service logic (mimicking service behavior)
load_dotenv()

# We can reuse the service class logic directly or import it.
# Importing is safer to test exact code path.
from backend.services.spond_service import SpondService

# Ensure backend path is in sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def debug_spond_members():
    service = SpondService()
    if not service.login():
        print("Login failed.")
        return

    print("Fetching groups...")
    groups = service.get_groups()
    print(f"Found {len(groups)} groups.")

    for i, group in enumerate(groups):
        gid = group.get('id')
        name = group.get('name')
        gtype = group.get('type') # Check if type exists
        print(f"\n--- Group {i+1}: {name} (ID: {gid}, Type: {gtype}) ---")
        
        # Determine if it's a subgroup (often has 'parentGroupId' or similar)
        # Printing keys to inspect structure
        # print(f"Keys: {list(group.keys())}")
        
        try:
            # 1. Try fetching Group Detail first
            detail_url = f"{service.BASE_URL}/groups/{gid}"
            print(f"GET Detail {detail_url}")
            detail_resp = service.session.get(detail_url)
            print(f"Detail Status: {detail_resp.status_code}")
            
            if detail_resp.status_code == 200:
                detail = detail_resp.json()
                print(f"Detail keys: {list(detail.keys())}")
                if 'members' in detail:
                    print(f"Found members in detail! Count: {len(detail['members'])}")
                    continue
                if 'subGroups' in detail:
                    print(f"Has subGroups: {len(detail['subGroups'])}")

            # 2. Try alternative members endpoint
            # Some unofficial docs suggest /groups/{id}/members is correct, but maybe /members?groupId={id}
            # Note: The service code had a comment about this.
            
            # Legacy/Alternative?
            # url = f"{service.BASE_URL}/members?groupId={gid}" # This is what we might want to try?
            # Actually, let's try reading the 'members' from the group object itself if 'members' key existed in list?
            if 'members' in group:
                 print(f"Members key found in list object! Count: {len(group['members'])}")
            
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    debug_spond_members()
