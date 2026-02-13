import sqlite3
import json
from datetime import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import (
    User, Team, TeamPermission, MatchFormat, Season, 
    TeamSeason, Player, PlayerAlias, Match, Availability, TeamSelection
)
from django.db import transaction

# Map legacy table to Django model
class Command(BaseCommand):
    help = 'Import data from Flask SQLite database'

    def handle(self, *args, **options):
        db_path = settings.BASE_DIR.parent / 'backend/instance/teamsheets.db'
        
        if not db_path.exists():
            self.stdout.write(self.style.ERROR(f'Database not found at {db_path}'))
            return

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            with transaction.atomic():
                self.import_users(cursor)
                self.import_teams(cursor)
                self.import_seasons(cursor)
                self.import_match_formats(cursor)
                self.import_team_seasons(cursor)
                self.import_players(cursor)
                self.import_matches(cursor)
                # Team Permissions rely on Users and Teams
                self.import_team_permissions(cursor) 
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error importing data: {e}'))
            raise e
        finally:
            conn.close()

    def import_users(self, cursor):
        self.stdout.write('Importing Users...')
        cursor.execute("SELECT * FROM user")
        rows = cursor.fetchall()
        for row in rows:
            # Flask uses 'password_hash'. We'll store it but Django uses a different hasher usually.
            # We might need to reset passwords or use a compatible hasher.
            # For now, let's just create the user. properties: id, username, password_hash, is_admin
            u, created = User.objects.get_or_create(
                id=row['id'],
                defaults={
                    'username': row['username'],
                    'is_superuser': row['is_admin'],
                    'is_staff': row['is_admin'],
                    'password': row['password_hash'] # Warning: Might not work directly if hash format differs
                }
            )
            if created:
                self.stdout.write(f"Created user {u.username}")

    def import_teams(self, cursor):
        self.stdout.write('Importing Teams...')
        cursor.execute("SELECT * FROM team")
        rows = cursor.fetchall()
        for row in rows:
            Team.objects.get_or_create(
                id=row['id'],
                defaults={
                    'name': row['name'],
                    'logo_url': row['logo_url'],
                    'spond_group_id': row['spond_group_id']
                }
            )

    def import_match_formats(self, cursor):
        self.stdout.write('Importing Match Formats...')
        cursor.execute("SELECT * FROM match_format")
        rows = cursor.fetchall()
        for row in rows:
            MatchFormat.objects.get_or_create(
                id=row['id'],
                defaults={
                    'name': row['name'],
                    'periods': row['periods'],
                    'period_duration': row['period_duration'],
                    'players_on_pitch': row['players_on_pitch'],
                    'spreadsheet_key': row['spreadsheet_key'],
                    'column_config': json.loads(row['column_config']) if row['column_config'] else None
                }
            )

    def import_seasons(self, cursor):
        self.stdout.write('Importing Seasons...')
        cursor.execute("SELECT * FROM season")
        rows = cursor.fetchall()
        for row in rows:
            Season.objects.get_or_create(
                id=row['id'],
                defaults={
                    'name': row['name'],
                    'start_date': row['start_date'],
                    'end_date': row['end_date'],
                    'is_current': row['is_current']
                }
            )

    def import_team_seasons(self, cursor):
        self.stdout.write('Importing Team Seasons (Contexts)...')
        cursor.execute("SELECT * FROM team_season")
        rows = cursor.fetchall()
        for row in rows:
            TeamSeason.objects.get_or_create(
                id=row['id'],
                defaults={
                    'team_id': row['team_id'],
                    'season_id': row['season_id'],
                    'spreadsheet_id': row['spreadsheet_id'],
                    'sheet_name': row['sheet_name']
                }
            )

    def import_players(self, cursor):
        self.stdout.write('Importing Players and Aliases...')
        cursor.execute("SELECT * FROM player")
        rows = cursor.fetchall()
        for row in rows:
            Player.objects.get_or_create(
                id=row['id'],
                defaults={
                    'name': row['name'],
                    'sheet_row': row['sheet_row'],
                    'position': row['position'],
                    'is_forward': row['is_forward'],
                    'is_back': row['is_back'],
                    'spond_id': row['spond_id'],
                    'deleted_at': row['deleted_at'],
                    'left_date': row['left_date']
                }
            )
        
        # Aliases
        cursor.execute("SELECT * FROM player_alias")
        rows = cursor.fetchall()
        for row in rows:
            PlayerAlias.objects.get_or_create(
                id=row['id'],
                defaults={
                    'name': row['name'],
                    'player_id': row['player_id']
                }
            )

    def import_matches(self, cursor):
        self.stdout.write('Importing Matches, Availabilities, Selections...')
        cursor.execute("SELECT * FROM match")
        rows = cursor.fetchall()
        for row in rows:
            m, _ = Match.objects.get_or_create(
                id=row['id'],
                defaults={
                    'team_season_id': row['team_season_id'],
                    'name': row['name'],
                    'date': row['date'],
                    'home_away': row['home_away'],
                    'sheet_col': row['sheet_col'],
                    'opponent_name': row['opponent_name'],
                    'is_manual': row['is_manual'],
                    'format_id': row['format_id'],
                    'result_home_score': row['result_home_score'],
                    'result_away_score': row['result_away_score'],
                    'scorers': json.loads(row['scorers']) if row['scorers'] else None,
                    'kickoff_time': row['kickoff_time'],
                    'meet_time': row['meet_time'],
                    'location': row['location'],
                    'is_cancelled': row['is_cancelled'],
                    'spond_event_id': row['spond_event_id'],
                    'spond_availability_id': row['spond_availability_id']
                }
            )

        # Availability
        cursor.execute("SELECT * FROM availability")
        rows = cursor.fetchall()
        for row in rows:
            Availability.objects.get_or_create(
                id=row['id'],
                defaults={
                    'match_id': row['match_id'],
                    'player_id': row['player_id'],
                    'status': row['status'],
                    'spond_status': row['spond_status'],
                    'spond_last_updated': row['spond_last_updated']
                }
            )

        # TeamSelection
        cursor.execute("SELECT * FROM team_selection")
        rows = cursor.fetchall()
        for row in rows:
            TeamSelection.objects.get_or_create(
                id=row['id'],
                defaults={
                    'match_id': row['match_id'],
                    'player_id': row['player_id'],
                    'position_number': row['position_number'],
                    'role': row['role'],
                    'period': row['period']
                }
            )

    def import_team_permissions(self, cursor):
        self.stdout.write('Importing Team Permissions...')
        cursor.execute("SELECT * FROM team_permission")
        rows = cursor.fetchall()
        for row in rows:
            TeamPermission.objects.get_or_create(
                id=row['id'],
                defaults={
                    'user_id': row['user_id'],
                    'team_id': row['team_id'],
                    'role': row['role']
                }
            )
