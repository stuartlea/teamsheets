"""
Google Sheets integration service for Rugby Team Sheet Sidecar
Handles data extraction and template detection logic
"""

import gspread
import os
from .oauth_service import OAuthService

class SheetsService:
    def __init__(self):
        self.oauth_service = OAuthService()
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID', '')
        self.sheet = None
        
        # Lazy initialization: Do not connect on startup
        # self._initialize_sheet()
    
    def _initialize_sheet(self, spreadsheet_id=None):
        """Initialize Google Sheets connection"""
        target_id = spreadsheet_id or self.sheet_id
        try:
            client = self.oauth_service.get_sheets_client()
            if client and target_id:
                self.sheet = client.open_by_key(target_id)
                print(f"Connected to Google Sheet: {target_id}")
        except Exception as e:
            error_str = str(e)
            print(f"Warning: Could not initialize Google Sheets ({target_id}): {error_str}")
            
            # Check for expired/revoked token
            if 'invalid_grant' in error_str or 'Token has been expired' in error_str:
                print("Token expired or revoked. Clearing credentials to force re-auth.")
                self.oauth_service.revoke_credentials()
                self.sheet = None
    
    def is_authenticated(self):
        """Check if Google Sheets is authenticated"""
        return self.oauth_service.is_authenticated()
    
    def get_worksheets(self):
        """Get list of matches from MATCH_LIST named range"""
        if not self.oauth_service.is_authenticated():
            # Return mock data for development
            return ['Match 1 - Quarters', 'Match 2 - Halves', 'Match 3 - Thirds']
        
        # Re-initialize sheet connection if needed
        if not self.sheet and self.sheet_id:
            self._initialize_sheet()
        
        if not self.sheet:
            # Return mock data if still no connection
            return ['Match 1 - Quarters', 'Match 2 - Halves', 'Match 3 - Thirds']
        
        try:
            # Try to get MATCH_LIST by named range first
            try:
                worksheet = self.sheet.worksheet('Selection')
                match_list = worksheet.range('O1:AU1')
                matches = [cell.value for cell in match_list if cell.value and cell.value.strip()]
                print(f"Successfully fetched MATCH_LIST by range: {matches}")
                return matches
            except Exception as e:
                print(f"Warning: Could not fetch MATCH_LIST range: {e}")
                # Fallback to worksheet names if MATCH_LIST doesn't exist
                worksheets = [worksheet.title for worksheet in self.sheet.worksheets()]
                print(f"Falling back to worksheet names: {worksheets}")
                return worksheets
        except Exception as e:
            print(f"Warning: Could not fetch MATCH_LIST: {e}")
            # Fallback to worksheet names if MATCH_LIST doesn't exist
            try:
                worksheets = [worksheet.title for worksheet in self.sheet.worksheets()]
                print(f"Falling back to worksheet names: {worksheets}")
                return worksheets
            except Exception as e2:
                print(f"Warning: Could not fetch worksheets: {e2}")
                return ['Match 1 - Quarters', 'Match 2 - Halves', 'Match 3 - Thirds']
    
    def get_cell_value(self, worksheet_name, cell_address):
        """Get value from specific cell"""
        if not self.is_authenticated():
            # Return mock data for development
            mock_data = {
                'B1': 'Single Match - Quarters',
                'B2': '15:00',
                'B3': '13:30',
                'B4': 'Home Ground'
            }
            return mock_data.get(cell_address, '')
        
        # worksheet_name is actually the match name, find the corresponding worksheet
        worksheet = self.find_worksheet_for_match(worksheet_name)
        if not worksheet:
            raise ValueError(f"Worksheet not found for match: {worksheet_name}")
        
        return worksheet.acell(cell_address).value
    
    def get_column_for_template(self, template_type):
        """Determine which column to extract based on template type"""
        template_mapping = {
            'Single Match - Thirds': 'AB',
            'Thirds': 'AB',
            'Single Match - Quarters': 'H',
            'Quarters': 'H',
            'Single Match - Halves': 'U',
            'Halves': 'U'
        }
        
        return template_mapping.get(template_type, 'H')  # Default to column H
    
    def get_player_data(self, worksheet_name, column, start_row, end_row):
        """Extract player names from specified column and row range"""
        if not self.is_authenticated():
            # Return mock data for development
            mock_players = [
                'John Smith', 'Mike Johnson', 'David Williams', 'James Brown',
                'Robert Jones', 'Michael Davis', 'William Miller', 'Richard Wilson',
                'Thomas Moore', 'Charles Taylor', 'Joseph Anderson', 'Chris Thomas',
                'Daniel Jackson', 'Matthew White', 'Anthony Harris'
            ]
            
            players = []
            for i, name in enumerate(mock_players[:end_row - start_row + 1]):
                if start_row + i - 1 < len(mock_players):
                    players.append({
                        'name': mock_players[start_row + i - 1],
                        'row': start_row + i,
                        'position': i + 1
                    })
            return players
        
        # worksheet_name is actually the match name, find the corresponding worksheet
        worksheet = self.find_worksheet_for_match(worksheet_name)
        if not worksheet:
            raise ValueError(f"Worksheet not found for match: {worksheet_name}")
        
        players = []
        
        for row in range(start_row, end_row + 1):
            cell_address = f"{column}{row}"
            player_name = worksheet.acell(cell_address).value
            
            if player_name and player_name.strip():  # Skip empty cells
                players.append({
                    'name': player_name.strip(),
                    'row': row,
                    'position': len(players) + 1  # Position based on order
                })
        
        return players
    
    def find_worksheet_for_match(self, match_name):
        """Find the worksheet that corresponds to a match name"""
        if not self.sheet:
            return None
        
        # Try to find worksheet with exact match name
        try:
            return self.sheet.worksheet(match_name)
        except gspread.exceptions.WorksheetNotFound:
            pass
        
        # If not found, try to find worksheet containing the match name
        for worksheet in self.sheet.worksheets():
            if match_name.lower() in worksheet.title.lower() or worksheet.title.lower() in match_name.lower():
                return worksheet
        
        return None
    
    def get_worksheet_metadata(self, worksheet_name):
        """Get metadata like kick-off time, location, etc."""
        if not self.is_authenticated():
            # Return mock data for development
            return {
                'kickoff': '15:00',
                'meet_time': '13:30',
                'location': 'Home Ground',
                'custom_title': ''
            }
        
        # worksheet_name is actually the match name, find the corresponding worksheet
        worksheet = self.find_worksheet_for_match(worksheet_name)
        if not worksheet:
            raise ValueError(f"Worksheet not found for match: {worksheet_name}")
        
        # TODO: Define actual cell locations for metadata
        metadata = {
            'kickoff': worksheet.acell('B2').value if worksheet.acell('B2').value else '',
            'meet_time': worksheet.acell('B3').value if worksheet.acell('B3').value else '',
            'location': worksheet.acell('B4').value if worksheet.acell('B4').value else '',
            'custom_title': worksheet.acell('B5').value if worksheet.acell('B5').value else ''
        }
        
        return metadata

    def get_fixture_info(self, fixture_name):
        """Get fixture info (home/away, date) from Selection tab by finding the column with the fixture name in row 1"""
        if not self.is_authenticated():
            # Return mock data for development
            return {
                'home_away': 'Home',
                'match_date': '2026-01-25'
            }
        
        if not self.sheet:
            self._initialize_sheet()
        
        if not self.sheet:
            return {'home_away': '', 'match_date': ''}
        
        try:
            selection_ws = self.sheet.worksheet('Selection')
            # Get row 1 (fixture names) from O1 to AU1
            row1 = selection_ws.range('O1:AU1')
            
            # Find the column index that matches the fixture name
            col_index = None
            for i, cell in enumerate(row1):
                if cell.value and cell.value.strip() == fixture_name.strip():
                    col_index = i
                    break
            
            if col_index is None:
                return {'home_away': '', 'match_date': ''}
            
            # Calculate the column letter (O is column 15, so col_index 0 = O)
            col_number = 15 + col_index  # O = 15 in 1-indexed
            col_letter = self._col_number_to_letter(col_number)
            
            # Get row 2 (home/away) and row 4 (date)
            home_away = selection_ws.acell(f'{col_letter}2').value or ''
            match_date = selection_ws.acell(f'{col_letter}4').value or ''
            
            return {
                'home_away': home_away.strip() if home_away else '',
                'match_date': match_date.strip() if match_date else ''
            }
        except Exception as e:
            print(f"Warning: Could not get fixture info: {e}")
            return {'home_away': '', 'match_date': ''}
    
    def _col_number_to_letter(self, col_num):
        """Convert column number (1-indexed) to letter(s)"""
        result = ""
        while col_num > 0:
            col_num, remainder = divmod(col_num - 1, 26)
            result = chr(65 + remainder) + result
        return result

    def batch_get_values(self, ranges):
        """Batch fetch values for multiple ranges"""
        if not self.is_authenticated():
            print("Warning: batch_get_values called without auth")
            return []
        
        if not self.sheet:
            self._initialize_sheet()
            
        try:
            # gspread supports values_batch_get but returns raw response dict
            # or use service.spreadsheets().values().batchGet
            return self.sheet.values_batch_get(ranges).get('valueRanges', [])
        except Exception as e:
            print(f"Error in batch_get_values: {e}")
            return []
