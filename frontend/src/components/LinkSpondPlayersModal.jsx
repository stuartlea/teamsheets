import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Link as LinkIcon, AlertCircle, Check, Search, Save, Loader, CheckSquare, Square } from 'lucide-react';
import { spondService } from '../services/spond';
import { playerService } from '../services/players';
import clsx from 'clsx';

// Simple Levenshtein distance for fuzzy matching
const levenshtein = (a, b) => {
    if (!a || !b) return 100;
    const an = a.toLowerCase();
    const bn = b.toLowerCase();
    const matrix = [];
    for (let i = 0; i <= bn.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= an.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= bn.length; i++) {
        for (let j = 1; j <= an.length; j++) {
            if (bn.charAt(i - 1) == an.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[bn.length][an.length];
};

export default function LinkSpondPlayersModal({ isOpen, onClose, team, players = [] }) {
    const queryClient = useQueryClient();
    const [spondMembers, setSpondMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState('unlinked'); // 'unlinked', 'invalid', 'all'
    const [searchTerm, setSearchTerm] = useState('');
    const [showLeft, setShowLeft] = useState(false); // Default to hiding left players
    
    // Staged changes: Map of playerId -> spondId (or null to unlink)
    const [stagedLinks, setStagedLinks] = useState({});

    // Selection state for bulk actions
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Fetch Spond Members when modal opens
    useEffect(() => {
        if (isOpen && team?.spond_group_id) {
            setIsLoading(true);
            spondService.getMembers(team.spond_group_id)
                .then(res => {
                    setSpondMembers(res.members || []);
                })
                .catch(err => console.error("Failed to fetch members", err))
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, team]);

    // Sort members alphabetically
    const sortedMembers = useMemo(() => {
        return [...spondMembers].sort((a, b) => 
            (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName)
        );
    }, [spondMembers]);

    // Compute status and suggestions
    const processedPlayers = useMemo(() => {
        return players.map(p => {
            const currentLink = p.spond_id;
            const linkedMember = currentLink ? spondMembers.find(m => m.id === currentLink) : null;
            const isInvalid = currentLink && !linkedMember;
            
            // Fuzzy match if unlinked
            let suggestion = null;
            if (!currentLink) {
                let bestDist = 100;
                let bestMember = null;
                spondMembers.forEach(m => {
                    const mName = `${m.firstName} ${m.lastName}`;
                    const dist = levenshtein(p.name, mName);
                    if (dist < 4 && dist < bestDist) { // Threshold
                         bestDist = dist;
                         bestMember = m;
                    }
                });
                if (bestMember) suggestion = bestMember;
            }

            return {
                ...p,
                linkedMember,
                isInvalid,
                suggestion,
                status: isInvalid ? 'invalid' : (currentLink ? 'linked' : 'unlinked')
            };
        });
    }, [players, spondMembers]);

    const filteredPlayers = processedPlayers.filter(p => {
        // Exclude left players unless showLeft is true
        if (!showLeft && p.left_date) return false;

        if (searchTerm) {
            return p.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
        if (filter === 'all') return true;
        if (filter === 'invalid') return p.isInvalid;
        if (filter === 'unlinked') return p.status === 'unlinked';
        return true;
    });

    // Handle Selection
    const handleSelectAll = () => {
        if (selectedIds.size === filteredPlayers.length) {
            setSelectedIds(new Set()); // Deselect all
        } else {
            setSelectedIds(new Set(filteredPlayers.map(p => p.id))); // Select all filtered
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const linkMutation = useMutation({
        mutationFn: async (payload) => {
            const promises = payload.map(item => 
                spondService.linkPlayer(item.playerId, item.spondId)
            );
            return Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['roster']);
            setStagedLinks({});
            setSelectedIds(new Set());
            alert("Links updated successfully");
            onClose();
        }
    });

    const handleStageChange = (playerId, spondId) => {
        setStagedLinks(prev => ({
            ...prev,
            [playerId]: spondId
        }));
    };
    
    const handleAcceptSuggestion = (p) => {
        if (p.suggestion) {
            handleStageChange(p.id, p.suggestion.id);
        }
    };

    const handleAcceptSelectedSuggestions = () => {
        const newStaged = { ...stagedLinks };
        let count = 0;
        processedPlayers.forEach(p => {
             // Only process if selected AND has suggestion AND not already linked/staged
             if (selectedIds.has(p.id) && p.suggestion && !p.spond_id && !newStaged[p.id]) {
                 newStaged[p.id] = p.suggestion.id;
                 count++;
             }
        });
        if (count > 0) {
            setStagedLinks(newStaged);
        }
    };

    const handleSave = () => {
        const payload = Object.entries(stagedLinks).map(([pid, sid]) => ({
            playerId: pid,
            spondId: sid
        }));
        linkMutation.mutate(payload);
    };

    if (!isOpen) return null;

    const stats = {
        unlinked: processedPlayers.filter(p => p.status === 'unlinked').length,
        invalid: processedPlayers.filter(p => p.status === 'invalid').length,
        linked: processedPlayers.filter(p => p.status === 'linked').length,
    };

    const allSelected = filteredPlayers.length > 0 && selectedIds.size === filteredPlayers.length;
    const selectedCount = selectedIds.size;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                            <LinkIcon size={20} className="text-blue-400" />
                            Manage Spond Links
                        </h2>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-sm text-slate-400">
                                Link your roster players to Spond members.
                            </p>
                            <label className="text-xs text-slate-500 flex items-center gap-2 cursor-pointer select-none hover:text-slate-300 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={showLeft}
                                    onChange={(e) => setShowLeft(e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-offset-slate-900 mr-1.5"
                                />
                                Show Left Players
                            </label>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button 
                            onClick={() => setFilter('unlinked')}
                            className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", filter === 'unlinked' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white")}
                        >
                            Unlinked <span className="bg-slate-800/30 px-1.5 rounded text-xs">{stats.unlinked}</span>
                        </button>
                        <button 
                            onClick={() => setFilter('invalid')}
                            className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", filter === 'invalid' ? "bg-red-600 text-white shadow" : "text-slate-400 hover:text-white")}
                        >
                            Invalid <span className="bg-slate-800/30 px-1.5 rounded text-xs">{stats.invalid}</span>
                        </button>
                        <button 
                            onClick={() => setFilter('all')}
                            className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2", filter === 'all' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white")}
                        >
                            All <span className="bg-slate-800/30 px-1.5 rounded text-xs">{processedPlayers.length}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Accept Selected Button */}
                        <button 
                            onClick={handleAcceptSelectedSuggestions}
                            disabled={selectedCount === 0}
                            className={clsx(
                                "text-xs border px-3 py-2 rounded font-medium flex items-center gap-1.5 transition-colors",
                                selectedCount > 0 
                                    ? "bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50" 
                                    : "bg-slate-800/50 text-slate-500 border-slate-700 cursor-not-allowed"
                            )}
                            title="Accept suggestions for selected players"
                        >
                            <Check size={14} /> Accept Selected ({selectedCount})
                        </button>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search players..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0 bg-slate-900/50">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <Loader className="animate-spin mr-2" /> Loading Spond members...
                        </div>
                    ) : (
                         <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-700 text-slate-400">
                                <tr>
                                    <th className="px-6 py-3 w-12">
                                        <button 
                                            onClick={handleSelectAll}
                                            className="flex items-center justify-center text-slate-400 hover:text-white"
                                        >
                                            {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-3 font-medium">Player</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium">Mapped Member</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredPlayers.map(p => {
                                    const stageVal = stagedLinks[p.id];
                                    const isStaged = stageVal !== undefined;
                                    const isLinked = p.status === 'linked';
                                    const displayedSpondId = isStaged ? stageVal : p.spond_id;
                                    const isSelected = selectedIds.has(p.id);
                                    
                                    return (
                                        <tr key={p.id} className={clsx(
                                            "group transition-colors border-b border-slate-800/50",
                                            p.isInvalid ? "bg-red-900/10 hover:bg-red-900/20" : 
                                            isSelected ? "bg-blue-900/10 hover:bg-blue-900/20" : 
                                            isLinked ? "bg-emerald-900/10 hover:bg-emerald-900/20" : 
                                            "hover:bg-slate-800/50"
                                        )}>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => toggleSelection(p.id)}
                                                    className={clsx("flex items-center justify-center", isSelected ? "text-blue-400" : "text-slate-600 hover:text-slate-400")}
                                                >
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">
                                                {p.name}
                                                {p.suggestion && !p.spond_id && !isStaged && (
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-blue-400">
                                                        <span className="opacity-70">Suggestion:</span> 
                                                        <span className="font-semibold">{p.suggestion.firstName} {p.suggestion.lastName}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {p.isInvalid && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={14}/> Invalid ID</span>}
                                                {p.status === 'linked' && !p.isInvalid && <span className="text-green-400 flex items-center gap-1"><Check size={14}/> Linked</span>}
                                                {p.status === 'unlinked' && <span className="text-slate-500">Not Linked</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={displayedSpondId || ''}
                                                    onChange={(e) => handleStageChange(p.id, e.target.value || null)}
                                                    className={clsx(
                                                        "bg-slate-800 border rounded px-2 py-1.5 focus:outline-none text-sm w-full max-w-[200px] text-slate-200", 
                                                        isStaged ? "border-amber-500" : "border-slate-700 hover:border-slate-600"
                                                    )}
                                                    style={{ colorScheme: 'dark' }} 
                                                >
                                                    <option value="" className="bg-slate-800 text-slate-400">-- No Link --</option>
                                                    {sortedMembers.map(m => (
                                                        <option key={m.id} value={m.id} className="bg-slate-800 text-white">
                                                            {m.firstName} {m.lastName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {p.suggestion && !p.spond_id && !isStaged && (
                                                    <button 
                                                        onClick={() => handleAcceptSuggestion(p)}
                                                        className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-600/30 px-2 py-1 rounded transition-all"
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {isStaged && (
                                                    <button 
                                                        onClick={() => {
                                                            const newLinks = {...stagedLinks};
                                                            delete newLinks[p.id];
                                                            setStagedLinks(newLinks);
                                                        }}
                                                        className="text-xs text-amber-400 hover:text-amber-300 ml-2"
                                                    >
                                                        Revert
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredPlayers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            No players found matching current filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800 rounded-b-xl flex justify-between items-center">
                    <div className="text-sm text-slate-400">
                        {Object.keys(stagedLinks).length > 0 && (
                            <span className="text-amber-400 font-medium">
                                {Object.keys(stagedLinks).length} changes staged
                            </span>
                        )}
                         {selectedCount > 0 && (
                            <span className="text-blue-400 font-medium ml-3">
                                {selectedCount} selected
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                         <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={Object.keys(stagedLinks).length === 0 || linkMutation.isPending}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                        >
                            {linkMutation.isPending ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
