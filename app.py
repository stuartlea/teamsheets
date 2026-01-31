"""
Rugby Team Sheet Sidecar - Main Flask Application
Transforms Google Sheets data into professional team sheet graphics
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory
from services.sheets_service import SheetsService
from services.oauth_service import OAuthService
import os
from dotenv import load_dotenv

from models import db, Match, Player, TeamSelection, Availability

# Load environment variables from .env file
load_dotenv()

# Allow HTTP for OAuth in development (localhost only)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Database Config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///teamsheets.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

# Initialize services
sheets_service = SheetsService()
oauth_service = OAuthService()

@app.route('/')
def index():
    """Main application page"""
    return render_template('index.html')

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
        
    print("Starting Database Sync via API...")
    sync_service = SyncService(sheets_service)
    
    # 1. Sync Master Data (Players, Matches, Availabilities)
    if sync_service.sync_master_data():
        # 2. Sync Detail Data (Team Selections)
        sync_service.sync_team_selections()
        return jsonify({'success': True, 'message': 'Database Sync Complete!'})
    else:
        return jsonify({'success': False, 'error': 'Sync Failed'}), 500

# --- Database Browser API ---

# from models import Match, Player, TeamSelection, Availability (Moved to top)

@app.route('/api/db/matches')
def get_db_matches():
    """Get all matches from local DB"""
    try:
        matches = Match.query.order_by(Match.date.desc()).all()
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
                'is_cancelled': m.is_cancelled
            })
        return jsonify({'success': True, 'matches': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/db/match/<int:match_id>', methods=['GET'])
def get_match_details(match_id):
    """Get single match details"""
    try:
        m = Match.query.get_or_404(match_id)
        return jsonify({
            'success': True, 
            'match': {
                'id': m.id,
                'name': m.name,
                'date': m.date.isoformat() if m.date else None,
                'home_away': m.home_away,
                'kickoff': m.kickoff_time,
                'meet_time': m.meet_time,
                'location': m.location,
                'is_cancelled': m.is_cancelled
            }
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
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Match updated'})
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

@app.route('/api/db/match/<int:match_id>/team', methods=['GET'])
def get_db_match_team(match_id):
    """Get full team details from DB for a specific match"""
    try:
        match = Match.query.get_or_404(match_id)
        
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
                p_data['starters'][s.position_number - 1] = {'name': s.player.name}
        
        # Process Finishers
        for f in finisher_selections:
            p_data = get_period_data(f.period)
            idx = f.position_number - 16
            
            # Auto-expand finishers list if needed
            while len(p_data['finishers']) <= idx:
                p_data['finishers'].append({})
            
            if idx >= 0:
                p_data['finishers'][idx] = {'name': f.player.name}

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
            'is_cancelled': match.is_cancelled
        }
        
        metadata = {}
        if match.kickoff_time: metadata['kickoff'] = match.kickoff_time
        if match.meet_time: metadata['meet_time'] = match.meet_time
        if match.location: metadata['location'] = match.location
        
        return jsonify({
            'success': True,
            'template_type': 'Men', # Defaulting to Men for now, or could store in Match model
            'starters': starters,   # Legacy support
            'finishers': finishers, # Legacy support
            'periods': periods_data, # New Multi-Period data
            'fixture_info': fixture_info,
            'metadata': metadata
        })
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
                'caps': caps
            })
        return jsonify({'success': True, 'players': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Register Sync Command (Keep for reference/future use if we add server-side auth)
@app.cli.command("sync-db")
def sync_db_command():
    """Synchronize database with Google Sheets master data"""
    print("Starting Database Sync...")
    sync_service = SyncService(sheets_service)
    
    # 1. Sync Master Data (Players, Matches, Availabilities)
    if sync_service.sync_master_data():
        print("Master Data Synced Successfully.")
        
        # 2. Sync Detail Data (Team Selections)
        print("Syncing Team Selections (this may take a while)...")
        sync_service.sync_team_selections()
        print("Database Sync Complete!")
    else:
        print("Sync Failed.")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
