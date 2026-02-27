from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Match, MatchFormat, TeamSelection, Player, PlayerAlias, PlayerScore
from ..serializers import MatchSerializer, TeamSelectionSerializer, MatchFormatSerializer, PlayerScoreSerializer
from ..permissions import HasTeamAccess
from core.services.sync_service import SyncService
from core.services.sheets_service import SheetsService

class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated, HasTeamAccess]

    def get_queryset(self):
        queryset = Match.objects.all().order_by('date')
        team_season_id = self.request.query_params.get('team_season_id')
        if team_season_id:
            queryset = queryset.filter(team_season_id=team_season_id)
        return queryset

    @action(detail=True, methods=['post'])
    def refresh(self, request, pk=None):
        match = self.get_object()
        sheets_service = SheetsService()
        sync_service = SyncService(sheets_service)
        
        if sync_service.sync_single_match(match):
            # Reload match
            match.refresh_from_db()
            return Response({'success': True, 'message': 'Match refreshed', 'match': MatchSerializer(match).data})
        else:
            return Response({'success': False, 'error': 'Sync failed'}, status=500)

    @action(detail=True, methods=['get', 'post'], url_path='team')
    def manage_team(self, request, pk=None):
        match = self.get_object()
        
        if request.method == 'GET':
            # Identify current selections
            selections = TeamSelection.objects.filter(match=match).select_related('player')
            
            # Use serializer for raw data access if needed, but we can access obj directly
            # Frontend expects: { periods: { <pNum>: { starters: [{id: 1...}, ...], finishers: [...] } } }
            
            formatted_periods = {}
            
            # Group by Period
            for sel in selections:
                p_num = str(sel.period)
                if p_num not in formatted_periods:
                    formatted_periods[p_num] = {'starters': [], 'finishers': []}
                
                # We need to reconstruct the array where index matches position-1 effectively
                # But frontend LineupBuilder iterates array: array[index] corresponds to position index+1
                
                # Determine target array
                target_key = 'starters' if sel.role == 'Starter' else 'finishers'
                target_list = formatted_periods[p_num][target_key]
                
                # Position Number (1-based)
                # Map to 0-based index
                # Starters: 1-15 -> 0-14
                # Finishers: 16+ -> 0+ ?
                # LineupBuilder.jsx:
                # pData.starters.forEach((player, index) => newGrid[pNum][index + 1] = player.id)
                # This implies index 0 -> Pos 1.
                
                if sel.role == 'Starter':
                     idx = sel.position_number - 1
                else:
                     idx = sel.position_number - 16 # Assuming finishers start at 16
                
                # Ensure list is big enough
                if idx < 0: idx = 0 # Safety
                while len(target_list) <= idx:
                    target_list.append(None)
                
                # Store simple player dict or just id? Frontend expects object with .id
                # LineupBuilder: if (player && player.id) -> assumes object
                target_list[idx] = {'id': sel.player.id, 'name': sel.player.name}
                
            # Populate flattened starters/finishers for Period 1 (Legacy/Preview support)
            period_1 = formatted_periods.get('1', {'starters': [], 'finishers': []})
            starters = period_1.get('starters', [])
            finishers = period_1.get('finishers', [])
            
            # Ensure starters array is padded to 15 for specific UI consumers if needed, 
            # though the loop above creates sparse arrays or dicts?
            # actually strict list with None is safer?
            # The loop above does: target_list.append(None) so it's a list.
            
            # Helper to safely format time
            def format_time(t):
                if not t: return ''
                if isinstance(t, str):
                    # Should be HH:MM:SS or HH:MM
                    return t[:5] 
                return t.strftime('%H:%M')
            
            fixture_info = {
                'match_date': match.date.strftime('%Y-%m-%d') if match.date else '',
                'kickoff': format_time(match.kickoff_time),
                'meet_time': format_time(match.meet_time),
                'location': match.location,
                'opponent_name': match.opponent_name,
                'home_away': match.home_away,
                'team_name': match.team_season.team.name if match.team_season else 'Team',
                'notes': match.notes,
                'featured_player_id': match.featured_player_id,
                'featured_player_name': match.featured_player.name if match.featured_player else '',
                'featured_label': match.featured_label,
                'team_sheet_title': match.team_sheet_title
            }
            
            metadata = {
                 'kickoff': fixture_info['kickoff'],
                 'meet_time': fixture_info['meet_time'],
                 'location': fixture_info['location'],
                 'notes': match.notes,
                 'featured_player': match.featured_player.name if match.featured_player else '',
                 'featured_label': match.featured_label,
                 'team_sheet_title': match.team_sheet_title
            }
                
            return Response({
                'success': True, 
                'periods': formatted_periods,
                'starters': starters,
                'finishers': finishers,
                'fixture_info': fixture_info,
                'metadata': metadata,
                'match_name': match.name
            })

        if request.method == 'POST':
            # Update Team Selection
            # Expecting detailed JSON payload
            data = request.data
            
            try:
                # Clear existing for this match (Atomic update logic preferred but this matches Flask)
                TeamSelection.objects.filter(match=match).delete()
                
                if data.get('multi_period'):
                    periods_map = data.get('periods', {})
                    for p_num, positions in periods_map.items():
                         for pos, p_id in positions.items():
                             if p_id:
                                 pos_int = int(pos)
                                 role = 'Starter' if pos_int <= 15 else 'Finisher'
                                 
                                 TeamSelection.objects.create(
                                     match=match,
                                     player_id=p_id,
                                     role=role,
                                     period=int(p_num),
                                     position_number=pos_int
                                 )
                else:
                    starters = data.get('starters', [])
                    finishers = data.get('finishers', []) # Or substitutes
                    
                    for i, p_id in enumerate(starters):
                        if p_id:
                            TeamSelection.objects.create(
                                match=match,
                                player_id=p_id,
                                role='Starter',
                                period=1,
                                position_number=i+1
                            )
                    
                    for i, p_id in enumerate(finishers):
                         if p_id:
                             TeamSelection.objects.create(
                                 match=match,
                                 player_id=p_id,
                                 role='Finisher',
                                 period=1,
                                 position_number=16+i
                             )
                
                return Response({'success': True, 'message': 'Team selection saved'})
            except Exception as e:
                return Response({'success': False, 'error': str(e)}, status=500)

    @action(detail=True, methods=['post'], url_path='spond-sync')
    def spond_sync(self, request, pk=None):
        try:
            match = self.get_object()
            
            # Check for either ID
            if not match.spond_event_id and not match.spond_availability_id:
                return Response({'success': False, 'message': 'No Spond Event or Availability Request linked. Please link one first.'}, status=400)

            from core.services.spond_service import SpondService 
            
            spond_service = SpondService()
            result = spond_service.sync_match_availability(match)
            
            if result:
                 return Response({'success': True, 'message': 'Match availability synced from Spond'})
            else:
                 return Response({'success': False, 'message': 'Sync performed but no changes or failed silently.'})
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=500)

    @action(detail=True, methods=['post'], url_path='link-spond')
    def link_spond(self, request, pk=None):
        match = self.get_object()
        data = request.data
        
        if 'spond_event_id' in data:
            match.spond_event_id = data['spond_event_id']
        
        if 'spond_availability_id' in data:
            match.spond_availability_id = data['spond_availability_id']
            
        match.save()
        return Response({'success': True, 'message': 'Spond link updated'})

class MatchFormatViewSet(viewsets.ModelViewSet):
    queryset = MatchFormat.objects.all()
    serializer_class = MatchFormatSerializer

class PlayerScoreViewSet(viewsets.ModelViewSet):
    queryset = PlayerScore.objects.all()
    serializer_class = PlayerScoreSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        match_id = self.request.query_params.get('match_id')
        if match_id:
            qs = qs.filter(match_id=match_id)
        return qs

    def create(self, request, *args, **kwargs):
        quantity = int(request.data.get('quantity', 1))
        
        # Validate data generally (ignoring quantity for serializer)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if quantity > 1:
            # Create multiple
            instances = []
            for _ in range(quantity):
                 instances.append(PlayerScore(**serializer.validated_data))
            
            PlayerScore.objects.bulk_create(instances)
            
            # Return custom response or just the first one?
            return Response({'message': f'{quantity} scores recorded', 'success': True}, status=status.HTTP_201_CREATED)
        else:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
    @action(detail=False, methods=['GET'])
    def types(self, request):
        """Return available score types"""
        return Response([
            {'id': k, 'name': v.split(' (')[0], 'points': int(v.split('(')[1].strip(')'))} 
            for k, v in PlayerScore.SCORE_TYPES
        ])
