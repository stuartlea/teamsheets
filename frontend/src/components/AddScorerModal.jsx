import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { X, Plus, Trophy } from 'lucide-react';

export default function AddScorerModal({ isOpen, onClose, matchId, players }) {
    const queryClient = useQueryClient();
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [scoreType, setScoreType] = useState('try');

    // Score Types Definition
    const scoreTypes = [
        { id: 'try', name: 'Try', points: 5 },
        { id: 'con', name: 'Conversion', points: 2 },
        { id: 'pen', 'name': 'Penalty', points: 3 },
        { id: 'drop', 'name': 'Drop Goal', points: 3 },
    ];

    const addScoreMutation = useMutation({
        mutationFn: (data) => api.post('/player-scores/', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['player-scores', matchId]);
            queryClient.invalidateQueries(['match', matchId]); // Maybe refresh match totals too?
            onClose();
        },
        onError: (err) => {
            alert('Failed to add score: ' + err.message);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedPlayer) return;

        addScoreMutation.mutate({
            match: matchId,
            player: parseInt(selectedPlayer),
            score_type: scoreType
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy size={20} className="text-yellow-500" /> Record Score
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Select Scorer</label>
                        <select 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                            required
                        >
                            <option value="">-- Choose Player --</option>
                            {players.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Score Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {scoreTypes.map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setScoreType(type.id)}
                                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                                        scoreType === type.id 
                                        ? 'bg-blue-600 border-blue-500 text-white' 
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                    }`}
                                >
                                    {type.name} <span className="opacity-60 text-xs ml-1">({type.points} pts)</span>
                                </button>
                            ))}
                        </div>
                    </div>
                
                    <button 
                        type="submit"
                        disabled={addScoreMutation.isPending || !selectedPlayer}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {addScoreMutation.isPending ? 'Saving...' : (
                            <>
                                <Plus size={18} /> Add Score
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
