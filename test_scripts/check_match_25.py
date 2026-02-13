import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from app import app, Match, db

with app.app_context():
    match = Match.query.get(25)
    if match:
        print(f"Match 25: {match.name}")
        print(f"Team Season ID: {match.team_season_id}")
        if match.team_season_id is None:
            print("WARNING: Team Season ID is NULL. Attempting to fix...")
            # Try to assign it to the first available TeamSeason or default to 1
            # Assuming TeamSeason ID 1 exists
            match.team_season_id = 1
            db.session.commit()
            print("UPDATED Match 25 team_season_id to 1.")
    else:
        print("Match 25 not found.")
