from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Team(models.Model):
    """Represents a rugby team category (e.g. U15s, Men's 1st XV)"""
    name = models.CharField(max_length=100)
    logo_url = models.CharField(max_length=255, null=True, blank=True)
    spond_group_id = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.name

class TeamPermission(models.Model):
    """Links a User to a Team with a specific role"""
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('editor', 'Editor'),
        ('viewer', 'Viewer'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='team_permissions')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='permissions')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='editor')

    def __str__(self):
        return f"{self.user.username} - {self.team.name} ({self.role})"

class MatchFormat(models.Model):
    """Defines the structure of a game (e.g. 15s, 7s, Waterfall)"""
    name = models.CharField(max_length=50)
    periods = models.IntegerField(default=2)
    period_duration = models.IntegerField(default=30)
    players_on_pitch = models.IntegerField(default=15)
    
    # Sync Configuration
    spreadsheet_key = models.CharField(max_length=50, null=True, blank=True)
    column_config = models.JSONField(null=True, blank=True)

    def __str__(self):
        return self.name

class Season(models.Model):
    """Represents a rugby season (e.g. 2024-2025)"""
    name = models.CharField(max_length=50)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class TeamSeason(models.Model):
    """Links a Team to a Season and a specific Google Sheet"""
    SCORING_CHOICES = [
        ('standard', 'Standard (5/2/3/3)'),
        ('tries_only', 'Tries Only (1/0/0/0)'),
    ]
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team_seasons')
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='team_seasons')
    spreadsheet_id = models.CharField(max_length=100, null=True, blank=True)
    sheet_name = models.CharField(max_length=100, null=True, blank=True)
    scoring_type = models.CharField(max_length=20, choices=SCORING_CHOICES, default='standard')

    def __str__(self):
        return f"{self.team.name} {self.season.name}"

class Player(models.Model):
    """Stores player data. Global pool."""
    name = models.CharField(max_length=100)
    sheet_row = models.IntegerField(null=True, blank=True)
    position = models.CharField(max_length=50, null=True, blank=True)
    is_forward = models.BooleanField(default=False)
    is_back = models.BooleanField(default=False)
    
    spond_id = models.CharField(max_length=100, null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    left_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.name

class PlayerAlias(models.Model):
    """Maps alternative names (e.g. from merges) to a canonical Player ID"""
    name = models.CharField(max_length=100)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='aliases')

    def __str__(self):
        return f"{self.name} -> {self.player.name}"

