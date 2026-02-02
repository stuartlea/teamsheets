from app import app
from models import db, Team, Season, TeamSeason
from services.sheets_service import SheetsService
from services.sync_service import SyncService
import os

def seed_database():
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Creating all tables...")
        db.create_all()

        # 1. Create Default Team
        team = Team(name="Sandbach U15s")
        db.session.add(team)
        
        # 2. Create Default Season
        season = Season(name="2025-2026", is_current=True)
        db.session.add(season)
        db.session.commit() # Commit to get IDs

        # 3. Create TeamSeason Link
        # Get Sheet ID from env (fallback to hardcoded if needed, but should be in .env)
        # Note: SheetsService reads env, but we want to store it in DB explicitly.
        sheet_id = os.getenv('GOOGLE_SHEET_ID', '1KRCwRuvTR0DXaNTWseIq5PGlvS9bmmi5VZdmc-SEyiU')
        
        team_season = TeamSeason(
            team_id=team.id,
            season_id=season.id,
            spreadsheet_id=sheet_id,
            sheet_name="Master"
        )
        db.session.add(team_season)
        db.session.commit()
        
        print(f"Created Context: {team_season}")

        # 4. Trigger Initial Sync
        print("Triggering Initial Sync...")
        sheets_service = SheetsService()
        sync_service = SyncService(sheets_service)
        
        success = sync_service.sync_master_data(team_season.id)
        if success:
            print("Master Data Synced. Syncing Selections...")
            sync_service.sync_team_selections(team_season.id)
            print("Seeding Complete!")
        else:
            print("Sync Failed during seeding.")

        # 5. Create Second Context (U16s) for verification
        print("\nCreating U16s Context...")
        team2 = Team(name="Sandbach U16s")
        db.session.add(team2)
        db.session.flush()
        
        # Link to same season and sheet for test purposes
        team_season2 = TeamSeason(
            team_id=team2.id,
            season_id=season.id,
            spreadsheet_id=sheet_id,
            sheet_name="Master"
        )
        db.session.add(team_season2)
        db.session.commit()
        
        print(f"Created Context 2: {team_season2}")
        # Sync for context 2 (Matches will be duplicated for this context)
        sync_service.sync_master_data(team_season2.id)
        # Skip selections sync to save time/quota, usually master data is enough to see fixtures


if __name__ == "__main__":
    seed_database()
