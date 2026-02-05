import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playerService } from '../services/players';
import { fixtureService } from '../services/fixtures';
import { Save, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function LineupBuilder({ match, teamSeasonId: propTeamSeasonId }) {
    const queryClient = useQueryClient();
    const matchId = match.id;
    // Prefer prop, fall back to match object
    // TODO: Remove fallback to 1 once data integrity is guaranteed
    const teamSeasonId = propTeamSeasonId || match.team_season_id || 1;
    
    const periodsCount = match.format?.periods || 2; 
    const playersOnPitch = match.format?.players_on_pitch || 15;

    // 1. Fetch Roster (All players)
    const { data: rosterData } = useQuery({
        queryKey: ['roster', teamSeasonId],
        queryFn: () => playerService.getByContext(teamSeasonId),
        enabled: !!teamSeasonId
    });

    // 2. Fetch Match Selection
    const { data: selectionData } = useQuery({
        queryKey: ['match-selection', matchId],
        queryFn: () => playerService.getMatchSelection(matchId)
    });

    // State for the grid: { period_num: { position_num: player_id } }
    const [lineupGrid, setLineupGrid] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Initialize Grid from API data
    useEffect(() => {
        if (selectionData?.periods) {
             const newGrid = {};
             
             // Iterate through available periods in the data, regardless of periodsCount default
             // This ensures if data has 4 periods but we defaulted to 2, we still see data if we render cols
             
             Object.keys(selectionData.periods).forEach(pKey => {
                 const pNum = parseInt(pKey);
                 newGrid[pNum] = {};
                 
                 const pData = selectionData.periods[pKey];
                 if (pData && pData.starters) {
                     pData.starters.forEach((player, index) => {
                         if (player && player.id) {
                            newGrid[pNum][index + 1] = player.id;
                         }
                     });
                 }
             });
             setLineupGrid(newGrid);
        }
    }, [selectionData]);

    const handleCellChange = (period, position, playerId) => {
        const val = parseInt(playerId) || null;
        setLineupGrid(prev => ({
            ...prev,
            [period]: {
                ...prev[period],
                [position]: val
            }
        }));
        setHasUnsavedChanges(true);
    };

    const saveMutation = useMutation({
        mutationFn: () => {
            // Transform Grid back to backend expected format
            // Backend currently expects: { starters: [ids] } for single period
            // WE NEED TO UPDATE BACKEND TO ACCEPT MULTI-PERIOD DATA
            // OR we iterate and save per period? No, bulk save is better.
            // For now, let's assume I'll update backend to accept `periods_data` map.
            
            // Re-construct the payload the backend expects.
            // Currently app.py `manage_match_team` handles `starters` list (Period 1 only roughly).
            // I need to update app.py to handle `periods` payload.
            
            return playerService.saveMatchSelection(matchId, {
                multi_period: true,
                periods: lineupGrid
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['match-selection', matchId]);
            setHasUnsavedChanges(false);
            alert('Lineup Saved!');
        }
    });

    // Players list for Dropdown: 
    // Ideally this comes from "Available" tab selections, but for now use full Roster
    // 3. Fetch Availability (to filter dropdowns)
    const { data: availabilityData } = useQuery({
        queryKey: ['availability', matchId],
        queryFn: () => fixtureService.getAvailability(matchId)
    });

    const availabilityMap = React.useMemo(() => {
        const map = {};
        if (availabilityData?.availability) {
            availabilityData.availability.forEach(a => {
                map[a.player_id] = { 
                    status: a.status, 
                    spond_status: a.spond_status 
                };
            });
        }
        return map;
    }, [availabilityData]);

    const squad = rosterData?.players || [];
    
    // Filter Squad: Only show players with 'Selected' status + players already in grid
    const availableSquad = squad.filter(p => {
        if (['#N/A', '0', ''].includes(p.name)) return false;
        if (p.left_date) return false;

        // Check Status
        const data = availabilityMap[p.id];
        const status = (data?.status || '').toLowerCase();
        const isSelected = status.includes('selected') && !status.includes('not');
        
        if (isSelected) return true;

        // Also include if currently in the lineup (to prevent them disappearing)
        const inLineup = Object.values(lineupGrid).some(periodPositions => 
            Object.values(periodPositions).includes(p.id)
        );
        if (inLineup) return true;

        return false;
    }).sort((a, b) => {
        // Sort: Alphabetical
        return a.name.localeCompare(b.name);
    });

    const getValidation = (period, playerId) => {
        if (!playerId) return null;

        // Check Duplicates in this period
        const periodPlayers = Object.values(lineupGrid[period] || {});
        // Count occurrences (converted to strings for safety)
        const count = periodPlayers.filter(id => String(id) === String(playerId)).length;
        const isDuplicate = count > 1;

        // Check Spond Status
        const data = availabilityMap[playerId];
        const spondStatus = data?.spond_status || '';
        const isSpondInvalid = spondStatus.toLowerCase() !== 'attending';

        if (!isDuplicate && !isSpondInvalid) return null;

        return { isDuplicate, isSpondInvalid, spondStatus };
    };

    return (
        <div className="space-y-6">
            <div className="overflow-x-auto bg-slate-800 rounded-xl border border-slate-700 shadow-xl"> 
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-slate-700 bg-slate-900/50 sticky left-0 z-10 w-16 text-center font-bold text-slate-400">
                                Pos
                            </th>
                            {Array.from({ length: periodsCount }, (_, i) => i + 1).map(p => (
                                <th key={p} className="p-4 border-b border-r border-slate-700 bg-slate-900/50 min-w-[200px] text-sm font-bold text-white uppercase tracking-wider">
                                    Period {p}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: playersOnPitch }, (_, i) => i + 1).map(pos => (
                            <tr key={pos} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="p-3 border-b border-slate-700/50 bg-slate-800 sticky left-0 font-mono text-center text-slate-500 font-bold border-r border-slate-700">
                                    {pos}
                                </td>
                                {Array.from({ length: periodsCount }, (_, i) => i + 1).map(p => {
                                    const selectedPlayerId = lineupGrid[p]?.[pos];
                                    const validation = getValidation(p, selectedPlayerId);
                                    
                                    return (
                                        <td key={p} className="p-2 border-b border-r border-slate-700/50 relative">
                                            <div className="relative">
                                                <select
                                                    className={clsx(
                                                        "w-full bg-slate-900/50 border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer",
                                                        !selectedPlayerId && "text-slate-500 italic",
                                                        validation ? (validation.isDuplicate ? "border-red-500 bg-red-900/10" : "border-amber-500/50") : "border-slate-700"
                                                    )}
                                                    value={selectedPlayerId || ''}
                                                    onChange={(e) => handleCellChange(p, pos, e.target.value)}
                                                >
                                                    <option value="">-- Unassigned --</option>
                                                    {availableSquad.map(player => (
                                                        <option key={player.id} value={player.id}>
                                                            {player.name} {availabilityMap[player.id]?.status !== 'Available' ? `(${availabilityMap[player.id]?.status || '?'})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                
                                                {/* Validation Indicators */}
                                                {validation && (
                                                    <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                                        {validation.isDuplicate && (
                                                            <div className="group/tooltip relative">
                                                                <AlertCircle size={14} className="text-red-500 animate-pulse" />
                                                            </div>
                                                        )}
                                                         {validation.isSpondInvalid && !validation.isDuplicate && (
                                                             <div className="group/tooltip relative">
                                                                 <AlertCircle size={14} className="text-amber-500" />
                                                             </div>
                                                         )}
                                                    </div>
                                                )}
                                                
                                                 {/* Tooltip on hover of container */}
                                                {validation && (
                                                     <div className="absolute z-50 invisible group-hover:visible bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-xl whitespace-nowrap">
                                                         {validation.isDuplicate && <div className="text-red-400 font-bold">⚠️ Selected twice in this period</div>}
                                                         {validation.isSpondInvalid && <div className="text-amber-400">Spond: {validation.spondStatus || 'Unknown'}</div>}
                                                         {/* Arrow */}
                                                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                                                     </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-4">
                {hasUnsavedChanges ? (
                     <button 
                        onClick={() => saveMutation.mutate()}
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg animate-pulse"
                    >
                        <Save size={18} /> Save Lineup Changes
                    </button>
                ) : (
                    <div className="text-slate-500 flex items-center gap-2 px-4 py-2">
                         All changes saved
                    </div>
                )}
               
            </div>
            {/* Debug Removed */}
        </div>
    );
}
