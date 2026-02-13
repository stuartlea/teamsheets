import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match

try:
    print("Creating temporary match...")
    m = Match.objects.create(name="No Result Test", home_tries=0, away_tries=0, is_manual=False)
    
    print(f"Initial State: Manual={m.is_manual}, Result={m.result}, Scores={m.result_home_score}-{m.result_away_score}")
    
    # 1. Test Saving without manual flag (should be None)
    m.save()
    print(f"After Save (Auto): Result={m.result}")
    
    if m.result is None:
        print("PASS: Result is None for 0-0 auto.")
    else:
        print("FAIL: Result set for 0-0 auto.")
        
    # 2. Test Manual 0-0 Draw
    m.is_manual = True
    m.save()
    print(f"After Save (Manual): Result={m.result}")
    
    if m.result == 'D':
        print("PASS: Result is D for 0-0 manual.")
    else:
        print("FAIL: Result NOT D for 0-0 manual.")
        
    # 3. Test Manual Win
    m.home_tries = 1
    m.save()
    print(f"After Save (Win): Result={m.result}, Score={m.result_home_score}")
    
    # Clean up
    m.delete()

except Exception as e:
    traceback.print_exc()
