import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playerService } from '../services/players';
import { fixtureService } from '../services/fixtures';
import { Check, X, AlertCircle, Ban, Stethoscope, HelpCircle, Clock, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

export default function AvailabilityTab({ match }) {
    const queryClient = useQueryClient();
    const teamSeasonId = match.team_season_id || 1; 

    // 1. Fetch Roster
    const { data: rosterData, isLoading: rosterLoading } = useQuery({
        queryKey: ['roster', teamSeasonId],
        queryFn: () => playerService.getByContext(teamSeasonId),
        enabled: !!teamSeasonId
    });

    // 2. Fetch Availability
    const { data: availabilityData } = useQuery({
        queryKey: ['availability', match.id],
        queryFn: () => fixtureService.getAvailability(match.id)
    });

    // Map: PlayerID -> Status
    const availabilityMap = React.useMemo(() => {
        const map = {};
        if (availabilityData?.availability) {
            availabilityData.availability.forEach(a => {
                map[a.player_id] = a.status;
            });
        }
        return map;
    }, [availabilityData]);

    // State for Sorting and Filtering
    const [sortConfig, setSortConfig] = React.useState({ key: 'status', direction: 'asc' });
    const [statusFilters, setStatusFilters] = React.useState([]); 
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const close = () => setIsFilterOpen(false);
        if (isFilterOpen) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isFilterOpen]);

    // Status Options - Dynamic
    const statusOptions = React.useMemo(() => {
        const statuses = new Set();
        const players = rosterData?.players || [];
        const map = availabilityMap;
        players.forEach(p => {
             const s = map[p.id] || 'Unknown';
             if (s) statuses.add(s);
        });
        return Array.from(statuses).sort().map(s => ({
            label: s, value: s
        }));
    }, [rosterData, availabilityMap]);

    if (rosterLoading) return <div className="p-8 text-white">Loading Squad...</div>;

    const squad = rosterData?.players || [];
    
    // 1. Filter
    const filteredSquad = squad.filter(p => {
        // Exclude N/A
        if (p.name === '#N/A' || p.name === '0' || p.name === '') return false;

        // Exclude if player left before match
        if (p.left_date && match.date) {
            const matchDate = new Date(match.date);
            const leftDate = new Date(p.left_date);
            if (matchDate > leftDate) return false;
        }
        
        // Search Filter
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Status Filter (Multi-select Exact Match)
        if (statusFilters.length > 0) {
            const status = availabilityMap[p.id] || 'Unknown';
            if (!statusFilters.includes(status)) return false;
        }
        return true;
    });

    // 2. Sort
    const sortedSquad = filteredSquad.sort((a, b) => {
        const statA = (availabilityMap[a.id] || 'Unknown');
        const statB = (availabilityMap[b.id] || 'Unknown');
        
        let valA, valB;
        
        if (sortConfig.key === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else {
            // Sort by Status Text
            valA = statA.toLowerCase();
            valB = statB.toLowerCase();
            
            // Optional: Keep specific statuses at top?
            // User asked for "sorting works", implied alphabetical might be safest "works" interpretation
            // But usually "Available" is better at top.
            // Let's implement a simple priority map for common ones, alphabetical for rest.
            const priority = { 
                'selected': 0, 'available': 1, 'checking': 2 
            };
            const pA = priority[valA] !== undefined ? priority[valA] : 99;
            const pB = priority[valB] !== undefined ? priority[valB] : 99;
            
            // If both have priority, compare priority
            if (pA !== 99 || pB !== 99) {
                 if (pA !== pB) return pA - pB;
            }
            // Otherwise alphabetical
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };
    
    const toggleStatusFilter = (val, e) => {
        e.stopPropagation(); // Prevent window click from closing immediately
        setStatusFilters(prev => 
            prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
        );
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('selected') && !s.includes('not')) return 'bg-green-900/30 text-green-400 border-green-800/50';
        if (s.includes('available')) return 'bg-amber-900/30 text-amber-400 border-amber-800/50';
        if (s.includes('declined')) return 'bg-red-900/30 text-red-500 border-red-800/50';
        if (s.includes('not selected')) return 'bg-red-900/10 text-red-300 border-red-800/30';
        if (s.includes('concussion') || s.includes('injured') || s.includes('ill')) return 'bg-rose-900/30 text-rose-400 border-rose-800/50';
        if (s.includes('dns') || s.includes('cna')) return 'bg-blue-900/30 text-blue-400 border-blue-800/50';
        if (s.includes('no answer') || s.includes('checking')) return 'bg-slate-700/50 text-slate-400 border-slate-600';
        
        return 'bg-slate-800 text-slate-500 border-slate-700'; // Default / Unknown
    };
    
    const getStatusIcon = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('selected') && !s.includes('not')) return <Check size={14} />;
        if (s.includes('available')) return <Check size={14} className="opacity-50" />;
        if (s.includes('declined')) return <X size={14} />;
        if (s.includes('not selected')) return <Ban size={14} />;
        if (s.includes('concussion') || s.includes('injured') || s.includes('ill')) return <Stethoscope size={14} />;
        if (s.includes('dns') || s.includes('cna')) return <ShieldAlert size={14} />;
        if (s.includes('checking')) return <Clock size={14} />;
        
        return <HelpCircle size={14} />;
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center overflow-visible">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-white">Squad Availability</h3>
                        <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 rounded bg-amber-900/20 text-amber-400 border border-amber-900/30">
                                {Object.values(availabilityMap).filter(s => (s||'').toLowerCase().includes('available')).length} Avail
                            </span>
                            <span className="text-xs px-2 py-1 rounded bg-green-900/20 text-green-400 border border-green-900/30">
                                {Object.values(availabilityMap).filter(s => (s||'').toLowerCase().includes('selected') && !(s||'').toLowerCase().includes('not')).length} Sel
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto items-center">
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="bg-slate-900/50 border border-slate-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-full sm:w-48"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        
                        <div className="relative">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                                className="bg-slate-900/50 border border-slate-700 rounded px-3 py-1 text-sm text-white hover:bg-slate-800 focus:outline-none flex items-center gap-2 whitespace-nowrap"
                            >
                                {statusFilters.length === 0 ? 'All Statuses' : `${statusFilters.length} Selected`}
                                <span className="text-xs">▼</span>
                            </button>
                            
                            {isFilterOpen && (
                                <div 
                                    className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 w-48 p-2 flex flex-col gap-1"
                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                                >
                                    {statusOptions.map(opt => (
                                        <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer text-sm text-slate-200">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-offset-slate-900"
                                                checked={statusFilters.includes(opt.value)}
                                                onChange={(e) => toggleStatusFilter(opt.value, e)}
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                    <button 
                                        className="text-xs text-blue-400 hover:text-blue-300 mt-1 pt-1 border-t border-slate-700 text-center"
                                        onClick={() => setStatusFilters([])}
                                    >
                                        Reset Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-slate-400 font-medium">
                        <tr>
                            <th 
                                className="p-4 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => handleSort('name')}
                            >
                                Player {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                                className="p-4 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => handleSort('status')}
                            >
                                Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {sortedSquad.map(player => {
                            const status = availabilityMap[player.id] || 'Unknown';
                            return (
                                <tr key={player.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium text-white">{player.name}</div>
                                        <div className="text-xs text-slate-500">{player.position || 'Unknown Pos'}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(status))}>
                                            {getStatusIcon(status)} {status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-slate-400 hover:text-white text-xs underline">
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
