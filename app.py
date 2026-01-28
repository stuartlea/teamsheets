"""
Rugby Team Sheet Sidecar - Main Flask Application
Transforms Google Sheets data into professional team sheet graphics
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory
from services.sheets_service import SheetsService
from services.oauth_service import OAuthService
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Allow HTTP for OAuth in development (localhost only)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

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
        
        return jsonify({
            'success': True,
            'template_type': template_type,
            'starters': starters,
            'finishers': finishers,
            'fixture_info': fixture_info
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
    # Slugify player name to match filename convention
    slugified = player_name.lower().replace(' ', '-').replace("'", "")
    image_path = f"/static/players/{slugified}.png"
    
    # Check if file exists
    full_path = os.path.join(app.static_folder, 'players', f"{slugified}.png")
    if os.path.exists(os.path.join('static', image_path.lstrip('/'))):
        return jsonify({'success': True, 'image_url': image_path})
    
    # Fallback to silhouette
    return jsonify({'success': True, 'image_url': '/static/pitch-assets/player-silhouette.png'})

@app.route('/assets/players/<path:filename>')
def legacy_player_image(filename):
    """Serve a fallback silhouette for legacy /assets/players/*.png requests.

    Some clients request player images from /assets/players/{slug}.png. We don't
    maintain per-player headshots yet, so always return the generic silhouette
    to avoid repeated 404 spam in the browser console.
    """
    silhouette_dir = os.path.join(app.root_path, 'static', 'pitch-assets')
    return send_from_directory(silhouette_dir, 'player-silhouette.png')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
