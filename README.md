# Rugby Team Sheet Sidecar

A web application that transforms Google Sheets data into professional, social-media-ready rugby team sheet graphics.

## Features

- **OAuth Authentication**: Secure Google Sheets integration using OAuth 2.0
- **Template Detection**: Automatically detects match templates (Thirds, Quarters, Halves)
- **SVG Graphics**: High-quality, scalable team sheet generation
- **Player Management**: Automatic player image mapping with fallback silhouettes
- **Export Functionality**: High-resolution PNG export for social media
- **Docker Ready**: Containerized deployment support

## Setup

### 1. Google Cloud Console Setup

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API and Google Drive API
3. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:5000/oauth/callback`
   - Note your Client ID and Client Secret

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `GOOGLE_CLIENT_ID`: Your OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your OAuth client secret
- `GOOGLE_SHEET_ID`: Your Google Sheet ID (from URL)
- `FLASK_SECRET_KEY`: Generate a secure secret key

### 3. Installation & Running

```bash
# Install dependencies
uv sync

# Run development server
uv run python app.py
```

The application will be available at http://localhost:5000

### 4. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Usage

1. **Authenticate**: Click "Connect to Google Sheets" and authorize access
2. **Select Match**: Choose a worksheet from your Google Sheet
3. **Customize**: Adjust metadata and select featured player
4. **Export**: Download high-resolution PNG for social media

## Google Sheet Structure

Your Google Sheet should follow this format:

- **Cell B1**: Template type ("Single Match - Quarters", "Single Match - Halves", "Single Match - Thirds")
- **Column H**: Player names for Quarters matches
- **Column U**: Player names for Halves matches  
- **Column AB**: Player names for Thirds matches
- **Rows 5-19**: Starting players (15 players)
- **Rows 20-34**: Substitute players (up to 15 players)

## Player Images

Place player headshots in `/static/players/` with naming convention:
- Format: `player-name.png` (lowercase, hyphens instead of spaces)
- Example: `john-smith.png`

Missing images will automatically use a player silhouette fallback.

## Development

The application includes mock data that works without Google Sheets setup, allowing you to test the UI and functionality immediately.

## Security Notes

- Never commit `.env` files or credentials to version control
- Use HTTPS in production for OAuth callbacks
- Regularly rotate your OAuth client secrets
- Limit API access to necessary scopes only

## License

MIT License - see LICENSE file for details