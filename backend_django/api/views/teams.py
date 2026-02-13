from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Team, Season, TeamSeason, Player
from ..serializers import TeamSerializer, SeasonSerializer, TeamSeasonSerializer, PlayerSerializer
from ..permissions import HasTeamAccess

class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, HasTeamAccess]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Team.objects.all()
        # Filter teams where the user has a permission entry
        return Team.objects.filter(permissions__user=user).distinct()

class SeasonViewSet(viewsets.ModelViewSet):
    queryset = Season.objects.all()
    serializer_class = SeasonSerializer
    permission_classes = [IsAuthenticated]

class TeamSeasonViewSet(viewsets.ModelViewSet):
    queryset = TeamSeason.objects.all()
    serializer_class = TeamSeasonSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Optional: Filter by user's teams? 
        return TeamSeason.objects.all()

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        team_season = self.get_object()
        
        # Instantiate services
        from core.services.sheets_service import SheetsService
        from core.services.sync_service import SyncService
        
        # We need OAuth credentials from the request user (if we stored them per user)
        # OR currently the system uses a shared global/env config for Spond, but Sheets uses OAuth.
        # SheetsService checks for credentials in database or session.
        # Existing OAuthService handles this.
        
        sheets_service = SheetsService()
        sync_service = SyncService(sheets_service)
        
        # 1. Sync Master Data (Matches, Players, Availability)
        if not sync_service.sync_master_data(team_season.id):
             return Response({'success': False, 'error': 'Failed to sync master data'}, status=500)
             
        # 2. Sync Team Selections (Grid)
        sync_service.sync_team_selections(team_season.id) # Optimize: Make async or handle error?
        
        return Response({'success': True, 'message': 'Sync completed successfully'})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        team_season = self.get_object()
        from ..models import Match, PlayerScore
        from django.db.models import Sum, Count, Q, F

        # Get all matches for this season
        matches = Match.objects.filter(team_season=team_season, is_cancelled=False)
        
        # Get all scores for these matches
        # We need to aggregate by player
        
        # Define scoring weights
        # Standard: Try=5, Con=2, Pen=3, Drop=3
        # Tries Only: Try=1, others=0
        
        is_tries_only = team_season.scoring_type == 'tries_only'
        
        TRY_VAL = 1 if is_tries_only else 5
        CON_VAL = 0 if is_tries_only else 2
        PEN_VAL = 0 if is_tries_only else 3
        DROP_VAL = 0 if is_tries_only else 3

        # Aggregate data in Python to handle complex logic easily (or use extensive aggregation queries)
        # Given dataset size is small per team/season, Python aggregation is fine and readable.
        
        player_stats = {}
        
        scores = PlayerScore.objects.filter(match__in=matches).select_related('player')
        
        for score in scores:
            pid = score.player.id
            pname = score.player.name
            
            if pid not in player_stats:
                player_stats[pid] = {
                    'id': pid, 
                    'name': pname, 
                    'tries': 0, 
                    'cons': 0, 
                    'pens': 0, 
                    'drops': 0,
                    'points': 0,
                    'kicks_attempts': 0,
                    'kicks_success': 0
                }
                
            stats = player_stats[pid]
            
            st_lower = score.score_type.lower()
            outcome_scored = (score.outcome or '').lower() == 'scored'
            
            if st_lower == 'try':
                stats['tries'] += 1
                stats['points'] += TRY_VAL
            elif st_lower in ['conversion', 'con']:
                stats['kicks_attempts'] += 1
                if outcome_scored:
                    stats['cons'] += 1
                    stats['points'] += CON_VAL
                    stats['kicks_success'] += 1
            elif st_lower in ['penalty', 'pen']:
                stats['kicks_attempts'] += 1
                if outcome_scored:
                    stats['pens'] += 1
                    stats['points'] += PEN_VAL
                    stats['kicks_success'] += 1
            elif st_lower in ['drop goal', 'drop']:
                # Assuming simple drop goal logic if tracked, usually just 'Scored' outcome matter
                # If outcome is tracked for Drop Goal:
                if outcome_scored or not score.outcome: # default to scored if not strict
                     stats['drops'] += 1
                     stats['points'] += DROP_VAL

        # Convert to list
        all_stats = list(player_stats.values())
        
        # 1. Top Try Scorers
        top_tries = sorted([p for p in all_stats if p['tries'] > 0], key=lambda x: x['tries'], reverse=True)[:5]
        
        # 2. Top Point Scorers
        top_points = sorted([p for p in all_stats if p['points'] > 0], key=lambda x: x['points'], reverse=True)[:5]
        
        # 3. Top Goal Kickers (Cons + Pens)
        # Sort by total goals, then id (stable sort)
        top_kickers = sorted(
            [p for p in all_stats if p['kicks_attempts'] > 0], 
            key=lambda x: (x['cons'] + x['pens']), 
            reverse=True
        )[:5]
        
        # 4. Top Kick Percentage (Min 3 attempts)
        def calc_pct(p):
            if p['kicks_attempts'] == 0: return 0
            return (p['kicks_success'] / p['kicks_attempts']) * 100
            
        kick_pct_candidates = [p for p in all_stats if p['kicks_attempts'] >= 3]
        top_kick_pct = sorted(kick_pct_candidates, key=calc_pct, reverse=True)[:5]
        
        # Format for response
        return Response({
            'top_try_scorers': top_tries,
            'top_point_scorers': top_points,
            'top_goal_kickers': [{
                'id': p['id'], 
                'name': p['name'], 
                'goals': p['cons'] + p['pens'],
                'details': f"{p['cons']} Cons, {p['pens']} Pens"
            } for p in top_kickers],
            'top_kick_percentage': [{
                'id': p['id'], 
                'name': p['name'], 
                'percentage': round(calc_pct(p), 1),
                'attempts': p['kicks_attempts'],
                'success': p['kicks_success']
            } for p in top_kick_pct]
        })

class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [IsAuthenticated]

    # Implement merge logic as Action?
    # Or keep it simple for now matching Flask CRUD.

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({'players': serializer.data})

    @action(detail=False, methods=['post'], url_path='merge')
    def merge(self, request):
        source_id = request.data.get('source_id')
        target_id = request.data.get('target_id')
        
        if not source_id or not target_id:
             return Response({'success': False, 'error': 'Missing source_id or target_id'}, status=400)
             
        try:
            source_player = Player.objects.get(id=source_id)
            target_player = Player.objects.get(id=target_id)
            
            # Logic:
            # 1. Create Alias for source player name pointing to target player
            from ..models import PlayerAlias
            PlayerAlias.objects.create(name=source_player.name, player=target_player)
            
            # 2. Re-link all foreign keys from source to target
            # Matches/Selections/Availabilities/Scores
            from ..models import TeamSelection, Availability, PlayerScore
            
            TeamSelection.objects.filter(player=source_player).update(player=target_player)
            Availability.objects.filter(player=source_player).update(player=target_player)
            PlayerScore.objects.filter(player=source_player).update(player=target_player)
            
            # 3. Delete source player
            source_player.delete()
            
            return Response({'success': True, 'message': f'Merged {source_player.name} into {target_player.name}'})
            
        except Player.DoesNotExist:
            return Response({'success': False, 'error': 'Player not found'}, status=404)
        except Exception as e:
             return Response({'success': False, 'error': str(e)}, status=500)
