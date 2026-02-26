from api.models import Player, Match, Availability, TeamSelection, TeamSeason, MatchFormat, PlayerAlias
from datetime import datetime
from django.db import transaction

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
        try:
            team_season = TeamSeason.objects.get(id=team_season_id)
        except TeamSeason.DoesNotExist:
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
            
            with transaction.atomic():
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
                    match, created = Match.objects.get_or_create(
                        name=fixture_name, 
                        team_season_id=team_season.id,
                        defaults={'date': match_date, 'source': 'Imported'}
                    )
                    
                    if created:
                        print(f"Creating Match: {fixture_name}")
                    else:
                        match.source = 'Imported' # Ensure existing matches update source
                    
                    match.home_away = home_away
                    match.date = match_date
                    match.is_cancelled = is_cancelled
                    match.sheet_col = str(col_idx)

                    # Parse Opponent Name
                    op_name = fixture_name
                    if ':' in op_name:
                        op_name = op_name.split(':', 1)[1].strip()
                    
                    if op_name.upper().endswith(('(H)', '(A)', '(H/A)')):
                         op_name = op_name.rsplit('(', 1)[0].strip()
                    
                    if op_name.lower().startswith('vs '):
                         op_name = op_name[3:].strip()

                    match.opponent_name = op_name

                    # Auto-populate location
                    if not match.location and home_away:
                         clean_ha = home_away.strip().lower()
                         if clean_ha == 'home' or clean_ha == 'h':
                             match.location = 'Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA'
                    
                    match.save()
                    matches_map[col_idx] = match
                
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
                    player = Player.objects.filter(name=player_name).first()
                    
                    # Check for Alias if direct match not found
                    if not player:
                        alias = PlayerAlias.objects.filter(name=player_name).first()
                        if alias:
                            player = alias.player

                    if not player:
                        player = Player.objects.create(name=player_name)
                        print(f"Creating Player: {player_name}")
                    
                    player.sheet_row = row_idx + 1 
                    player.save()
                    
                    # Sync Availability
                    for col_idx, match in matches_map.items():
                        status = row_data[col_idx] if col_idx < len(row_data) else ''
                        
                        if not status:
                            continue
                            
                        availability, _ = Availability.objects.get_or_create(
                            player=player, 
                            match=match
                        )
                        
                        availability.status = status
                        availability.save()
            
            print("Players and Availabilities Synced.")
            return True

        except Exception as e:
            print(f"Error syncing master data: {e}")
            return False

    def sync_team_selections(self, team_season_id):
        """
        Syncs detailed team selections using Batch API to avoid Rate Limits.
        Scopes to the specific TeamSeason.
        """
        print(f"Syncing Team Selections (Batch Mode) for Context {team_season_id}...")
        
        # Context
        try:
            team_season = TeamSeason.objects.get(id=team_season_id)
        except TeamSeason.DoesNotExist:
            return
        
        # Filter matches by this context
        matches = Match.objects.filter(team_season_id=team_season.id)
        
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
        with transaction.atomic():
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
                     TeamSelection.objects.filter(match=match).delete()
                     
                     # Identify Format from DB
                     template_type = all_values[0][1] if len(all_values) > 0 and len(all_values[0]) > 1 else ""
                     t_type = str(template_type).strip() if template_type else ""
                     
                     # Fetch all formats to check against keys
                     formats = MatchFormat.objects.all()
                     selected_format = None
                     
                     # Find matching format by key
                     for fmt in formats:
                         if fmt.spreadsheet_key and fmt.spreadsheet_key in t_type:
                             selected_format = fmt
                             break
                     
                     # Fallback to Standard
                     if not selected_format:
                         selected_format = MatchFormat.objects.filter(name="Standard 15s").first()
                     
                     if selected_format:
                         match.format = selected_format
                         match.save()
                         periods_config = selected_format.column_config or [[1, "B"]]
                     else:
                         periods_config = [[1, "B"]]

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
                                 player = Player.objects.filter(name=player_name.strip()).first()
                                 
                                 if not player:
                                     alias = PlayerAlias.objects.filter(name=player_name.strip()).first()
                                     if alias: player = alias.player

                                 if not player:
                                     player = Player.objects.create(name=player_name.strip())

                                 TeamSelection.objects.create(
                                     match=match,
                                     player=player,
                                     position_number=pos_idx - 4 + 1,
                                     role='Starter',
                                     period=period_num
                                 )

                         # Sync Finishers (Rows 20-34 -> indices 19-33)
                         for pos_idx in range(19, 34):
                             if pos_idx >= len(all_values): break
                             row = all_values[pos_idx]
                             player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                             
                             if player_name and player_name.strip():
                                 player = Player.objects.filter(name=player_name.strip()).first()
                                 
                                 if not player:
                                     alias = PlayerAlias.objects.filter(name=player_name.strip()).first()
                                     if alias: player = alias.player

                                 if not player:
                                     player = Player.objects.create(name=player_name.strip())

                                 TeamSelection.objects.create(
                                     match=match,
                                     player=player,
                                     position_number=pos_idx - 19 + 16,
                                     role='Finisher',
                                     period=period_num
                                 )

                 except Exception as e:
                     print(f"  - Error syncing {match.name}: {e}")
                     # In batch mode, maybe we don't rollback everything?
                     # But we are in a transaction block. 
                     # Let's catch and continue for other matches if one fails?
                     # But atomic exits on error.
                     pass 
        
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
             
             with transaction.atomic():
                 # Process Data (Logic refined for multi-period)
                 
                 # Clear existing
                 TeamSelection.objects.filter(match=match).delete()
                 
                 # Identify Format from DB
                 template_type = data[0][1] if len(data) > 0 and len(data[0]) > 1 else ""
                 t_type = str(template_type).strip() if template_type else ""
                 
                 print(f"  - Template Type: {t_type}")
                 
                 # Fetch all formats to check against keys
                 formats = MatchFormat.objects.all()
                 selected_format = None
                 
                 # Find matching format by key
                 for fmt in formats:
                     if fmt.spreadsheet_key and fmt.spreadsheet_key in t_type:
                         selected_format = fmt
                         break
                 
                 # Fallback to Standard if not found
                 if not selected_format:
                     selected_format = MatchFormat.objects.filter(name="Standard 15s").first()
                     
                 if selected_format:
                     match.format = selected_format
                     match.save()
                     periods_config = selected_format.column_config or [[1, "B"]]
                     print(f"  - Detected Format: {selected_format.name}")
                 else:
                     print("  - WARNING: No matching or default format found. Defaulting to B col.")
                     periods_config = [[1, "B"]]

                 def col_letter_to_index(col_letter):
                    num = 0
                    for c in col_letter:
                        if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                            num = num * 26 + (ord(c) - ord('A')) + 1
                    return num - 1
                 
                 for period_num, col_letter in periods_config:
                     name_col_idx = col_letter_to_index(col_letter)
                     print(f"  - Syncing Period {period_num} from Column {col_letter}")

                     # Sync Starters (Rows 5-19 -> indices 4-18)
                     for pos_idx in range(4, 19):
                         if pos_idx >= len(data): break
                         row = data[pos_idx]
                         player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                         
                         if player_name and player_name.strip():
                             player = Player.objects.filter(name=player_name.strip()).first()
                             if not player:
                                 alias = PlayerAlias.objects.filter(name=player_name.strip()).first()
                                 if alias: player = alias.player

                             if not player:
                                 player = Player.objects.create(name=player_name.strip())
                                 
                             TeamSelection.objects.create(
                                 match=match,
                                 player=player,
                                 position_number=pos_idx - 4 + 1,
                                 role='Starter',
                                 period=period_num
                             )

                     # Sync Finishers (Rows 20-34 -> indices 19-33)
                     for pos_idx in range(19, 34):
                         if pos_idx >= len(data): break
                         row = data[pos_idx]
                         player_name = row[name_col_idx] if len(row) > name_col_idx else ''
                         
                         if player_name and player_name.strip():
                             player = Player.objects.filter(name=player_name.strip()).first()
                             if not player:
                                 alias = PlayerAlias.objects.filter(name=player_name.strip()).first()
                                 if alias: player = alias.player

                             if not player:
                                 player = Player.objects.create(name=player_name.strip())

                             TeamSelection.objects.create(
                                 match=match,
                                 player=player,
                                 position_number=pos_idx - 19 + 16,
                                 role='Finisher',
                                 period=period_num
                             )
                 
                 print(f"Match {match.name} Synced Successfully.")
                 return True

        except Exception as e:
             print(f"Error syncing single match: {e}")
             return False
