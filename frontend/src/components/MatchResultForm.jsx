import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fixtureService } from '../services/fixtures';
import { playerService } from '../services/players';
import api from '../services/api';
import { Trophy, Save } from 'lucide-react';
// AddScorerModal removed

export default function MatchResultForm({ match }) {
    const queryClient = useQueryClient();
    // Modal state removed
    
    // Determine Scoring Rules
    const scoringType = match.team_season_scoring || 'standard';
    const isStandard = scoringType === 'standard';

    // Fetch Scorers
    const { data: scorers = [], isLoading: scorerLoading } = useQuery({
        queryKey: ['player-scores', match.id],
        queryFn: async () => {
            try {
                const data = await api.get(`/player-scores/?match_id=${match.id}`);
                // api interceptor returns response.data directly
                return Array.isArray(data) ? data : [];
            } catch (err) {
                console.error("Error fetching scores:", err);
                return [];
            }
        }
    });

    // Fetch players for selection
    const { data: allPlayers = [] } = useQuery({
        queryKey: ['team-selections', match.id],
        queryFn: async () => {
            try {
                const data = await api.get(`/matches/${match.id}/team/`);
                if (!data) return [];
                
                const players = [];
                const seen = new Set();
                
                // Helper to add player
                const addP = (p) => {
                    if (p && p.id && !seen.has(p.id)) {
                        seen.add(p.id);
                        players.push(p);
                    }
                };

                // Strategy 1: Check root starters/finishers (Period 1)
                if (data.starters) data.starters.forEach(addP);
                if (data.finishers) data.finishers.forEach(addP);

                // Strategy 2: Check all periods in 'periods' object
                if (data.periods) {
                    Object.values(data.periods).forEach(period => {
                        if (period.starters) period.starters.forEach(addP);
                        if (period.finishers) period.finishers.forEach(addP);
                    });
                }
                
                return players.sort((a, b) => a.name.localeCompare(b.name));
            } catch (err) {
                console.error("Failed to fetch team players", err);
                return [];
            }
        }
    });

    // Score helpers
    const addScoreMutation = useMutation({
        mutationFn: (data) => api.post('/player-scores/', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['player-scores', match.id]);
        }
    });

    const deleteScoreMutation = useMutation({
        mutationFn: (id) => api.delete(`/player-scores/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(['player-scores', match.id]);
        }
    });

    // Sub-form state
    const [newScorer, setNewScorer] = useState('');
    const [newScoreType, setNewScoreType] = useState('try');
    const [newScoreOutcome, setNewScoreOutcome] = useState('scored');
    const [newScoreQuantity, setNewScoreQuantity] = useState(1);

    const handleAddScore = (e) => {
        e.preventDefault();
        if (!newScorer) return;
        
        addScoreMutation.mutate({
            match: match.id,
            player: parseInt(newScorer),
            score_type: newScoreType,
            outcome: newScoreOutcome,
            quantity: parseInt(newScoreQuantity)
        }, {
            onSuccess: () => {
                setNewScorer('');
                setNewScoreQuantity(1);
            }
        });
    };

    // State for scores
    const [scores, setScores] = useState({
        home_tries: match.home_tries || 0,
        home_cons: match.home_cons || 0,
        home_pens: match.home_pens || 0,
        home_drop_goals: match.home_drop_goals || 0,
        away_tries: match.away_tries || 0,
        away_cons: match.away_cons || 0,
        away_pens: match.away_pens || 0,
        away_drop_goals: match.away_drop_goals || 0,
    });

    const [calculated, setCalculated] = useState({ home: 0, away: 0 });

    // Calculate score whenever inputs change
    useEffect(() => {
        let h_pts = 0;
        let a_pts = 0;

        if (scoringType === 'tries_only') {
            h_pts = scores.home_tries;
            a_pts = scores.away_tries;
        } else {
            // Standard: T=5, C=2, P=3, D=3
            h_pts = (scores.home_tries * 5) + (scores.home_cons * 2) + (scores.home_pens * 3) + (scores.home_drop_goals * 3);
            a_pts = (scores.away_tries * 5) + (scores.away_cons * 2) + (scores.away_pens * 3) + (scores.away_drop_goals * 3);
        }

        setCalculated({ home: h_pts, away: a_pts });
    }, [scores, scoringType]);

    // Update Mutation
    const updateMatchMutation = useMutation({
        mutationFn: (data) => fixtureService.update(match.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['match', match.id]);
            alert('Match result saved!');
        },
        onError: (err) => {
            alert('Failed to save result: ' + err.message);
        }
    });

    const handleSave = () => {
        updateMatchMutation.mutate({ ...scores, is_manual: true });
    };

    const handleChange = (field, value) => {
        setScores(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
    };

    const isHome = match.home_away === 'Home';
    const ourTeamName = "Sandbach RUFC"; // Could fetch actual team name if needed
    const oppName = match.opponent_name || "Opponent";

    return (
        <div className="max-w-4xl mx-auto">
             {/* ... existing header ... */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                {/* ... Header ... */}
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="text-yellow-500" /> Match Result
                    </h2>
                    <div className="text-sm bg-slate-900 px-3 py-1 rounded text-slate-400 border border-slate-700">
                        Scoring Rule: <span className="text-white font-bold">{scoringType === 'tries_only' ? 'Tries Only' : 'Standard Rules'}</span>
                    </div>
                </div>

                {/* Scoreboard Header */}
                <div className="grid grid-cols-3 gap-8 mb-8">
                    <div className="text-center">
                        <div className="text-slate-400 text-sm font-bold uppercase mb-2">Home</div>
                        <div className="text-2xl font-bold text-white truncate px-2">{isHome ? ourTeamName : oppName}</div>
                        <div className={`text-6xl font-black mt-4 ${calculated.home > calculated.away ? 'text-green-500' : 'text-slate-200'}`}>
                            {calculated.home}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-center pt-8">
                        <div className="text-slate-600 text-2xl font-bold">-</div>
                    </div>

                    <div className="text-center">
                        <div className="text-slate-400 text-sm font-bold uppercase mb-2">Away</div>
                        <div className="text-2xl font-bold text-white truncate px-2">{!isHome ? ourTeamName : oppName}</div>
                        <div className={`text-6xl font-black mt-4 ${calculated.away > calculated.home ? 'text-green-500' : 'text-slate-200'}`}>
                            {calculated.away}
                        </div>
                    </div>
                </div>

                {/* Inputs */}
                <div className="bg-slate-950/30 rounded-lg p-6 mb-8">
                    <ScoreInput label="Tries" fieldSuffix="tries" scores={scores} handleChange={handleChange} />
                    {isStandard && (
                        <>
                            <ScoreInput label="Conversions" fieldSuffix="cons" scores={scores} handleChange={handleChange} />
                            <ScoreInput label="Penalties" fieldSuffix="pens" scores={scores} handleChange={handleChange} />
                            <ScoreInput label="Drop Goals" fieldSuffix="drop_goals" scores={scores} handleChange={handleChange} />
                        </>
                    )}
                </div>

                {/* Scorer Management (Inline) */}
                <div className="mb-8">
                     <h3 className="font-bold text-white mb-4">Player Scorers</h3>
                
                     {/* Add Row */}
                     <form onSubmit={handleAddScore} className="bg-slate-700/30 p-4 rounded-lg flex flex-wrap gap-4 items-end border border-slate-700 mb-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-slate-400 mb-1">Player</label>
                            <select 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                value={newScorer}
                                onChange={e => setNewScorer(e.target.value)}
                            >
                                <option value="">Select Scorer...</option>
                                {allPlayers.length > 0 ? (
                                    allPlayers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))
                                ) : (
                                    <option disabled>No players in team selection</option>
                                )}
                            </select>
                        </div>
                        <div className="w-32">
                             <label className="block text-xs text-slate-400 mb-1">Type</label>
                             <select
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                value={newScoreType}
                                onChange={e => setNewScoreType(e.target.value)}
                             >
                                <option value="try">Try (5)</option>
                                <option value="con">Conversion (2)</option>
                                <option value="pen">Penalty (3)</option>
                                <option value="drop">Drop Goal (3)</option>
                             </select>
                        </div>
                        <div className="w-32">
                             <label className="block text-xs text-slate-400 mb-1">Outcome</label>
                             <select
                                className={`w-full border rounded px-3 py-2 text-sm font-bold outline-none ${newScoreOutcome === 'scored' ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-red-900/30 border-red-700 text-red-400'}`}
                                value={newScoreOutcome}
                                onChange={e => setNewScoreOutcome(e.target.value)}
                             >
                                <option value="scored">Scored</option>
                                <option value="missed">Missed</option>
                             </select>
                        </div>
                        <div className="w-20">
                            <label className="block text-xs text-slate-400 mb-1">Qty</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                value={newScoreQuantity}
                                onChange={(e) => setNewScoreQuantity(e.target.value)}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!newScorer || addScoreMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
                        >
                            <Trophy size={14} /> Add
                        </button>
                     </form>
                
                
                    {scorerLoading ? (
                        <div className="text-slate-500 text-sm">Loading scorers...</div>
                    ) : (
                        <div className="bg-slate-900 rounded-lg border border-slate-700 divide-y divide-slate-800">
                            {scorers.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm">No individual scorers recorded.</div>
                            ) : (
                                Object.values(scorers.reduce((acc, score) => {
                                    const key = `${score.player}-${score.score_type}-${score.outcome}`;
                                    if (!acc[key]) {
                                        acc[key] = { ...score, count: 0, ids: [] };
                                    }
                                    acc[key].count += 1;
                                    acc[key].ids.push(score.id);
                                    return acc;
                                }, {})).map(group => (
                                    <div key={group.ids[0]} className="p-3 flex justify-between items-center hover:bg-slate-800/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    group.outcome === 'missed' 
                                                    ? 'bg-red-900/20 text-red-500 border border-red-900/50' 
                                                    : 'bg-green-900/20 text-green-500 border border-green-900/50'
                                                }`}>
                                                    {group.score_type === 'try' ? 'T' : 
                                                     group.score_type === 'con' ? 'C' : 
                                                     group.score_type === 'pen' ? 'P' : 'D'}
                                                </div>
                                                {group.count > 1 && (
                                                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-slate-900">
                                                        {group.count}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white flex items-center gap-2">
                                                    {group.player_name}
                                                    {group.outcome === 'missed' && (
                                                        <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded border border-red-800 uppercase font-bold">Missed</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 capitalize">
                                                    {group.score_type === 'try' ? 'Try' : 
                                                     group.score_type === 'con' ? 'Conversion' : 
                                                     group.score_type === 'pen' ? 'Penalty' : 'Drop Goal'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <span className="text-xs text-slate-600 mr-2">Remove 1</span>
                                            <button 
                                                onClick={() => deleteScoreMutation.mutate(group.ids[0])}
                                                className="text-slate-600 hover:text-red-400 bg-slate-800 hover:bg-slate-700 p-2 rounded transition-all"
                                                title="Remove One"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                )) 
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={updateMatchMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Save size={18} />
                        {updateMatchMutation.isPending ? 'Saving...' : 'Save Result'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper Component
const ScoreInput = ({ label, fieldSuffix, scores, handleChange }) => (
    <div className="grid grid-cols-3 gap-8 items-center py-2 border-b border-slate-800 last:border-0">
        <div className="text-right">
            <input 
                type="number" 
                min="0"
                value={scores[`home_${fieldSuffix}`]}
                onChange={(e) => handleChange(`home_${fieldSuffix}`, e.target.value)}
                className="w-16 bg-slate-900 border border-slate-700 rounded p-2 text-center text-white focus:border-blue-500 outline-none font-mono"
            />
        </div>
        <div className="text-center text-slate-500 text-sm font-medium uppercase tracking-wider">
            {label}
        </div>
        <div className="text-left">
            <input 
                type="number" 
                min="0"
                value={scores[`away_${fieldSuffix}`]}
                onChange={(e) => handleChange(`away_${fieldSuffix}`, e.target.value)}
                className="w-16 bg-slate-900 border border-slate-700 rounded p-2 text-center text-white focus:border-blue-500 outline-none font-mono"
            />
        </div>
    </div>
);
