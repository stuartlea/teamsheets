import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Save, RefreshCw, Trash2, Plus, Database, AlertCircle, Check, Settings } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const adminService = {
    getContexts: async () => {
        const res = await api.get('/team-seasons/');
        // DRF returns array directly, or paginated object depending on config.
        // Assuming direct array based on existing logic, or { results: ... } if paginated.
        // Let's assume list for now as Pagination not explicitly enabled in settings view.
        return Array.isArray(res) ? res : res.results || []; 
    },
    updateContext: async (id, data) => {
        const res = await api.patch(`/team-seasons/${id}/`, data);
        return res;
    },
    createContext: async (data) => {
        const res = await api.post('/team-seasons/', data);
        return res;
    },
    deleteContext: async (id) => {
        const res = await api.delete(`/team-seasons/${id}/`);
        return res;
    },
    syncContext: async (id) => {
        const res = await api.post(`/team-seasons/${id}/sync/`);
        return res;
    },
    getTeams: async () => {
        const res = await api.get('/teams/');
        return Array.isArray(res) ? res : res.teams || [];
    },
    getSeasons: async () => {
        const res = await api.get('/seasons/');
        return Array.isArray(res) ? res : res.seasons || [];
    }
};

import ConfirmModal from '../components/ConfirmModal';

