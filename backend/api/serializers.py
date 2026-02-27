from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Team, TeamPermission, Season, TeamSeason, Player, Match, Availability, TeamSelection, MatchFormat, PlayerScore

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_superuser']

class TeamPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamPermission
        fields = ['id', 'user', 'team', 'role']

class TeamSerializer(serializers.ModelSerializer):
    permissions = TeamPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = ['id', 'name', 'logo_url', 'spond_group_id', 'permissions']

class SeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Season
        fields = ['id', 'name', 'start_date', 'end_date', 'is_current']



class TeamSeasonSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)
    season = SeasonSerializer(read_only=True)
    stats = serializers.SerializerMethodField()
    
    # Writeable fields
    team_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='team', write_only=True)
    season_id = serializers.PrimaryKeyRelatedField(queryset=Season.objects.all(), source='season', write_only=True)

    class Meta:
        model = TeamSeason
        fields = ['id', 'team', 'season', 'team_id', 'season_id', 'spreadsheet_id', 'sheet_name', 'scoring_type', 'stats']

    def get_stats(self, obj):
        from django.utils import timezone
        
        # Next Fixture
        today = timezone.now().date()
        next_match = Match.objects.filter(
            team_season=obj,
            date__gte=today,
            is_cancelled=False
        ).order_by('date', 'kickoff_time').first()
        
        next_fixture_data = None
        if next_match:
             next_fixture_data = {
                 'id': next_match.id,
                 'name': next_match.opponent_name or next_match.name,
                 'date': next_match.date,
                 'kickoff_time': next_match.kickoff_time,
                 'location': next_match.location
             }

        # Calculate Season Stats
        matches = Match.objects.filter(team_season=obj, is_cancelled=False)
        
        stats = {
            'played': 0,
            'won': 0,
            'lost': 0,
            'drawn': 0,
            'points_for': 0,
            'points_against': 0,
            'tries_for': 0,
            'tries_against': 0,
            'cons_for': 0,
            'cons_against': 0,
            'pens_for': 0,
            'pens_against': 0,
            'drop_for': 0,
            'drop_against': 0
        }
        
        for m in matches:
            if m.result: # Only count if result is set (played)
                stats['played'] += 1
                if m.result == 'W': stats['won'] += 1
                elif m.result == 'L': stats['lost'] += 1
                elif m.result == 'D': stats['drawn'] += 1
                
                # Check home/away for correct stats mapping
                is_home = (m.home_away or 'Home').lower() in ['home', 'h']
                
                if is_home:
                    # Our Team is Home
                    stats['points_for'] += (m.result_home_score or 0)
                    stats['points_against'] += (m.result_away_score or 0)
                    
                    stats['tries_for'] += (m.home_tries or 0)
                    stats['cons_for'] += (m.home_cons or 0)
                    stats['pens_for'] += (m.home_pens or 0)
                    stats['drop_for'] += (m.home_drop_goals or 0)
                    
                    stats['tries_against'] += (m.away_tries or 0)
                    stats['cons_against'] += (m.away_cons or 0)
                    stats['pens_against'] += (m.away_pens or 0)
                    stats['drop_against'] += (m.away_drop_goals or 0)
                else:
                    # Our Team is Away
                    stats['points_for'] += (m.result_away_score or 0)
                    stats['points_against'] += (m.result_home_score or 0)
                    
                    stats['tries_for'] += (m.away_tries or 0)
                    stats['cons_for'] += (m.away_cons or 0)
                    stats['pens_for'] += (m.away_pens or 0)
                    stats['drop_for'] += (m.away_drop_goals or 0)
                    
                    stats['tries_against'] += (m.home_tries or 0)
                    stats['cons_against'] += (m.home_cons or 0)
                    stats['pens_against'] += (m.home_pens or 0)
                    stats['drop_against'] += (m.home_drop_goals or 0)

        return {
            'next_fixture': next_fixture_data,
            'player_count': 0,
            **stats
        }

class PlayerScoreSerializer(serializers.ModelSerializer):
    """
    Serializer for individual player scoring events.
    """
    player_name = serializers.CharField(source='player.name', read_only=True)
    
    class Meta:
        model = PlayerScore
        fields = ['id', 'match', 'player', 'player_name', 'score_type', 'outcome']
        
class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ['id', 'name', 'position', 'is_forward', 'is_back', 'spond_id', 'left_date']

class MatchFormatSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchFormat
        fields = '__all__'

class MatchSerializer(serializers.ModelSerializer):
    format = MatchFormatSerializer(read_only=True)
    format_id = serializers.PrimaryKeyRelatedField(queryset=MatchFormat.objects.all(), source='format', write_only=True, required=False, allow_null=True)
    
    # Custom fields for frontend convenience
    team_spond_group_id = serializers.CharField(source='team_season.team.spond_group_id', read_only=True)
    team_season_id = serializers.PrimaryKeyRelatedField(read_only=True, source='team_season')
    team_season_scoring = serializers.CharField(source='team_season.scoring_type', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'team_season', 'team_season_id', 'team_spond_group_id', 'name', 'date', 'home_away', 'opponent_name',
            'kickoff_time', 'meet_time', 'location', 'source', 'is_cancelled',
            'result_home_score', 'result_away_score', 'result', 'is_manual',
            'home_tries', 'home_cons', 'home_pens', 'home_drop_goals',
            'away_tries', 'away_cons', 'away_pens', 'away_drop_goals',
            'format', 'format_id', 
            'spond_event_id', 'spond_availability_id', 'team_season_scoring',
            'notes', 'featured_player', 'featured_label', 'team_sheet_title'
        ]

class AvailabilitySerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.name', read_only=True)
    player_id = serializers.PrimaryKeyRelatedField(source='player', read_only=True)
    
    class Meta:
        model = Availability
        fields = ['id', 'match', 'player', 'player_id', 'player_name', 'status', 'spond_status']

class TeamSelectionSerializer(serializers.ModelSerializer):
    player = PlayerSerializer(read_only=True)
    player_id = serializers.PrimaryKeyRelatedField(queryset=Player.objects.all(), source='player', write_only=True)

    class Meta:
        model = TeamSelection
        fields = ['id', 'match', 'player', 'player_id', 'position_number', 'role', 'period']
