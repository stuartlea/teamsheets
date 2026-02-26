# Rugby Team Sheets

A professional web application for managing rugby team selections and generating social-media-ready graphics.

## Architecture

- **Backend**: Django REST Framework (Python 3.14)
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: SQLite (default)
- **Integration**: Spond API for availability and event management.

## Features

- **Team Management**: Create and manage multiple teams and seasons.
- **Spond Sync**: Automatically synchronize player availability and match details from Spond.
- **Lineup Builder**: Drag-and-drop interface for building match-day lineups.
- **Graphic Generation**: Generate high-reousltion PNG graphics for social media (Standard & Mobile formats).
- **Player Database**: Maintain a database of players with automatic image mapping.

## Setup

### Development

1. **Backend Setup**:
   ```bash
   cd backend
   uv sync
   # Set up environment variables in .env
   uv run python manage.py migrate
   uv run python manage.py runserver
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Deployment & Upgrades

### Initial Build
```bash
docker-compose up --build -d
```

### Upgrading to a New Version
When you have new code or database changes:
1. `git pull`
2. `docker-compose build`
3. `docker-compose up -d`
4. `docker-compose exec backend uv run python manage.py migrate`

For detailed steps, see the [upgrade workflow](file:///home/stuart/Development/TeamSheets/_agents/workflows/upgrade.md).

## Environment Variables

The following variables are required in your `.env` file (root or `backend/`):

- `SPOND_USERNAME`: Your Spond account email.
- `SPOND_PASSWORD`: Your Spond account password.
- `GOOGLE_SHEET_ID`: (Legacy) ID of the Google Sheet if still using sheet sync.
- `SECRET_KEY`: Django secret key.

## Static Assets

Player headshots should be placed in `backend/static/players/`.
- Format: `surname-forename/head.png` or `firstname-lastname.png`

## License

MIT License