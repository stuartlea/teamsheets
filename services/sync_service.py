
from models import db, Player, Match, Availability, TeamSelection, TeamSeason
from datetime import datetime

class SyncService:
    def __init__(self, sheets_service):
        self.sheets_service = sheets_service

    def sync_master_data(self, team_season_id):
        """
        Synchronizes Master Data from 'Selection' tab for a specific TeamSeason:
        1. Players (Row 5 onwards, Col C) - Global
        2. Matches (Row 1, Cols O:AU) - Scoped to TeamSeason
        3. Availabilities - Scoped to Match
        """
        # Fetch Context
        team_season = TeamSeason.query.get(team_season_id)
        if not team_season:
            print(f"Sync failed: TeamSeason {team_season_id} not found")
            return False

        if not self.sheets_service.is_authenticated():
            print("Sync failed: Not authenticated with Google Sheets")
            return False

        try:
            # Initialize for specific spreadsheet
            self.sheets_service._initialize_sheet(team_season.spreadsheet_id)
            if not self.sheets_service.sheet:
                 print(f"Could not open sheet for {team_season}")
                 return False
                
            # 1. Fetch Selection Worksheet
            ws = self.sheets_service.sheet.worksheet('Selection')
            print(f"Fetching Selection data for {team_season}...")
            
            # Get all data for efficient processing
            all_values = ws.get_all_values()
            
            # --- SYNC MATCHES ---
            print("Syncing Matches...")
            
            fixture_row = all_values[0]
            home_away_row = all_values[1]
            status_row = all_values[2] # Row 3: Status
            date_row = all_values[3]
            
            matches_map = {} # Map col_index to match object
            
            # Columns O (14) to AU (46)
            for col_idx in range(14, len(fixture_row)):
                fixture_name = fixture_row[col_idx]
                if not fixture_name or not fixture_name.strip():
                    continue
                    
                home_away = home_away_row[col_idx] if col_idx < len(home_away_row) else ''
                status_val = status_row[col_idx] if col_idx < len(status_row) else ''
                is_cancelled = 'cancelled' in status_val.lower() if status_val else False
                date_str = date_row[col_idx] if col_idx < len(date_row) else ''
                
                # Parse date
                match_date = None
                if date_str:
                    try:
                        if '/' in date_str:
                            day, month, year = map(int, date_str.split('/'))
                            match_date = datetime(year, month, day).date()
                        elif '-' in date_str:
                             match_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    except ValueError:
                        pass

                # Create or Update Match (Scoped to TeamSeason)
                match = Match.query.filter_by(name=fixture_name, team_season_id=team_season.id).first()
                if not match:
                    match = Match(name=fixture_name, team_season_id=team_season.id)
                    print(f"Creating Match: {fixture_name}")
                
                match.home_away = home_away
                match.date = match_date
                match.is_cancelled = is_cancelled
                match.sheet_col = str(col_idx)

                # Auto-populate location
                if not match.location and home_away:
                     clean_ha = home_away.strip().lower()
                     if clean_ha == 'home' or clean_ha == 'h':
                         match.location = 'Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA'
                
                db.session.add(match)
                matches_map[col_idx] = match
            
            db.session.commit()
            print("Matches Synced.")

            # --- SYNC PLAYERS & AVAILABILITY ---
            print("Syncing Players...")
            
            for row_idx in range(4, len(all_values)):
                row_data = all_values[row_idx]
                if len(row_data) < 3: 
                    continue
                    
                player_name = row_data[2]
                if not player_name or not player_name.strip():
                    continue
                
                # Create or Update Player (Global)
                player = Player.query.filter_by(name=player_name).first()
                if not player:
                    player = Player(name=player_name)
                    print(f"Creating Player: {player_name}")
                
                # Update sheet_row? This is tricky if multiple sheets.
                # For now, we update it, but it might get overwritten by other syncs.
                player.sheet_row = row_idx + 1 
                db.session.add(player)
                db.session.flush() 
                
                # Sync Availability
                for col_idx, match in matches_map.items():
                    status = row_data[col_idx] if col_idx < len(row_data) else ''
                    
                    if not status:
                        continue
                        
                    availability = Availability.query.filter_by(
                         player_id=player.id, 
                         match_id=match.id
                    ).first()
                    
                    if not availability:
                        availability = Availability(
                            player_id=player.id, 
                            match_id=match.id
                        )
                    
                    availability.status = status
                    db.session.add(availability)
            
            db.session.commit()
            print("Players and Availabilities Synced.")
            return True

        except Exception as e:
            print(f"Error syncing master data: {e}")
            db.session.rollback()
            return False

    def sync_team_selections(self, team_season_id):
        """
        Syncs detailed team selections using Batch API to avoid Rate Limits.
        Scopes to the specific TeamSeason.
        """
        print(f"Syncing Team Selections (Batch Mode) for Context {team_season_id}...")
        
        # Context
        team_season = TeamSeason.query.get(team_season_id)
        if not team_season: return
        
        # Filter matches by this context
        matches = Match.query.filter_by(team_season_id=team_season.id).all()
        
        # Initialize proper sheet
        self.sheets_service._initialize_sheet(team_season.spreadsheet_id)
        
        try:
             all_ws = self.sheets_service.sheet.worksheets()
        except Exception as e:
             print(f"Failed to list worksheets: {e}")
             return

        # 2. Map Match -> Worksheet Title & Build Ranges
        match_ws_map = {}
        ranges = []
        ordered_matches = [] 
        
        for match in matches:
             # Find matching worksheet (same logic as find_worksheet_for_match)
             found_ws = None
             for ws in all_ws:
                 if match.name.lower() in ws.title.lower() or ws.title.lower() in match.name.lower():
                     found_ws = ws
                     break
             
             if found_ws:
                 # Quote title to handle spaces, get generous range A1:AZ60
                 ranges.append(f"'{found_ws.title}'!A1:AZ60")
                 ordered_matches.append(match)
             else:
                 print(f"  - Sheet not found for {match.name}")

        if not ranges:
              print("No matching worksheets found.")
              return

        # 3. Batch Fetch Data (ONE API CALL)
        print(f"Fetching data for {len(ranges)} matches in one batch...")
        try:
             # Returns list of dicts: {'range': '...', 'majorDimension': 'ROWS', 'values': [...]}
             results = self.sheets_service.batch_get_values(ranges)
        except Exception as e:
             print(f"Batch fetch failed: {e}")
             return

        # 4. Process Results
        for i, result in enumerate(results):
             if i >= len(ordered_matches): break
             match = ordered_matches[i]
             all_values = result.get('values', [])
             
             if not all_values:
                 print(f"  - No data for {match.name}")
                 continue

             print(f"Syncing Selection for: {match.name}")
             try:
                 # Clear existing selections
                 TeamSelection.query.filter_by(match_id=match.id).delete()
                 
                 # Get Template Type (Cell B1 -> Row 0, Col 1)
                 template_type = all_values[0][1] if len(all_values) > 0 and len(all_values[0]) > 1 else None
                 if not template_type:
                     # Fallback logic if needed, or just skip
                     print(f"  - No template type in B1 for {match.name}")
                     continue

                 # Determine Periods and Columns (Same logic as sync_single_match)
                 periods_config = [] # List of (period_num, col_letter)
                 t_type = str(template_type).strip() if template_type else ""
                 
                 if "Thirds" in t_type:
                     periods_config = [(1, "AB"), (2, "AE"), (3, "AH")]
                 elif "Quarters" in t_type:
                     periods_config = [(1, "H"), (2, "K"), (3, "N"), (4, "Q")]
                 elif "Halves" in t_type and "2 Halves" not in t_type:
                     periods_config = [(1, "U"), (2, "X")]
                 else:
                     # Default / Legacy
                     col = self.sheets_service.get_column_for_template(t_type)
                     periods_config = [(1, col)]
                 
                 def col_letter_to_index(col_letter):
                    num = 0
                    for c in col_letter:
                        if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                            num = num * 26 + (ord(c) - ord('A')) + 1
                    return num - 1
                 
                 for period_num, col_letter in periods_config:
                     name_col_idx = col_letter_to_index(col_letter)
                     
                     # Sync Starters (Rows 5-19 -> indices 4-18)
                     for pos_idx in range(4, 19):
                         if pos_idx >= len(all_values): break
                         row = all_values[pos_idx]
                         player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                         
                         if player_name and player_name.strip():
                             player = Player.query.filter_by(name=player_name.strip()).first()
                             # Auto-create player if simple batch sync? 
                             # Batch sync implies we ran sync_players first, but let's be safe
                             if not player:
                                 player = Player(name=player_name.strip())
                                 db.session.add(player)
                                 db.session.flush()

                             selection = TeamSelection(
                                 match_id=match.id,
                                 player_id=player.id,
                                 position_number=pos_idx - 4 + 1,
                                 role='Starter',
                                 period=period_num
                             )
                             db.session.add(selection)

                     # Sync Finishers (Rows 20-34 -> indices 19-33)
                     for pos_idx in range(19, 34):
                         if pos_idx >= len(all_values): break
                         row = all_values[pos_idx]
                         player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                         
                         if player_name and player_name.strip():
                             player = Player.query.filter_by(name=player_name.strip()).first()
                             if not player:
                                 player = Player(name=player_name.strip())
                                 db.session.add(player)
                                 db.session.flush()

                             selection = TeamSelection(
                                 match_id=match.id,
                                 player_id=player.id,
                                 position_number=pos_idx - 19 + 16,
                                 role='Finisher',
                                 period=period_num
                             )
                             db.session.add(selection)



             except Exception as e:
                 print(f"  - Error syncing {match.name}: {e}")
                 db.session.rollback()
        
        db.session.commit()
        print("Database Sync Complete!")

    def sync_single_match(self, match):
        """
        Syncs team selection data for a SINGLE match.
        Called on-demand when data is missing or requested by user.
        """
        print(f"Syncing Single Match: {match.name}")
        
        if not self.sheets_service.is_authenticated():
             print("Authentication required for sync")
             return False

        # Ensure we are using the correct sheet for this match
        if match.team_season:
             self.sheets_service._initialize_sheet(match.team_season.spreadsheet_id)
        else:
             # Fallback (legacy/dev protection)
             self.sheets_service._initialize_sheet()
        
        if not self.sheets_service.sheet:
             print("Could not initialize sheet for match")
             return False
        
        try:
             # Find matching worksheet
             all_ws = self.sheets_service.sheet.worksheets()
             found_ws = None
             for ws in all_ws:
                 if match.name.lower() in ws.title.lower() or ws.title.lower() in match.name.lower():
                     found_ws = ws
                     break
             
             if not found_ws:
                 print(f"  - Worksheet not found for {match.name}")
                 return False

             # Fetch data (A1:AZ60 is plenty)
             data = found_ws.get('A1:AZ60')
             if not data:
                  print("  - No data found in sheet")
                  return False
             
             # Process Data (Logic refined for multi-period)
             
             # Clear existing
             TeamSelection.query.filter_by(match_id=match.id).delete()
             
             # Get Template Type from B1
             template_type = data[0][1] if len(data) > 0 and len(data[0]) > 1 else None
             if not template_type:
                  # Fallback or error? Let's check if it's there
                  print(f"  - No template type found in B1 for {match.name}")
                  # Try to detect if it's empty matches template...
                  # For now, default to single period (Men/Legacy) which uses Column B usually?
                  # Actually let's trust get_column_for_template from existing service for default
                  pass

             print(f"  - Template Type: {template_type}")

             # Determine Periods and Columns
             # "Single Match - Thirds": [AB, AE, AH]
             # "Single Match - Quarters": [H, K, N, Q]
             # "Single Match - Halves": [U, X]
             # default: [B] (Legacy/Men)
             
             periods_config = [] # List of (period_num, col_letter)
             
             # Clean up string for matching
             t_type = str(template_type).strip() if template_type else ""
             
             if "Thirds" in t_type:
                 periods_config = [(1, "AB"), (2, "AE"), (3, "AH")]
             elif "Quarters" in t_type:
                 periods_config = [(1, "H"), (2, "K"), (3, "N"), (4, "Q")]
             elif "Halves" in t_type and "2 Halves" not in t_type:
                 periods_config = [(1, "U"), (2, "X")]
             else:
                 # Default / Legacy
                 col = self.sheets_service.get_column_for_template(t_type)
                 periods_config = [(1, col)]
             
             def col_letter_to_index(col_letter):
                num = 0
                for c in col_letter:
                    if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                        num = num * 26 + (ord(c) - ord('A')) + 1
                return num - 1

             for period_num, col_letter in periods_config:
                 name_col_idx = col_letter_to_index(col_letter)
                 print(f"  - Syncing Period {period_num} from Column {col_letter} (Index {name_col_idx})")

                 # Sync Starters (Rows 5-19 -> indices 4-18)
                 for pos_idx in range(4, 19):
                     if pos_idx >= len(data): break
                     row = data[pos_idx]
                     player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                     
                     if player_name and player_name.strip():
                         player = Player.query.filter_by(name=player_name.strip()).first()
                         if not player:
                             player = Player(name=player_name.strip())
                             db.session.add(player)
                             db.session.flush()
                             
                         selection = TeamSelection(
                             match_id=match.id,
                             player_id=player.id,
                             position_number=pos_idx - 4 + 1,
                             role='Starter',
                             period=period_num
                         )
                         db.session.add(selection)

                 # Sync Finishers (Rows 20-34 -> indices 19-33)
                 for pos_idx in range(19, 34):
                     if pos_idx >= len(data): break
                     row = data[pos_idx]
                     player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                     
                     if player_name and player_name.strip():
                         player = Player.query.filter_by(name=player_name.strip()).first()
                         if not player:
                             player = Player(name=player_name.strip())
                             db.session.add(player)
                             db.session.flush()

                         selection = TeamSelection(
                             match_id=match.id,
                             player_id=player.id,
                             position_number=pos_idx - 19 + 16,
                             role='Finisher',
                             period=period_num
                         )
                         db.session.add(selection)
            
             db.session.commit()
             print(f"Match {match.name} Synced Successfully.")
             return True

        except Exception as e:
             print(f"Error syncing single match: {e}")
             db.session.rollback()
             return False
