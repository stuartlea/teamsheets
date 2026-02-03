
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """Represents a system user"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Relationships
    team_permissions = db.relationship('TeamPermission', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'is_admin': self.is_admin
        }

class TeamPermission(db.Model):
    """Links a User to a Team with a specific role"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    role = db.Column(db.String(20), default='editor') # 'owner', 'admin', 'editor', 'viewer'
    
    def to_dict(self):
        return {
            'team_id': self.team_id,
            'role': self.role
        }

class MatchFormat(db.Model):
    """Defines the structure of a game (e.g. 15s, 7s, Waterfall)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False) # e.g. "Standard 15s"
    periods = db.Column(db.Integer, default=2) # Number of halves/quarters
    period_duration = db.Column(db.Integer, default=30) # Minutes per period
    players_on_pitch = db.Column(db.Integer, default=15) # 15, 7, etc.
    
    # Sync Configuration
    spreadsheet_key = db.Column(db.String(50), nullable=True) # Text to match in Sheet Cell B2 (e.g. "Thirds")
    column_config = db.Column(db.JSON, nullable=True) # JSON list of [period, col_letter] e.g. [[1, "H"], [2, "K"]]
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'periods': self.periods,
            'period_duration': self.period_duration,
            'players_on_pitch': self.players_on_pitch,
            'spreadsheet_key': self.spreadsheet_key,
            'column_config': self.column_config
        }

class Team(db.Model):
    """Represents a rugby team category (e.g. U15s, Men's 1st XV)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    logo_url = db.Column(db.String(255), nullable=True)
    
    # Relationships
    team_seasons = db.relationship('TeamSeason', backref='team', lazy=True)
    permissions = db.relationship('TeamPermission', backref='team', lazy=True, cascade="all, delete-orphan")

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
    spreadsheet_id = db.Column(db.String(100), nullable=True) # Optional now if using manual mode entirely
    sheet_name = db.Column(db.String(100), nullable=True)
    
    # Relationships
    matches = db.relationship('Match', backref='team_season', lazy=True)

    def __repr__(self):
        return f'<TeamSeason {self.team.name} {self.season.name}>'

    def to_dict(self):
        # Calculate summary stats
        fixture_count = Match.query.filter_by(team_season_id=self.id).count()
        
        # Player count: Unique players selected in matches for this season
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
    """Stores player data. Global pool."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    sheet_row = db.Column(db.Integer, nullable=True) # Legacy sync
    position = db.Column(db.String(50), nullable=True)
    is_forward = db.Column(db.Boolean, default=False)
    is_back = db.Column(db.Boolean, default=False)
    
    # New fields
    spond_id = db.Column(db.String(100), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True) # Soft delete
    left_date = db.Column(db.Date, nullable=True) # Date player left the team

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
            'is_back': self.is_back,
            'spond_id': self.spond_id,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None,
            'left_date': self.left_date.isoformat() if self.left_date else None
        }

class Match(db.Model):
    """Stores match/fixture data linked to a specific TeamSeason"""
    id = db.Column(db.Integer, primary_key=True)
    team_season_id = db.Column(db.Integer, db.ForeignKey('team_season.id'), nullable=True)
    
    # Core Data
    name = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=True)
    home_away = db.Column(db.String(10), nullable=True)
    sheet_col = db.Column(db.String(5), nullable=True) # Legacy sync
    opponent_name = db.Column(db.String(100), nullable=True) # New field for clean opponent name
    
    # New Fields
    is_manual = db.Column(db.Boolean, default=False) # True if created in app, False if synced
    format_id = db.Column(db.Integer, db.ForeignKey('match_format.id'), nullable=True)
    result_home_score = db.Column(db.Integer, nullable=True)
    result_away_score = db.Column(db.Integer, nullable=True)
    scorers = db.Column(db.JSON, nullable=True) # Store as JSON list for now: [{"player_id": 1, "points": 5, "type": "try"}]
    
    # Metadata
    kickoff_time = db.Column(db.String(20), nullable=True)
    meet_time = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    is_cancelled = db.Column(db.Boolean, default=False)
    
    # Relationships
    format = db.relationship('MatchFormat', backref='matches', lazy=True)
    availabilities = db.relationship('Availability', backref='match', lazy=True, cascade="all, delete-orphan")
    team_selections = db.relationship('TeamSelection', backref='match', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Match {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'team_season_id': self.team_season_id,
            'name': self.name,
            'opponent_name': self.opponent_name,
            'date': self.date.isoformat() if self.date else None,
            'home_away': self.home_away,
            'kickoff_time': self.kickoff_time,
            'meet_time': self.meet_time,
            'location': self.location,
            'is_cancelled': self.is_cancelled,
            'is_manual': self.is_manual,
            'format_id': self.format_id,
            'format_name': self.format.name if self.format else None,
            'format': self.format.to_dict() if self.format else None,
            'result': {
                'home': self.result_home_score,
                'away': self.result_away_score
            } if self.result_home_score is not None else None,
            'scorers': self.scorers
        }

class Availability(db.Model):
    """Stores a player's availability/status for a specific match"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    status = db.Column(db.String(50), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Availability {self.player.name} - {self.match.name}: {self.status}>'

class TeamSelection(db.Model):
    """Stores the actual team selection"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    position_number = db.Column(db.Integer, nullable=True)
    role = db.Column(db.String(20), nullable=True) # Starter/Finisher
    period = db.Column(db.Integer, default=1)
    
    def __repr__(self):
        return f'<TeamSelection {self.match.name} P{self.period} - {self.player.name} ({self.position_number})>'
