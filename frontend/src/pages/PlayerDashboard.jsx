import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playerService } from '../services/players';
import { spondService } from '../services/spond';
import { ArrowLeft, Save, Trash2, Calendar, Link as LinkIcon } from 'lucide-react';

export default function PlayerDashboard() {
    const { playerId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    // Fetch Player
    const { data: playerData, isLoading } = useQuery({
        queryKey: ['player', playerId],
        queryFn: async () => {
            // Need a getById endpoint? Or filter from list?
            // Assuming getById exists or adding it. For now, filter from a context if needed, 
            // but ideally we add `playerService.getById`.
            // Let's assume we need to add `getById` to frontend service too.
            const response = await fetch(`/api/players/${playerId}`); // Updated endpoint
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
            // TODO: Standardize this into service
        }
    });

    const [formData, setFormData] = useState({
        name: '',
        position: '',
        left_date: '',
        spond_id: ''
    });
    
    const [spondMembers, setSpondMembers] = useState([]);

    // Fetch Spond Members
    React.useEffect(() => {
        if (!playerData?.player) return;

        const loadMembers = async () => {
            try {
                // If we know the specific group from the team context, use it.
                const targetGroupId = playerData.player.team_spond_group_id;
                
                if (targetGroupId) {
                     try {
                        const { members } = await spondService.getMembers(targetGroupId);
                        // Get group name for label? We might need to fetch group details or just use generic
                        // But typically we can just show the members. 
                        // To get group name we'd need to fetch groups too or just the group.
                        // Let's being robust: fetch groups to get name map, but only fetch members for target.
                        const { groups } = await spondService.getGroups();
                        const group = groups.find(g => g.id === targetGroupId);
                        const groupName = group ? group.name : 'Team Group';

                        setSpondMembers(members.map(m => ({
                            id: m.id,
                            name: `${m.firstName} ${m.lastName}`,
                            groupName: groupName
                        })));
                     } catch (e) {
                         console.error("Failed to fetch target group members", e);
                     }
                } else {
                    // Fallback: Check all groups if no team link (or show warning?)
                    // User complained about "all players", so let's maybe default to empty or limited?
                    // But if it's a new player not in a team yet, "all players" might be useful or confusing.
                    // Let's keep "all" but maybe grouped better or just warn.
                    // Actually, the user specifically said "linked with the players team".
                    // If no team link, maybe show all but it's overwhelming.
                    // I'll keep the logic but maybe optimize. 
                    // Wait, the complaint was "only be presented with members from the group that is linked".
                    // So if there IS a link, do that. If not, maybe show all (legacy behavior).
                    const { groups } = await spondService.getGroups();
                    let all = [];
                    for (const g of groups) {
                        try {
                            const { members } = await spondService.getMembers(g.id);
                            all = [...all, ...members.map(m => ({
                                id: m.id,
                                name: `${m.firstName} ${m.lastName}`,
                                groupName: g.name
                            }))];
                        } catch (e) {
                             console.warn(`Failed to load members for group ${g.id}`, e);
                        }
                    }
                    setSpondMembers(all);
                }
            } catch (e) {
                console.error("Failed to load Spond data", e);
            }
        };
        loadMembers();
    }, [playerData]);

    // Populate form
    React.useEffect(() => {
        if (playerData?.player) {
            setFormData({
                name: playerData.player.name || '',
                position: playerData.player.position || '',
                left_date: playerData.player.left_date || '',
                spond_id: playerData.player.spond_id || ''
            });
        }
    }, [playerData]);

    const updateMutation = useMutation({
        mutationFn: async (data) => {
            // Service call
            const res = await fetch(`/api/players/${playerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['player', playerId]);
            queryClient.invalidateQueries(['roster']); // Invalidate lists too
            alert('Player Updated');
            navigate(-1); // Go back
        }
    });

    if (isLoading) return <div className="p-8 text-white">Loading...</div>;

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} /> Back
                </button>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
                    <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        Edit Player
                    </h1>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Position</label>
                            <input 
                                type="text" 
                                value={formData.position}
                                onChange={e => setFormData({...formData, position: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                                <LinkIcon size={14} className="text-blue-500"/> Spond Member
                            </label>
                            <select 
                                value={formData.spond_id}
                                onChange={e => setFormData({...formData, spond_id: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500 appearance-none"
                            >
                                <option value="">No Link</option>
                                {spondMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.groupName})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Link this player to a Spond member to sync availability.</p>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-700">
                             <div className="flex items-center gap-2 mb-4">
                                <Calendar className="text-amber-500" size={20} />
                                <h3 className="font-bold text-lg text-white">Availability Controls</h3>
                             </div>
                             
                             <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Date Left (Optional)</label>
                                <p className="text-xs text-slate-500 mb-2">If set, player will not appear in availability lists for matches AFTER this date.</p>
                                <input 
                                    type="date" 
                                    value={formData.left_date}
                                    onChange={e => setFormData({...formData, left_date: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                />
                             </div>
                        </div>

                        <div className="pt-6 flex justify-end gap-3">
                             <button 
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-4 py-2 rounded hover:bg-slate-700 text-slate-300 transition-colors"
                             >
                                Cancel
                             </button>
                             <button 
                                type="submit"
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                             >
                                <Save size={18} /> Save Changes
                             </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
