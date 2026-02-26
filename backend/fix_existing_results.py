import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Match

print("Fixing existing match results...")

matches = Match.objects.all()
count_fixed = 0

for m in matches:
    original_result = m.result
    # Calling save triggers calculate_score with new logic
    m.save()
    
    if original_result != m.result:
        print(f"Match {m.id} fixed: {original_result} -> {m.result}")
        count_fixed += 1

print(f"Done. Fixed {count_fixed} matches.")
