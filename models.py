
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Player(db.Model):
    """Stores player data from the Master sheet"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    sheet_row = db.Column(db.Integer, nullable=True) # Row index in Master sheet for reference
    
    # Relationships
    availabilities = db.relationship('Availability', backref='player', lazy=True)
    selections = db.relationship('TeamSelection', backref='player', lazy=True)

    def __repr__(self):
        return f'<Player {self.name}>'

class Match(db.Model):
    """Stores match/fixture data from the Master sheet header row"""
    id = db.Column(db.Integer, primary_key=True)
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
    availabilities = db.relationship('Availability', backref='match', lazy=True)
    team_selections = db.relationship('TeamSelection', backref='match', lazy=True)

    def __repr__(self):
        return f'<Match {self.name}>'

class Availability(db.Model):
    """Stores a player's availability/status for a specific match (from Master sheet)"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    status = db.Column(db.String(50), nullable=True) # "Selected", "DNA", "Injured", etc.
    
    # Metadata
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Availability {self.player.name} - {self.match.name}: {self.status}>'

class TeamSelection(db.Model):
    """Stores the actual team selection (Starters/Finishers) for a match (from Match tab)"""
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('match.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    position_number = db.Column(db.Integer, nullable=True) # 1-15 for starters, 16+ for finishers
    role = db.Column(db.String(20), nullable=True) # "Starter" or "Finisher"
    period = db.Column(db.Integer, default=1) # 1, 2, 3, 4 etc.
    
    def __repr__(self):
        return f'<TeamSelection {self.match.name} P{self.period} - {self.player.name} ({self.position_number})>'
