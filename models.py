
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Team(db.Model):
    """Represents a rugby team category (e.g. U15s, Men's 1st XV)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    logo_url = db.Column(db.String(255), nullable=True)
    
    # Relationships
    team_seasons = db.relationship('TeamSeason', backref='team', lazy=True)

    def __repr__(self):
        return f'<Team {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'logo_url': self.logo_url
        }

class Season(db.Model):
    """Represents a rugby season (e.g. 2024-2025)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False) # e.g. "2024-2025"
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    is_current = db.Column(db.Boolean, default=False)
    
    # Relationships
    team_seasons = db.relationship('TeamSeason', backref='season', lazy=True)

    def __repr__(self):
        return f'<Season {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_current': self.is_current
        }

class TeamSeason(db.Model):
    """Links a Team to a Season and a specific Google Sheet"""
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    season_id = db.Column(db.Integer, db.ForeignKey('season.id'), nullable=False)
    spreadsheet_id = db.Column(db.String(100), nullable=False) # The distinct Google Sheet ID
    sheet_name = db.Column(db.String(100), nullable=True) # Friendly name if multiple sheets per team/season? Usually just one.
    
    # Relationships
    matches = db.relationship('Match', backref='team_season', lazy=True)

    def __repr__(self):
        return f'<TeamSeason {self.team.name} {self.season.name}>'

    def to_dict(self):
        # Calculate summary stats
        fixture_count = Match.query.filter_by(team_season_id=self.id).count()
        
        # Player count: Unique players selected in matches for this season
        # Using a join: TeamSeason -> Match -> TeamSelection
        player_count = db.session.query(TeamSelection.player_id).join(Match).filter(Match.team_season_id == self.id).distinct().count()
        
        # Next Fixture
        today = datetime.now().date()
        next_fixture = Match.query.filter(
            Match.team_season_id == self.id, 
            Match.date >= today
        ).order_by(Match.date).first()
        
        return {
            'id': self.id,
            'team_id': self.team_id,
            'season_id': self.season_id,
            'spreadsheet_id': self.spreadsheet_id,
            'sheet_name': self.sheet_name,
            'team': self.team.to_dict(),
            'season': self.season.to_dict(),
            'stats': {
                'fixture_count': fixture_count,
                'player_count': player_count,
                'next_fixture': next_fixture.to_dict() if next_fixture else None
            }
        }

class Player(db.Model):
    """Stores player data from the Master sheet. Global pool of players."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    sheet_row = db.Column(db.Integer, nullable=True) # Row index in Master sheet for reference (Legacy/Context specific?)
    # Note: sheet_row might be problematic if a player is in multiple sheets at different rows.
    # ideally we drop sheet_row or make it relative to the TeamSeason context, but for now we keep it simple.
    
    position = db.Column(db.String(50), nullable=True)
    is_forward = db.Column(db.Boolean, default=False)
    is_back = db.Column(db.Boolean, default=False)

    # Relationships
    availabilities = db.relationship('Availability', backref='player', lazy=True)
    selections = db.relationship('TeamSelection', backref='player', lazy=True)

    def __repr__(self):
        return f'<Player {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'sheet_row': self.sheet_row,
            'position': self.position,
            'is_forward': self.is_forward,
            'is_back': self.is_back
        }

class Match(db.Model):
    """Stores match/fixture data linked to a specific TeamSeason"""
    id = db.Column(db.Integer, primary_key=True)
    team_season_id = db.Column(db.Integer, db.ForeignKey('team_season.id'), nullable=True) # Making nullable temporarily to ease migration/dev
    name = db.Column(db.String(100), nullable=False) # e.g. "01: Leek (A)"
    date = db.Column(db.Date, nullable=True)
    home_away = db.Column(db.String(10), nullable=True) # "Home" or "Away"
    sheet_col = db.Column(db.String(5), nullable=True) # Column letter/index in Master sheet
    
    # Metadata gathered during team sheet generation
    kickoff_time = db.Column(db.String(20), nullable=True)
    meet_time = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    is_cancelled = db.Column(db.Boolean, default=False)
    
    # Relationships
    availabilities = db.relationship('Availability', backref='match', lazy=True, cascade="all, delete-orphan")
    team_selections = db.relationship('TeamSelection', backref='match', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Match {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'team_season_id': self.team_season_id,
            'name': self.name,
            'date': self.date.isoformat() if self.date else None,
            'home_away': self.home_away,
            'kickoff_time': self.kickoff_time,
            'meet_time': self.meet_time,
            'location': self.location,
            'is_cancelled': self.is_cancelled
        }

class Availability(db.Model):
    """Stores a player's availability/status for a specific match"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    status = db.Column(db.String(50), nullable=True) # "Selected", "DNA", "Injured", etc.
    
    # Metadata
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Availability {self.player.name} - {self.match.name}: {self.status}>'

class TeamSelection(db.Model):
    """Stores the actual team selection (Starters/Finishers) for a match"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    position_number = db.Column(db.Integer, nullable=True) # 1-15 for starters, 16+ for finishers
    role = db.Column(db.String(20), nullable=True) # "Starter" or "Finisher"
    period = db.Column(db.Integer, default=1) # 1, 2, 3, 4 etc.
    
    def __repr__(self):
        return f'<TeamSelection {self.match.name} P{self.period} - {self.player.name} ({self.position_number})>'