export default function AdminSettings() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState(null);
    const [syncingId, setSyncingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [confirmModal, setConfirmModal] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        onConfirm: () => {},
        isDestructive: false,
        confirmText: 'Confirm'
    });
    
    // Data Queries
    const { data: contexts, isLoading } = useQuery({
        queryKey: ['admin-contexts'],
        queryFn: adminService.getContexts
    });

    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: adminService.getTeams });
    const { data: seasons } = useQuery({ queryKey: ['seasons'], queryFn: adminService.getSeasons });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => adminService.updateContext(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-contexts']);
            setEditingId(null);
        }
    });

    const syncMutation = useMutation({
        mutationFn: (id) => adminService.syncContext(id),
        onMutate: (id) => setSyncingId(id),
        onSettled: () => setSyncingId(null),
        onSuccess: () => {
            alert("Sync Complete!");
            queryClient.invalidateQueries(['matches']);
        },
        onError: (err) => {
            alert("Sync Failed: " + (err.response?.data?.error || err.message));
        }
    });

    const handleEdit = (ctx) => {
        setEditingId(ctx.id);
        setEditForm({ 
            spreadsheet_id: ctx.spreadsheet_id,
            scoring_type: ctx.scoring_type 
        });
    };

    const handleSave = (id) => {
        updateMutation.mutate({ id, data: editForm });
    };

    // Create New Context
    const createMutation = useMutation({
        mutationFn: adminService.createContext,
        onSuccess: () => {
             queryClient.invalidateQueries(['admin-contexts']);
             setIsCreateOpen(false);
             setCreateForm({ team_id: '', season_id: '', spreadsheet_id: '' });
        },
        onError: (err) => alert("Failed to link team: " + (err.response?.data?.error || err.message))
    });

    const handleCreate = (e) => {
        e.preventDefault();
        createMutation.mutate(createForm);
    };

    // Delete Context
    const deleteMutation = useMutation({
        mutationFn: adminService.deleteContext,
        onSuccess: () => queryClient.invalidateQueries(['admin-contexts']),
        onError: (err) => alert("Failed to delete: " + (err.response?.data?.error || err.message))
    });

    const handleDelete = (id) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Link",
            message: "Are you sure you want to delete this link? This will NOT delete the actual team or data, just the link.",
            onConfirm: () => deleteMutation.mutate(id),
            isDestructive: true,
            confirmText: "Delete Link"
        });
    };

    // Restore handleSync
    const handleSync = (id) => {
        setConfirmModal({
            isOpen: true,
            title: "Confirm Sync",
            message: "This will overwrite database data with data from Google Sheets. Continue?",
            onConfirm: () => syncMutation.mutate(id),
            isDestructive: false,
            confirmText: "Sync Data"
        });
    };
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ team_id: '', season_id: '', spreadsheet_id: '' });

    const { data: authStatus } = useQuery({
        queryKey: ['auth-status'],
        queryFn: async () => {
             const res = await api.get('/auth/status/');
             return res;
        }
    });

    if (isLoading) return <div className="p-8 text-white">Loading Admin...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            {/* Header ... */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Team Season Settings</h1>
                    <p className="text-slate-400">Configure Spreadsheets and Scoring Rules</p>
                </div>
                {/* ... existing buttons ... */}
                <div className="flex gap-4 items-center">
                    {/* ... auth status logic ... */}
                    {authStatus && (
                         <div className={clsx(
                             "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
                             authStatus.has_credentials 
                                ? "bg-green-900/20 border-green-500/50 text-green-400" 
                                : "bg-yellow-900/20 border-yellow-500/50 text-yellow-400"
                         )}>
                             <div className={clsx("w-2 h-2 rounded-full", authStatus.has_credentials ? "bg-green-400" : "bg-yellow-400")}></div>
                             {authStatus.has_credentials ? "Sheets Connected" : "Sheets Disconnected"}
                         </div>
                    )}
                    
                    {!authStatus?.has_credentials && (
                         <a href="/api/auth/oauth/login/" className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all">
                             {/* icon */} Connect Sheets
                         </a>
                    )}

                    <button 
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all"
                    >
                        <Plus size={18} />
                        New Link
                    </button>
                </div>
            </header>

            {/* Create Modal ... (omitted for brevity in this replacement, assumed unchanged mostly or simple enough not to touch yet unless requested) */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Link Team to Season</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            {/* Team/Season Selects ... */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Team</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={createForm.team_id} onChange={e => setCreateForm({...createForm, team_id: e.target.value})} required>
                                    <option value="">Select Team...</option>
                                    {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Season</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={createForm.season_id} onChange={e => setCreateForm({...createForm, season_id: e.target.value})} required>
                                    <option value="">Select Season...</option>
                                    {seasons?.map(s => <option key={s.id} value={s.id}>{s.name} {s.is_current ? '(Current)' : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Spreadsheet ID</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm" placeholder="e.g. 1KRCwRuvTR0DXaNT..." value={createForm.spreadsheet_id} onChange={e => setCreateForm({...createForm, spreadsheet_id: e.target.value})} required />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-700 mt-6">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50">{createMutation.isPending ? 'Linking...' : 'Create Link'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Settings size={18} className="text-blue-400" /> 
                        Configuration
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400 font-medium">
                            <tr>
                                <th className="p-4">Team / Season</th>
                                <th className="p-4 w-1/4">Spreadsheet ID</th>
                                <th className="p-4 w-1/6">Scoring Rule</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {contexts?.map(ctx => (
                                <tr key={ctx.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-white">{ctx.team?.name}</div>
                                        <div className="text-xs text-blue-300">{ctx.season?.name}</div>
                                    </td>
                                    <td className="p-4 font-mono text-xs text-slate-400 truncate max-w-[200px]">
                                        {editingId === ctx.id ? (
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={editForm.spreadsheet_id || ''}
                                                onChange={e => setEditForm({...editForm, spreadsheet_id: e.target.value})}
                                                placeholder="Spreadsheet ID"
                                            />
                                        ) : (
                                            <span title={ctx.spreadsheet_id}>{ctx.spreadsheet_id || '-'}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {editingId === ctx.id ? (
                                            <select 
                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={editForm.scoring_type}
                                                onChange={e => setEditForm({...editForm, scoring_type: e.target.value})}
                                            >
                                                <option value="standard">Standard (5/2/3/3)</option>
                                                <option value="tries_only">Tries Only (1/0/0/0)</option>
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${ctx.scoring_type === 'tries_only' ? 'bg-purple-900 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                                                {ctx.scoring_type === 'tries_only' ? 'Tries Only' : 'Standard'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right flex justify-end items-center gap-2">
                                        {editingId === ctx.id ? (
                                            <>
                                                <button 
                                                    onClick={() => handleSave(ctx.id)}
                                                    className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-white transition-colors"
                                                    title="Save"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button 
                                                onClick={() => handleEdit(ctx)}
                                                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                                title="Edit Settings"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        )}
                                        
                                        <div className="h-4 w-px bg-slate-700 mx-1"></div>

                                        <button 
                                            onClick={() => handleSync(ctx.id)}
                                            disabled={syncingId === ctx.id}
                                            className={clsx(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all",
                                                syncingId === ctx.id 
                                                    ? "bg-blue-900/50 text-blue-400 cursor-not-allowed"
                                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                                            )}
                                        >
                                            <RefreshCw size={14} className={clsx(syncingId === ctx.id && "animate-spin")} />
                                            {syncingId === ctx.id ? "Syncing..." : "Sync"}
                                        </button>
                                        
                                        <button 
                                            onClick={() => handleDelete(ctx.id)}
                                            className="ml-2 p-1.5 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400 transition-colors"
                                            title="Delete Link"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <h4 className="font-bold flex items-center gap-2 text-yellow-500 mb-2">
                    <AlertCircle size={18} />
                    Note
                </h4>
                <p className="text-sm text-slate-400">
                    Syncing requires you to be authenticated with Google Sheets. 
                    If the sync fails with a 401 error, please logout and log back in to refresh your OAuth token.
                </p>
            </div>
            
            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                isDestructive={confirmModal.isDestructive}
                confirmText={confirmModal.confirmText}
            />
        </div>
    );
}

// Helper icon
const X = ({ size = 24, className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);