class Match(models.Model):
    """Stores match/fixture data linked to a specific TeamSeason"""
    RESULT_CHOICES = [
        ('W', 'Win'),
        ('L', 'Loss'),
        ('D', 'Draw'),
    ]
    team_season = models.ForeignKey(TeamSeason, on_delete=models.CASCADE, related_name='matches', null=True, blank=True)
    
    name = models.CharField(max_length=100)
    date = models.DateField(null=True, blank=True)
    home_away = models.CharField(max_length=10, null=True, blank=True)
    sheet_col = models.CharField(max_length=5, null=True, blank=True)
    opponent_name = models.CharField(max_length=100, null=True, blank=True)
    
    is_manual = models.BooleanField(default=False)
    format = models.ForeignKey(MatchFormat, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches')
    
    # Final Scores (Calculated)
    result_home_score = models.IntegerField(null=True, blank=True)
    result_away_score = models.IntegerField(null=True, blank=True)
    result = models.CharField(max_length=1, choices=RESULT_CHOICES, null=True, blank=True)
    
    # Detailed Scoring (Us / Them) - stored as simple ints
    # "Home" in this context is just "Our Team" stats vs "Opponent" stats? 
    # Actually, stick to Home/Away logic to match fixture. 
    # If home_away='Home', result_home_score is US. 
    # If home_away='Away', result_away_score is US.
    
    home_tries = models.IntegerField(default=0)
    home_cons = models.IntegerField(default=0)
    home_pens = models.IntegerField(default=0)
    home_drop_goals = models.IntegerField(default=0)

    away_tries = models.IntegerField(default=0)
    away_cons = models.IntegerField(default=0)
    away_pens = models.IntegerField(default=0)
    away_drop_goals = models.IntegerField(default=0)

    scorers = models.JSONField(null=True, blank=True)
    
    kickoff_time = models.CharField(max_length=20, null=True, blank=True)
    meet_time = models.CharField(max_length=20, null=True, blank=True)
    location = models.CharField(max_length=200, null=True, blank=True)
    is_cancelled = models.BooleanField(default=False)
    
    spond_event_id = models.CharField(max_length=100, null=True, blank=True)
    spond_availability_id = models.CharField(max_length=100, null=True, blank=True)
    
    source = models.CharField(max_length=50, default='Manual')
    
    # Metadata for Team Sheets
    notes = models.TextField(null=True, blank=True)
    featured_player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='featured_in_matches')
    featured_label = models.CharField(max_length=50, null=True, blank=True)
    team_sheet_title = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        verbose_name_plural = "Matches"

    def calculate_score(self):
        """Calculates score based on TeamSeason rules"""
        if not self.team_season:
             # Default to standard if no team season context (e.g. testing or ad-hoc)
             rules = 'standard'
        else:
             rules = self.team_season.scoring_type
        
        if rules == 'tries_only':
            h_pts = self.home_tries
            a_pts = self.away_tries
        else:
            # Standard: T=5, C=2, P=3, D=3
            h_pts = (self.home_tries * 5) + (self.home_cons * 2) + (self.home_pens * 3) + (self.home_drop_goals * 3)
            a_pts = (self.away_tries * 5) + (self.away_cons * 2) + (self.away_pens * 3) + (self.away_drop_goals * 3)
        
        self.result_home_score = h_pts
        self.result_away_score = a_pts
        
        # Determine Result (W/L/D) for OUR Team
        # If we are Home, we want Home > Away.
        # If we are Away, we want Away > Home.
        
        is_home_game = (self.home_away or 'Home').lower() in ['home', 'h']
        
        if is_home_game:
            our_score = h_pts
            their_score = a_pts
        else:
            our_score = a_pts
            their_score = h_pts
            
        if our_score > their_score:
            self.result = 'W'
        elif our_score < their_score:
            self.result = 'L'
        else:
            # Draw logic: Only set Result if game was actually played/manual result entered
            # If scores are 0-0 and NOT manual, treat as "Not Played" -> No Result
            if our_score == 0 and their_score == 0 and not self.is_manual:
                self.result = None
            else:
                self.result = 'D'
            
        # Don't set result if 0-0? Maybe we do. 
        # Only set if played? 
        # Let's assume if scores are entered (or non-zero), we calculate.
        # For now, always calculate. Users can leave as 0-0.

    def save(self, *args, **kwargs):
        self.calculate_score()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Availability(models.Model):
    """Stores a player's availability/status for a specific match"""
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='availabilities')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='availabilities')
    status = models.CharField(max_length=50, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    spond_status = models.CharField(max_length=100, null=True, blank=True)
    spond_last_updated = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Availabilities"

    def __str__(self):
        return f"{self.player.name} - {self.match.name}: {self.status}"

class TeamSelection(models.Model):
    """Stores the actual team selection"""
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='team_selections')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='selections')
    position_number = models.IntegerField(null=True, blank=True)
    role = models.CharField(max_length=20, null=True, blank=True) # Starter/Finisher
    period = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.match.name} P{self.period} - {self.player.name}"

class PlayerScore(models.Model):
    """Tracks individual scoring events by players in a match"""
    SCORE_TYPES = [
        ('try', 'Try (5)'),
        ('con', 'Conversion (2)'),
        ('pen', 'Penalty (3)'),
        ('drop', 'Drop Goal (3)'),
    ]
    
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='player_scores')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='scores')
    score_type = models.CharField(max_length=10, choices=SCORE_TYPES)
    outcome = models.CharField(max_length=10, choices=[('scored', 'Scored'), ('missed', 'Missed')], default='scored')
    
    # We could store points, but it's derived from rules. For now, assume standard.
    # Actually, rules might vary (tries only). 
    # But for a "Scorer Report", we usually just want "Tries Scored". Total points is secondary.
    
    class Meta:
        verbose_name_plural = "Player Scores"

    def __str__(self):
        return f"{self.player.name} - {self.get_score_type_display()} ({self.get_outcome_display()})"
