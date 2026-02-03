import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app
from models import Match, MatchFormat

with app.app_context():
    # 1. Find Match 21 (or by name 'Trafford')
    # Note: User said "21: Trafford", relying on ID 21 might be unsafe if IDs shifted, better search by name partial.
    match = Match.query.filter(Match.name.like('%Trafford%')).first()
    
    print(f"\n--- Match Analysis ---")
    if match:
        print(f"Match ID: {match.id}")
        print(f"Name: {match.name}")
        print(f"Current Format ID: {match.format_id}")
        if match.format:
            print(f"Format Name: {match.format.name}")
            print(f"Format Key: {match.format.spreadsheet_key}")
        else:
            print("Format: None (Falling back to default via code?)")
    else:
        print("Match 'Trafford' not found.")

    # 2. List all Formats
    print(f"\n--- Available MatchFormats ---")
    formats = MatchFormat.query.all()
    for f in formats:
        print(f"ID: {f.id} | Name: {f.name} | Key: '{f.spreadsheet_key}' | Periods: {f.periods}")
