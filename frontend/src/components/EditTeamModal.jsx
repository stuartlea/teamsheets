import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { teamService } from '../services/teams';
import { spondService } from '../services/spond';
import { X, Save, Shield, Image } from 'lucide-react';

export default function EditTeamModal({ isOpen, onClose, team }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        logo_url: '',
        spond_group_id: ''
    });
    
    // Fetch Spond Groups
    const { data: spondData } = useQuery({
        queryKey: ['spond-groups'],
        queryFn: spondService.getGroups,
        enabled: isOpen
    });
    const spondGroups = spondData?.groups || [];

    useEffect(() => {
        if (team) {
            setFormData({
                name: team.name || '',
                logo_url: team.logo_url || '',
                spond_group_id: team.spond_group_id || ''
            });
        }
    }, [team, isOpen]);

    const updateMutation = useMutation({
        mutationFn: (data) => teamService.update(team.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['teams']);
            queryClient.invalidateQueries(['team', team.id]);
            onClose();
        },
        onError: (err) => alert("Failed to update team: " + err.message)
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-xl relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Shield size={20} className="text-blue-500" />
                    Edit Team Settings
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Team Name</label>
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>
                    
                    {/* Logo URL */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                            <Image size={14} /> Logo URL (Optional)
                        </label>
                        <input 
                            type="text" 
                            value={formData.logo_url}
                            onChange={e => setFormData({...formData, logo_url: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="https://..."
                        />
                    </div>
                    
                    {/* Spond Link */}
                    <div className="pt-4 border-t border-slate-700">
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Shield size={14} className="text-green-500" /> Spond Integration
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Link this team to a Spond group to allow match import and availability syncing.</p>
                        
                        <select 
                            value={formData.spond_group_id}
                            onChange={e => setFormData({...formData, spond_group_id: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500 appearance-none"
                        >
                            <option value="">Select Spond Group...</option>
                            {spondGroups.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                        {spondGroups.length === 0 && (
                            <p className="text-xs text-amber-500 mt-2">
                                No Spond groups found. Check backend credentials.
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                        >
                            {updateMutation.isPending ? 'Saving...' : (
                                <>
                                    <Save size={18} /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
