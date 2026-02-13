import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playerService } from '../services/players';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function MergePlayersModal({ isOpen, onClose, players, contextId }) {
    const queryClient = useQueryClient();
    const [sourceId, setSourceId] = useState('');
    const [targetId, setTargetId] = useState('');
    const [error, setError] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const mergeMutation = useMutation({
        mutationFn: ({ source, target }) => playerService.merge(source, target),
        onSuccess: () => {
            queryClient.invalidateQueries(['roster', contextId]);
            queryClient.invalidateQueries(['match-team']); // Invalidate match selections
            onClose();
            setSourceId('');
            setTargetId('');
            setError(null);
            // Replaced alert with auto-close logic or toast (not implemented yet, but modal closes so it's fine)
        },
        onError: (err) => {
            setError(err.response?.data?.error || err.message);
        }
    });

    const handleMergeClick = (e) => {
        e.preventDefault();
        if (!sourceId || !targetId) {
            setError("Please select both players.");
            return;
        }
        if (sourceId === targetId) {
            setError("Cannot merge a player into themselves.");
            return;
        }
        setIsConfirmOpen(true);
    };

    const confirmMerge = () => {
        mergeMutation.mutate({ source: sourceId, target: targetId });
    };

    if (!isOpen) return null;

    // Filter players for dropdowns to avoid clutter (maybe sort alpha)
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-2xl relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-bold text-white mb-2">Merge Players</h2>
                    <p className="text-sm text-slate-400 mb-6">
                        Combine two player records into one. Use this when a player was renamed in the spreadsheet and created a duplicate.
                    </p>

                    <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-4 mb-6 flex gap-3 text-yellow-500 text-sm">
                        <AlertCircle className="shrink-0" size={20} />
                        <div>
                            <p className="font-bold mb-1">Warning: Irreversible Action</p>
                            <p className="opacity-90">
                                The Source Player will be <strong>deleted</strong>. All their match history, availability, and stats will be moved to the Target Player.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form className="space-y-6">
                        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Source (Duplicate)</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                    value={sourceId}
                                    onChange={(e) => setSourceId(e.target.value)}
                                >
                                    <option value="">Select Player...</option>
                                    {sortedPlayers.map(p => (
                                        <option key={p.id} value={p.id} disabled={p.id == targetId}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500">This player will be deleted.</p>
                            </div>

                            <div className="flex flex-col items-center justify-center pt-5 text-slate-500">
                                <ArrowRight size={24} />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Target (Keep)</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                    value={targetId}
                                    onChange={(e) => setTargetId(e.target.value)}
                                >
                                    <option value="">Select Player...</option>
                                    {sortedPlayers.map(p => (
                                        <option key={p.id} value={p.id} disabled={p.id == sourceId}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500">This player will be kept.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleMergeClick}
                                disabled={mergeMutation.isPending}
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmModal 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmMerge}
                title="Confirm Player Merge"
                message="Are you sure you want to merge these players? This action cannot be undone. The source player will be permanently deleted and all their data moved to the target player."
                confirmText="Yes, Merge Players"
                isDestructive={true}
            />
        </>
    );
}
