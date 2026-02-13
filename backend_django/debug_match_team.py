from api.models import Match, TeamSelection
from api.serializers import MatchSerializer
import json

try:
    match = Match.objects.get(id=1)
    print(f"Match: {match}")
    
    selections = TeamSelection.objects.filter(match=match).select_related('player')
    print(f"Total Selections: {selections.count()}")
    
    formatted_periods = {}
    
    for sel in selections:
        p_num = str(sel.period)
        if p_num not in formatted_periods:
            formatted_periods[p_num] = {'starters': [], 'finishers': []}
        
        target_key = 'starters' if sel.role == 'Starter' else 'finishers'
        target_list = formatted_periods[p_num][target_key]
        
        if sel.role == 'Starter':
             idx = sel.position_number - 1
        else:
             idx = sel.position_number - 16
        
        if idx < 0: idx = 0
        while len(target_list) <= idx:
            target_list.append(None)
        
        target_list[idx] = {'id': sel.player.id, 'name': sel.player.name}

    print("Formatted Periods Keys:", formatted_periods.keys())
    for p, data in formatted_periods.items():
        print(f"Period {p}: {len([x for x in data['starters'] if x])} starters, {len([x for x in data['finishers'] if x])} finishers")
        
    # Check what Frontend logic expects
    # Frontend logic:
    # 1. res.data.starters (Period 1 starters)
    # 2. res.data.periods (Object.values -> period.starters)
    
except Match.DoesNotExist:
    print("Match 1 not found")
