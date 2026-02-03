"""
Rugby Team Sheet Sidecar - Main Flask Application
Transforms Google Sheets data into professional team sheet graphics
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from services.sheets_service import SheetsService
from services.oauth_service import OAuthService
import os
from dotenv import load_dotenv
from datetime import datetime

from models import db, Match, Player, TeamSelection, Availability, Team, Season, TeamSeason

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Allow HTTP for OAuth in development (localhost only)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

# Explicitly set instance path to backend/instance
backend_dir = os.path.dirname(os.path.abspath(__file__))
instance_path = os.path.join(backend_dir, 'instance')

app = Flask(__name__, instance_path=instance_path, instance_relative_config=True)
CORS(app, supports_credentials=True) # Enable CORS for all domains for development

app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Database Config

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///teamsheets.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Create tables and default admin
with app.app_context():
    db.create_all()
    from models import User
    if not User.query.filter_by(username='admin').first():
        user = User(username='admin')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
        print("Created default admin user")

# Initialize services
sheets_service = SheetsService()
oauth_service = OAuthService()

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

@app.route('/')
@app.route('/api/')
def index():
    """Main application API root"""
    return jsonify({'status': 'online', 'message': 'TeamSheets Backend API is running. Use the Frontend to interact.'})

@app.route('/api/auth/status')
def auth_status():
    """Check authentication status"""
    return jsonify({
        'authenticated': sheets_service.is_authenticated(),
        'has_credentials': oauth_service.is_authenticated()
    })

@app.route('/auth/login')
def auth_login():
    """Start OAuth authentication flow"""
    flow = oauth_service.get_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    session['state'] = state
    return redirect(authorization_url)

@app.route('/oauth/callback')
def oauth_callback():
    """OAuth callback handler"""
    flow = oauth_service.get_flow()
    flow.fetch_token(authorization_response=request.url)
    
    # Store credentials
    credentials = flow.credentials
    oauth_service.save_credentials(credentials)
    
    # Reinitialize sheets service with new credentials
    sheets_service._initialize_sheet()
    
    return redirect(url_for('index'))

@app.route('/auth/logout')
def auth_logout():
    """Revoke authentication"""
    oauth_service.revoke_credentials()
    sheets_service._initialize_sheet()
    return redirect(url_for('index'))

@app.route('/api/worksheets')
def get_worksheets():
    """Get list of all worksheets in the Google Sheet"""
    try:
        worksheets = sheets_service.get_worksheets()
        return jsonify({'success': True, 'worksheets': worksheets})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/worksheet/<worksheet_name>')
def get_worksheet_data(worksheet_name):
    """Get data from a specific worksheet"""
    try:
        # Get template type from cell B1
        template_type = sheets_service.get_cell_value(worksheet_name, 'B1')
        
        if not template_type:
            return jsonify({
                'success': False, 
                'error': f'Could not find worksheet "{worksheet_name}". Please check if the worksheet exists and cell B1 contains the template type.'
            }), 404
        
        # Determine column based on template type
        column = sheets_service.get_column_for_template(template_type)
        
        # Get player data
        starters = sheets_service.get_player_data(worksheet_name, column, 5, 19)  # Rows 5-19
        finishers = sheets_service.get_player_data(worksheet_name, column, 20, 34)  # Rows 20-34
        
        # Get fixture info (home/away, date) from Selection tab
        fixture_info = sheets_service.get_fixture_info(worksheet_name)
        
        # OVEERRIDE with Database Metadata if available (allows local edits to persist in Generator)
        db_match = Match.query.filter_by(name=worksheet_name).first()
        metadata_override = {}
        if db_match:
            if db_match.kickoff_time: metadata_override['kickoff'] = db_match.kickoff_time
            if db_match.meet_time: metadata_override['meet_time'] = db_match.meet_time
            if db_match.location: metadata_override['location'] = db_match.location
            if db_match.is_cancelled: fixture_info['is_cancelled'] = True
            
        return jsonify({
            'success': True,
            'template_type': template_type,
            'starters': starters,
            'finishers': finishers,
            'fixture_info': fixture_info,
            'metadata': metadata_override
        })
    except ValueError as e:
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/player-image/<player_name>')
def get_player_image(player_name):
    """Get player image path or fallback"""
    clean_name = player_name.lower().replace("'", "")
    parts = clean_name.split()
    
    candidates = []
    
    # Strategy 1: Subdirectories (e.g. lea-bertie/head.png)
    if len(parts) >= 2:
        surname = parts[-1]
        forename = parts[0]
        # candidate 1: surname-forename (observed convention)
        candidates.append(f"/static/players/{surname}-{forename}/head.png")
        # candidate 2: forename-surname (plausible alternative)
        candidates.append(f"/static/players/{forename}-{surname}/head.png")

    # Strategy 2: Flat file (legacy)
    slugified = clean_name.replace(' ', '-')
    candidates.append(f"/static/players/{slugified}.png")
    
    for url in candidates:
        # Check if file exists relative to CWD
        local_path = url.lstrip('/')
        if os.path.exists(local_path):
            return jsonify({'success': True, 'image_url': url})
    
    # Fallback to silhouette
    return jsonify({'success': True, 'image_url': '/static/pitch-assets/player-silhouette.png'})

@app.route('/assets/players/<path:filename>')
def legacy_player_image(filename):
    """Serve a fallback silhouette for legacy /assets/players/*.png requests.

    Some clients request player images from /assets/players/{slug}.png. We don't
    maintain per-player headshots yet, so always return the generic silhouette
    to avoid repeated 404 spam in the browser console.
    """
    return send_from_directory(silhouette_dir, 'player-silhouette.png')

from services.sync_service import SyncService

@app.route('/api/sync')
def sync_db_route():
    """Trigger database sync from browser (where we have auth session)"""
    if not sheets_service.is_authenticated():
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    team_season_id = request.args.get('team_season_id')
    if not team_season_id:
         return jsonify({'success': False, 'error': 'Missing team_season_id'}), 400
        
    print(f"Starting Database Sync via API for Context {team_season_id}...")
    sync_service = SyncService(sheets_service)
    
    # 1. Sync Master Data (Players, Matches, Availabilities)
    if sync_service.sync_master_data(team_season_id):
        # 2. Sync Detail Data (Team Selections)
        sync_service.sync_team_selections(team_season_id)
        return jsonify({'success': True, 'message': 'Database Sync Complete!'})
    else:
        return jsonify({'success': False, 'error': 'Sync Failed'}), 500

# --- Database Browser API ---

# from models import Match, Player, TeamSelection, Availability (Moved to top)

@app.route('/api/contexts')
def get_contexts():
    """Get available Team/Season contexts"""
    try:
        contexts = TeamSeason.query.all()
        result = [c.to_dict() for c in contexts]
        return jsonify({'success': True, 'contexts': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# --- Team Management APIs ---

@app.route('/api/teams', methods=['GET', 'POST'])
def manage_teams():
    if request.method == 'GET':
        teams = Team.query.all()
        return jsonify({'success': True, 'teams': [t.to_dict() for t in teams]})
    
    if request.method == 'POST':
        data = request.json
        if not data or 'name' not in data:
            return jsonify({'success': False, 'error': 'Team name is required'}), 400
        
        team = Team(name=data['name'], logo_url=data.get('logo_url'))
        db.session.add(team)
        db.session.commit()
        return jsonify({'success': True, 'team': team.to_dict()})

@app.route('/api/teams/<int:team_id>', methods=['GET', 'PUT', 'DELETE'])
def update_team(team_id):
    team = Team.query.get_or_404(team_id)
    
    if request.method == 'GET':
        return jsonify({'success': True, 'team': team.to_dict()})
    
    if request.method == 'PUT':
        data = request.json
        team.name = data.get('name', team.name)
        team.logo_url = data.get('logo_url', team.logo_url)
        db.session.commit()
        return jsonify({'success': True, 'team': team.to_dict()})

@app.route('/api/seasons', methods=['GET', 'POST'])
def manage_seasons():
    if request.method == 'GET':
        seasons = Season.query.order_by(Season.name.desc()).all()
        return jsonify({'success': True, 'seasons': [s.to_dict() for s in seasons]})

    if request.method == 'POST':
        data = request.json
        season = Season(name=data['name'], is_current=data.get('is_current', False))
        if season.is_current:
             # Unset other currents
             Season.query.update({Season.is_current: False})
        db.session.add(season)
        db.session.commit()
        return jsonify({'success': True, 'season': season.to_dict()})

@app.route('/api/team-seasons', methods=['POST'])
def manage_team_seasons():
    data = request.json
    try:
        # Check if exists
        exists = TeamSeason.query.filter_by(team_id=data['team_id'], season_id=data['season_id']).first()
        if exists:
            return jsonify({'success': False, 'error': 'Link already exists'}), 400

        ts = TeamSeason(
            team_id=data['team_id'],
            season_id=data['season_id'],
            spreadsheet_id=data['spreadsheet_id']
        )
        db.session.add(ts)
        db.session.commit()
        return jsonify({'success': True, 'team_season': ts.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/team-seasons/<int:ts_id>', methods=['PUT', 'DELETE'])
def manage_team_season_item(ts_id):
    ts = TeamSeason.query.get_or_404(ts_id)
    
    if request.method == 'DELETE':
        db.session.delete(ts)
        db.session.commit()
        return jsonify({'success': True})

    if request.method == 'PUT':
        data = request.json
        ts.spreadsheet_id = data.get('spreadsheet_id', ts.spreadsheet_id)
        # Maybe allow changing season?
        if 'season_id' in data:
            ts.season_id = data['season_id']
        db.session.commit()
        return jsonify({'success': True, 'team_season': ts.to_dict()})

# --- Player Management APIs ---

@app.route('/api/players', methods=['GET', 'POST'])
def manage_players():
    if request.method == 'GET':
        # Simple global list for now. 
        # Future: Filter by team selections if needed.
        players = Player.query.order_by(Player.name).all()
        return jsonify({'success': True, 'players': [p.to_dict() for p in players]})

    if request.method == 'POST':
        data = request.json
        if not data or 'name' not in data:
             return jsonify({'success': False, 'error': 'Name required'}), 400
        
        # Check duplicate
        exists = Player.query.filter_by(name=data['name']).first()
        if exists:
            return jsonify({'success': False, 'error': 'Player already exists'}), 400

        player = Player(
            name=data['name'],
            position=data.get('position'),
            is_forward=data.get('is_forward', False),
            is_back=data.get('is_back', False)
        )
        db.session.add(player)
        db.session.commit()
        return jsonify({'success': True, 'player': player.to_dict()})

@app.route('/api/db/player/<int:player_id>', methods=['GET'])
def get_player(player_id):
    """Get single player details"""
    try:
        player = Player.query.get_or_404(player_id)
        return jsonify({'success': True, 'player': player.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/players/<int:p_id>', methods=['PUT', 'DELETE'])
def manage_player_item(p_id):
    player = Player.query.get_or_404(p_id)
    
    if request.method == 'DELETE':
        db.session.delete(player)
        db.session.commit()
        return jsonify({'success': True})

    if request.method == 'PUT':
        data = request.json
        player.name = data.get('name', player.name)
        player.position = data.get('position', player.position)
        if 'is_forward' in data: player.is_forward = data['is_forward']
        if 'is_back' in data: player.is_back = data['is_back']
        
        db.session.commit()
        return jsonify({'success': True, 'player': player.to_dict()})

# --- Fixture Management APIs ---

@app.route('/api/match-formats', methods=['GET'])
def get_match_formats():
    from models import MatchFormat
    formats = MatchFormat.query.all()
    return jsonify({'success': True, 'formats': [f.to_dict() for f in formats]})

@app.route('/api/fixtures', methods=['GET', 'POST'])
def manage_fixtures():
    if request.method == 'GET':
        ts_id = request.args.get('team_season_id')
        query = Match.query
        if ts_id:
            query = query.filter_by(team_season_id=ts_id)
        
        matches = query.order_by(Match.date).all()
        return jsonify({'success': True, 'fixtures': [m.to_dict() for m in matches]})

    if request.method == 'POST':
        data = request.json
        if not data or 'team_season_id' not in data:
             return jsonify({'success': False, 'error': 'Team Season ID required'}), 400
        
        match = Match(
            team_season_id=data['team_season_id'],
            name=data.get('name', 'New Fixture'),
            date=datetime.strptime(data['date'], '%Y-%m-%d').date() if data.get('date') else None,
            home_away=data.get('home_away', 'Home'),
            kickoff_time=data.get('kickoff_time'),
            meet_time=data.get('meet_time'),
            location=data.get('location'),
            is_cancelled=data.get('is_cancelled', False)
        )
        db.session.add(match)
        db.session.commit()
        return jsonify({'success': True, 'fixture': match.to_dict()})

@app.route('/api/fixtures/<int:m_id>', methods=['PUT', 'DELETE'])
def manage_fixture_item(m_id):
    match = Match.query.get_or_404(m_id)
    
    if request.method == 'DELETE':
        db.session.delete(match)
        db.session.commit()
        return jsonify({'success': True})

    if request.method == 'PUT':
        data = request.json
        if 'name' in data: match.name = data['name']
        if 'date' in data: 
             match.date = datetime.strptime(data['date'], '%Y-%m-%d').date() if data['date'] else None
        if 'home_away' in data: match.home_away = data['home_away']
        if 'kickoff_time' in data: match.kickoff_time = data['kickoff_time']
        if 'meet_time' in data: match.meet_time = data['meet_time']
        if 'location' in data: match.location = data['location']
        if 'is_cancelled' in data: match.is_cancelled = data['is_cancelled']
        
        db.session.commit()
        return jsonify({'success': True, 'fixture': match.to_dict()})

@app.route('/api/db/matches')
def get_db_matches():
    """Get matches filtered by TeamSeason context"""
    try:
        team_season_id = request.args.get('team_season_id')
        
        query = Match.query
        
        if team_season_id:
            query = query.filter_by(team_season_id=team_season_id)
        else:
            # Default to "Current" season if available
            current_season = Season.query.filter_by(is_current=True).first()
            if current_season and current_season.team_seasons:
                 # Just pick the first linked team-season for now? 
                 # Or return all? 
                 # Let's return matches from ALL current season contexts
                 season_ids = [ts.id for ts in current_season.team_seasons]
                 query = query.filter(Match.team_season_id.in_(season_ids))
        
        matches = query.order_by(Match.date.desc()).all()
        result = []
        for m in matches:
            result.append({
                'id': m.id,
                'name': m.name,
                'date': m.date.isoformat() if m.date else None,
                'home_away': m.home_away,
                'kickoff': m.kickoff_time,
                'meet_time': m.meet_time,
                'location': m.location,
                'is_cancelled': m.is_cancelled,
                'team_season_id': m.team_season_id
            })
        return jsonify({'success': True, 'matches': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>', methods=['GET'])
def get_match_details(match_id):
    """Get single match details"""
    try:
        m = Match.query.get_or_404(match_id)
        match_data = {
            'id': m.id,
            'name': m.name,
            'date': m.date.isoformat() if m.date else None,
            'home_away': m.home_away,
            'kickoff_time': m.kickoff_time,
            'meet_time': m.meet_time,
            'location': m.location,
            'is_cancelled': m.is_cancelled,
            'team_season_id': m.team_season_id,
            'format': m.format.to_dict() if m.format else None,
            'opponent_name': m.opponent_name
        }
        return jsonify({
            'success': True, 
            'match': match_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>', methods=['POST'])
def update_match_details(match_id):
    """Update match metadata"""
    try:
        match = Match.query.get_or_404(match_id)
        data = request.json
        
        # Update allowed fields
        if 'kickoff' in data: match.kickoff_time = data['kickoff']
        if 'meet_time' in data: match.meet_time = data['meet_time']
        if 'location' in data: match.location = data['location']
        if 'is_cancelled' in data: match.is_cancelled = bool(data['is_cancelled'])
        if 'opponent_name' in data: match.opponent_name = data['opponent_name']
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Match updated'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>', methods=['GET'])
def get_db_match(match_id):
    """Get single match metadata"""
    try:
        match = Match.query.get_or_404(match_id)
        return jsonify({'success': True, 'match': match.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/player/<int:player_id>', methods=['GET', 'PUT'])
def manage_player_details(player_id):
    """Get or Update player details"""
    try:
        player = Player.query.get_or_404(player_id)
        
        if request.method == 'GET':
            return jsonify({'success': True, 'player': player.to_dict()})
            
        elif request.method == 'PUT':
            data = request.json
            
            if 'name' in data: player.name = data['name']
            if 'position' in data: player.position = data['position']
            
            # Handle left_date
            if 'left_date' in data:
                val = data['left_date']
                if val:
                    try:
                        # Ensure only date part if datetime string passed
                        if 'T' in val: val = val.split('T')[0]
                        player.left_date = datetime.strptime(val, '%Y-%m-%d').date()
                    except ValueError:
                         pass 
                else:
                    player.left_date = None
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Player updated', 'player': player.to_dict()})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>/refresh', methods=['POST'])
def refresh_match_data(match_id):
    """Force refresh of a specific match from Google Sheets"""
    try:
        match = Match.query.get_or_404(match_id)
        if not sheets_service.is_authenticated():
            return jsonify({'success': False, 'error': 'Not authenticated with Google Sheets'}), 401
            
        sync_service = SyncService(sheets_service)
        if sync_service.sync_single_match(match):
            return jsonify({'success': True, 'message': 'Match refreshed successfully'})
        else:
            return jsonify({'success': False, 'error': 'Sync failed (check logs)'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>/team', methods=['GET', 'POST'])
def manage_match_team(match_id):
    """Get or Update team details for a specific match"""
    match = Match.query.get_or_404(match_id)

    if request.method == 'POST':
        try:
            data = request.json
            
            # Clear existing selections for this match
            TeamSelection.query.filter_by(match_id=match_id).delete()
            
            if data.get('multi_period'):
                # Handle Grid Update
                periods_map = data.get('periods', {})
                for p_num, positions in periods_map.items():
                    for pos, p_id in positions.items():
                        if p_id:
                            # Determine Role (Starter 1-15, Finisher 16+)
                            # Simplified logic: 1-15 is Starter
                            pos_int = int(pos)
                            role = 'Starter' if pos_int <= 15 else 'Finisher'
                            
                            sel = TeamSelection(
                                match_id=match_id,
                                player_id=p_id,
                                role=role,
                                period=int(p_num),
                                position_number=pos_int
                            )
                            db.session.add(sel)
            
            else:
                # Legacy / Single Period Fallback
                starters = data.get('starters', [])
                finishers = data.get('substitutes', [])
                
                # Add Starters
                for i, p_id in enumerate(starters):
                    if p_id:
                        sel = TeamSelection(
                            match_id=match_id,
                            player_id=p_id,
                            role='Starter',
                            period=1,
                            position_number=i+1
                        )
                        db.session.add(sel)
                
                # Add Finishers
                for i, p_id in enumerate(finishers):
                    if p_id:
                        sel = TeamSelection(
                            match_id=match_id,
                            player_id=p_id,
                            role='Finisher',
                            period=1,
                            position_number=16+i
                        )
                        db.session.add(sel)
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Team selection saved'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    # GET Method Implementation
    try:
        
        # Format similar to worksheet response
        
        # 1. Starters (Positions 1-15)
        # Note: DB stores position number 1-15 directly
        starters = [{} for _ in range(15)] # Initialize empty slots
        starter_selections = TeamSelection.query.filter_by(match_id=match.id, role='Starter').all()
        finisher_selections = TeamSelection.query.filter_by(match_id=match.id, role='Finisher').all()

        # LAZY SYNC: If no data found, attempt to sync from Sheets immediately
        if not starter_selections and not finisher_selections:
            # Check if we have auth
            if sheets_service.is_authenticated():
                print(f"Lazy Sync: Fetching data for match {match.name}")
                sync_service = SyncService(sheets_service)
                if sync_service.sync_single_match(match):
                    # Re-fetch after sync
                    starter_selections = TeamSelection.query.filter_by(match_id=match.id, role='Starter').all()
                    finisher_selections = TeamSelection.query.filter_by(match_id=match.id, role='Finisher').all()

        # Prepare Multi-Period Data
        periods_data = {}
        
        # Helper to ensure period dict exists
        def get_period_data(p_num):
            if p_num not in periods_data:
                periods_data[p_num] = {
                    'starters': [{} for _ in range(15)],
                    'finishers': [{} for _ in range(7)]
                }
            return periods_data[p_num]

        # Process Starters
        for s in starter_selections:
            if 1 <= s.position_number <= 15:
                p_data = get_period_data(s.period)
                p_data['starters'][s.position_number - 1] = {'id': s.player.id, 'name': s.player.name}
        
        # Process Finishers
        for f in finisher_selections:
            p_data = get_period_data(f.period)
            idx = f.position_number - 16
            
            # Auto-expand finishers list if needed
            while len(p_data['finishers']) <= idx:
                p_data['finishers'].append({})
            
            if idx >= 0:
                p_data['finishers'][idx] = {'id': f.player.id, 'name': f.player.name}

        # Backwards compatibility: Populate root starters/finishers with Period 1 (or empty if no Period 1)
        root_data = periods_data.get(1, {
            'starters': [{} for _ in range(15)], 
            'finishers': [{} for _ in range(7)]
        })
        starters = root_data['starters']
        finishers = root_data['finishers']

        # 3. Metadata
        fixture_info = {
            'home_away': match.home_away,
            'match_date': match.date.strftime('%d/%m/%Y') if match.date else '',
            'is_cancelled': match.is_cancelled,
            'opponent_name': match.opponent_name
        }
        
        metadata = {}
        if match.kickoff_time: metadata['kickoff'] = match.kickoff_time
        if match.meet_time: metadata['meet_time'] = match.meet_time
        if match.location: metadata['location'] = match.location
        
        # Use DB Match Format
        match_format = match.format
        template_type = match_format.spreadsheet_key if match_format else 'Men'
        
        return jsonify({
            'success': True,
            'template_type': template_type,
            'format': match_format.to_dict() if match_format else None,
            'starters': starters,   # Legacy support
            'finishers': finishers, # Legacy support
            'periods': periods_data, # New Multi-Period data
            'fixture_info': fixture_info,
            'metadata': metadata
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>/availability', methods=['GET'])
def get_match_availability(match_id):
    """Get availability for a specific match"""
    try:
        match = Match.query.get_or_404(match_id)
        avails = Availability.query.filter_by(match_id=match_id).all()
        
        # If no availability found, maybe lazy sync?
        if not avails and sheets_service.is_authenticated():
             # Check if we should sync
             pass 

        result = []
        for a in avails:
            result.append({
                'player_id': a.player_id,
                'name': a.player.name,
                'status': a.status
            })
            
        return jsonify({'success': True, 'availability': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/players')
def get_db_players():
    """Get all players from local DB"""
    try:
        players = Player.query.order_by(Player.name).all()
        result = []
        for p in players:
            # Simple stats could be added here (e.g. caps count)
            caps = TeamSelection.query.filter_by(player_id=p.id).count()
            result.append({
                'id': p.id,
                'name': p.name,
                'caps': caps,
                'position': p.position,
                'left_date': p.left_date.isoformat() if p.left_date else None
            })
        return jsonify({'success': True, 'players': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Register Sync Command (Keep for reference/future use if we add server-side auth)
@app.cli.command("sync-db")
def sync_db_command():
    """Synchronize database with Google Sheets master data for ALL contexts"""
    print("Starting Database Sync...")
    sync_service = SyncService(sheets_service)
    
    contexts = TeamSeason.query.all()
    if not contexts:
        print("No TeamSeason contexts found.")
        return

    for ts in contexts:
        print(f"\n--- Syncing Context: {ts} ---")
        # 1. Sync Master Data (Players, Matches, Availabilities)
        if sync_service.sync_master_data(ts.id):
            print("Master Data Synced Successfully.")
            
            # 2. Sync Detail Data (Team Selections)
            print("Syncing Team Selections (this may take a while)...")
            sync_service.sync_team_selections(ts.id)
            print("Context Sync Complete!")
        else:
            print("Sync Failed for this context.")
    
    print("\nGlobal Database Sync Complete!")

# --- Auth Routes ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    from models import User
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'success': True, 'user': user.to_dict()})
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/me', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        # permissions = [p.to_dict() for p in current_user.team_permissions]
        permissions = []
        user_data = current_user.to_dict()
        user_data['permissions'] = permissions
        return jsonify({'authenticated': True, 'user': user_data})
    return jsonify({'authenticated': False})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
