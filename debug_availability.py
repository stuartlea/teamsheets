import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app
from models import Match, Availability, Player

with app.app_context():
    # Find match (Trafford)
    match = Match.query.filter(Match.name.like('%Trafford%')).first()
    
    if match:
        print(f"Match: {match.name} (ID: {match.id})")
        
        # Check availability count
        avail_count = Availability.query.filter_by(match_id=match.id).count()
        print(f"Total Availability Records: {avail_count}")
        
        # Sample some records
        avails = Availability.query.filter_by(match_id=match.id).limit(10).all()
        for a in avails:
            print(f" - Player: {a.player.name} (ID: {a.player.id}) | Status: '{a.status}'")
    else:
        print("Match not found")
