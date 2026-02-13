import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamService } from '../services/teams';
import { seasonService, fixtureService } from '../services/fixtures';
import { playerService } from '../services/players';
import { spondService } from '../services/spond';
import { Calendar, Users, Settings, ChevronDown, ListFilter, Shield, GitMerge, Link as LinkIcon, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import AddFixtureModal from '../components/AddFixtureModal';
import MergePlayersModal from '../components/MergePlayersModal';
import EditTeamModal from '../components/EditTeamModal';
import LinkSpondPlayersModal from '../components/LinkSpondPlayersModal';
import { useTeam } from '../context/TeamContext';

export default function TeamDashboard() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setContext, activeSeason, currentTeam } = useTeam();
  
  const [isAddFixtureOpen, setIsAddFixtureOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isLinkPlayersOpen, setIsLinkPlayersOpen] = useState(false);
  
  const view = searchParams.get('view') || 'overview';
  const showLeft = searchParams.get('showLeft') === 'true';

  // Filter State
  const [filters, setFilters] = useState({
      search: '',
      startDate: '',
      endDate: '',
      status: 'all', // all, active, cancelled
      location: 'all' // all, home, away
  });
  
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamService.getById(teamId)
  });

  // 2. Fetch All Contexts (Team-Seasons)
  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['contexts'],
    queryFn: seasonService.getContexts
  });

  // Sync Context
  useEffect(() => {
    if (teamData && contextData) {
        const availableSeasons = Array.isArray(contextData) ? contextData.filter(c => c.team?.id === parseInt(teamId)) : [];
        
        let initialSeason = activeSeason;
        if (!initialSeason || initialSeason.team.id !== parseInt(teamId)) {
             initialSeason = availableSeasons.find(c => c.season?.is_current) || availableSeasons[availableSeasons.length - 1];
        }

        setContext(teamData, availableSeasons, initialSeason);
    }
  }, [teamData, contextData, teamId]);

  // Use props from context if available, or fallbacks (though mostly context drives this now)
  const team = teamData;
  const selectedContext = activeSeason; // Driven by context now

  // New: Fetch Stats Leaderboards
  const { data: statsData } = useQuery({
      queryKey: ['team-stats', selectedContext?.id],
      queryFn: () => seasonService.getStats(selectedContext.id),
      enabled: !!selectedContext
  });

  // 3. Fetch Fixtures for selected context
  const { data: fixtureData, isLoading: fixtureLoading } = useQuery({
    queryKey: ['fixtures', selectedContext?.id],
    queryFn: () => fixtureService.getFixtures(selectedContext.id),
    enabled: !!selectedContext
  });
  
  // 4. Fetch Players for selected context
  const { data: rosterData } = useQuery({
      queryKey: ['roster', selectedContext?.id],
      queryFn: () => playerService.getByContext(selectedContext.id),
      enabled: !!selectedContext
  });

  // 5. Fetch Spond Members for validation
  const { data: spondMembersData } = useQuery({
      queryKey: ['spondMembers', team?.spond_group_id],
      queryFn: () => spondService.getMembers(team?.spond_group_id),
      enabled: !!team?.spond_group_id
  });

  const spondMemberIds = new Set(spondMembersData?.members?.map(m => m.id) || []);

  const fixtures = Array.isArray(fixtureData) ? fixtureData : [];
  
  // Filter Players
  const allPlayers = (Array.isArray(rosterData) ? rosterData : []).filter(p => !['#N/A', '0', ''].includes(p.name));
  const displayedPlayers = allPlayers.filter(p => {
      if (showLeft) return true; // Show all
      return !p.left_date; // Hide if has left_date
  });

  if (teamLoading) return <div className="p-8 text-white">Loading Team...</div>;
  if (!team) return <div className="p-8 text-red-500">Team not found</div>;

    const filteredFixtures = fixtures.filter(match => {
        // Search
        if (filters.search && !match.opponent_name?.toLowerCase().includes(filters.search.toLowerCase()) && !match.name?.toLowerCase().includes(filters.search.toLowerCase())) return false;
        
        // Date
        if (filters.startDate && (!match.date || new Date(match.date) < new Date(filters.startDate))) return false;
        if (filters.endDate && (!match.date || new Date(match.date) > new Date(filters.endDate))) return false;

        // Status
        if (filters.status === 'active' && match.is_cancelled) return false;
        if (filters.status === 'cancelled' && !match.is_cancelled) return false;

        // Location
        if (filters.location !== 'all') {
            const isHome = match.home_away === 'Home';
            if (filters.location === 'home' && !isHome) return false;
            if (filters.location === 'away' && isHome) return false;
        }

        return true;
    });


    const renderLeaderboard = (title, data, valueKey, subtextKey = null) => (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/30 flex items-center gap-2">
                 <Shield size={16} className="text-blue-400" />
                 <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">{title}</h3>
            </div>
            <div className="divide-y divide-slate-700/50">
                {(!data || data.length === 0) ? (
                    <div className="p-4 text-center text-slate-500 text-sm italic">No data yet</div>
                ) : (
                    data.map((player, idx) => (
                        <div key={player.id} className="p-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono font-bold w-4 text-center ${idx === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <div className="font-medium text-slate-200 text-sm">{player.name}</div>
                                    {subtextKey && player[subtextKey] && (
                                        <div className="text-[10px] text-slate-500">{player[subtextKey]}</div>
                                    )}
                                </div>
                            </div>
                            <div className="font-bold text-white text-sm">
                                {player[valueKey]}
                                {title.includes('Percentage') && '%'}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="flex justify-end">
                 <button 
                    onClick={() => setIsEditTeamOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium border border-slate-700"
                >
                    <Settings size={16} /> Edit Team Settings
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-750 transition-all"
                    onClick={() => {
                        if (selectedContext.stats?.next_fixture?.id) {
                            navigate(`/match/${selectedContext.stats.next_fixture.id}`);
                        } else {
                            setSearchParams({ view: 'fixtures' });
                        }
                    }}
                >
                    <div className="flex items-center gap-3 mb-2 text-slate-400">
                        <Calendar size={20} />
                        <h3 className="font-semibold uppercase text-xs tracking-wider">Next Fixture</h3>
                    </div>
                    {selectedContext.stats?.next_fixture ? (
                            <div>
                            <p className="text-xl font-bold text-white">{selectedContext.stats.next_fixture.name}</p>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedContext.stats.next_fixture.date} • {selectedContext.stats.next_fixture.kickoff_time || 'TBD'}
                            </p>
                            </div>
                    ) : (
                        <p className="text-lg text-slate-500 italic">No upcoming fixtures</p>
                    )}
                </div>

                <div 
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-750 transition-all"
                    onClick={() => setSearchParams({ view: 'players' })}
                >
                    <div className="flex items-center gap-3 mb-2 text-slate-400">
                        <Users size={20} />
                        <h3 className="font-semibold uppercase text-xs tracking-wider">Squad Status</h3>
                    </div>
                    <div className="flex items-baseline gap-2">
                         <span className="text-2xl font-bold text-white">
                            {allPlayers.filter(p => !p.left_date).length}
                         </span>
                         <span className="text-sm font-medium text-slate-400">Active</span>
                    </div>
                    
                    {allPlayers.filter(p => p.left_date).length > 0 && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
                            <span className="text-lg font-bold text-red-400">
                                {allPlayers.filter(p => p.left_date).length}
                            </span>
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Left Season</span>
                        </div>
                    )}
                </div>
                
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm col-span-1 md:col-span-1 min-h-[160px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 text-slate-400">
                            <ListFilter size={20} />
                            <h3 className="font-semibold uppercase text-xs tracking-wider">Season Record</h3>
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                            {selectedContext.stats?.played || 0} Played
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                            {/* Win/Loss Record */}
                            <div>
                            <div className="text-3xl font-bold flex items-baseline gap-1.5 mb-2">
                                <span className="text-green-400">{selectedContext.stats?.won || 0}</span>
                                <span className="text-slate-600 text-sm">-</span>
                                <span className="text-slate-400">{selectedContext.stats?.drawn || 0}</span>
                                <span className="text-slate-600 text-sm">-</span>
                                <span className="text-red-400">{selectedContext.stats?.lost || 0}</span>
                            </div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">W - D - L</div>
                            </div>

                            {/* Points Summary */}
                            <div className="text-right">
                            <div className="text-xl font-bold text-slate-200 mb-1">
                                {selectedContext.stats?.points_for || 0} <span className="text-slate-600 text-sm mx-1">/</span> {selectedContext.stats?.points_against || 0}
                            </div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Points (F/A)</div>
                            </div>
                    </div>

                    {/* Detailed Stats Grid */}
                    <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-y-2 text-sm">
                            <div className="flex justify-between pr-4 border-r border-slate-700">
                            <span className="text-slate-400">Tries For</span>
                            <span className="font-bold text-white">{selectedContext.stats?.tries_for || 0}</span>
                            </div>
                            <div className="flex justify-between pl-4">
                            <span className="text-slate-400">Tries Against</span>
                            <span className="font-bold text-white">{selectedContext.stats?.tries_against || 0}</span>
                            </div>

                            <div className="flex justify-between pr-4 border-r border-slate-700">
                            <span className="text-slate-400">Cons Scored</span>
                            <span className="font-bold text-green-400">{selectedContext.stats?.cons_for || 0}</span>
                            </div>
                            <div className="flex justify-between pl-4">
                            <span className="text-slate-400">Cons Missed</span>
                            <span className="font-bold text-red-400">
                                {Math.max(0, (selectedContext.stats?.tries_for || 0) - (selectedContext.stats?.cons_for || 0))}
                            </span>
                            </div>
                    </div>
                </div>
            </div>

            {/* Stats Leaderboards */}
            <h3 className="text-lg font-bold text-white mt-8 flex items-center gap-2">
                <Shield className="text-yellow-500" size={20} /> Season Leaders
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderLeaderboard('Top Try Scorers', statsData?.top_try_scorers, 'tries')}
                
                {(selectedContext?.scoring_type !== 'tries_only') && (
                    renderLeaderboard('Top Point Scorers', statsData?.top_point_scorers, 'points')
                )}

                {(selectedContext?.scoring_type !== 'tries_only') && (
                     renderLeaderboard('Top Goal Kickers', statsData?.top_goal_kickers, 'goals', 'details')
                )}

                {(selectedContext?.scoring_type !== 'tries_only') && (
                     renderLeaderboard('Goal Kicking %', statsData?.top_kick_percentage, 'percentage', 'details')
                )}
            </div>
        </div>
    );

    return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      
      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        
        {!selectedContext ? (
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                <Settings size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">No active seasons found for this team.</p>
                <p className="text-sm mt-2">Associate this team with a season to start managing fixtures.</p>
            </div>
        ) : (
            <>  
                {/* Overview View */}
                {(!view || view === 'overview') && renderOverview()}

                {/* Fixtures View */}
                {view === 'fixtures' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-700 flex flex-col gap-4 bg-slate-900/50">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold flex items-center gap-2">
                                    <Calendar size={18} className="text-blue-400" /> Fixtures ({filteredFixtures.length})
                                </h2>
                                <button 
                                    onClick={() => setIsAddFixtureOpen(true)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-white font-medium flex items-center gap-1"
                                >
                                    + Add Fixture
                                </button>
                            </div>
                            
                            {/* Filters Toolbar */}
                            <div className="flex flex-wrap items-center gap-3 pb-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                                    <input 
                                        placeholder="Search opponent..." 
                                        className="bg-slate-800 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-sm text-white w-48 focus:border-blue-500 outline-none"
                                        value={filters.search}
                                        onChange={e => setFilters({...filters, search: e.target.value})}
                                    />
                                </div>
                                
                                <select 
                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300 focus:border-blue-500 outline-none"
                                    value={filters.location}
                                    onChange={e => setFilters({...filters, location: e.target.value})}
                                >
                                    <option value="all">All Locations</option>
                                    <option value="home">Home Only</option>
                                    <option value="away">Away Only</option>
                                </select>

                                <select 
                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300 focus:border-blue-500 outline-none"
                                    value={filters.status}
                                    onChange={e => setFilters({...filters, status: e.target.value})}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active Only</option>
                                    <option value="cancelled">Cancelled Only</option>
                                </select>

                                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-2 py-1">
                                    <span className="text-xs text-slate-500 uppercase font-bold">From</span>
                                    <input 
                                        type="date" 
                                        className="bg-transparent text-sm text-white outline-none w-32"
                                        value={filters.startDate}
                                        onChange={e => setFilters({...filters, startDate: e.target.value})}
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-2 py-1">
                                    <span className="text-xs text-slate-500 uppercase font-bold">To</span>
                                    <input 
                                        type="date" 
                                        className="bg-transparent text-sm text-white outline-none w-32"
                                        value={filters.endDate}
                                        onChange={e => setFilters({...filters, endDate: e.target.value})}
                                    />
                                </div>

                                {(filters.search || filters.startDate || filters.endDate || filters.status !== 'all' || filters.location !== 'all') && (
                                    <button 
                                        onClick={() => setFilters({ search: '', startDate: '', endDate: '', status: 'all', location: 'all' })}
                                        className="text-xs text-red-400 hover:text-red-300 ml-auto"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {filteredFixtures.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">
                                    No fixtures found matching filters.
                                </div>
                            ) : (
                                filteredFixtures.map(match => (
                                    <div 
                                        key={match.id} 
                                        onClick={() => navigate(`/match/${match.id}`)}
                                        className={`p-4 hover:bg-slate-750 flex justify-between items-center group cursor-pointer transition-colors ${match.is_cancelled ? 'opacity-60 bg-red-900/10' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-center w-16">
                                                <div className="text-xs font-bold uppercase text-slate-400">
                                                    {match.date ? format(new Date(match.date), 'MMM') : 'TBD'}
                                                </div>
                                                <div className={`text-xl font-bold ${match.is_cancelled ? 'text-red-400 line-through' : 'text-white'}`}>
                                                        {match.date ? format(new Date(match.date), 'dd') : '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className={`font-semibold transition-colors flex items-center gap-2 ${match.is_cancelled ? 'text-slate-400 line-through' : 'text-white group-hover:text-blue-400'}`}>
                                                    {match.opponent_name || match.name}
                                                    {match.is_cancelled && (
                                                        <span className="no-underline px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-red-900 text-red-300 border border-red-800 flex items-center gap-1">
                                                            Cancelled
                                                        </span>
                                                    )}
                                                    {match.result && (
                                                        <span className={`no-underline px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border flex items-center gap-1 ${
                                                            match.result === 'W' ? 'bg-green-900/50 text-green-400 border-green-800' :
                                                            match.result === 'L' ? 'bg-red-900/50 text-red-400 border-red-800' :
                                                            'bg-slate-700 text-slate-300 border-slate-600'
                                                        }`}>
                                                            {match.result} {match.result_home_score}-{match.result_away_score}
                                                        </span>
                                                    )}
                                                </h3>
                                                <div className="text-sm text-slate-500 flex items-center gap-2">
                                                    <span className={`px-1.5 rounded text-[10px] uppercase font-bold ${match.home_away === 'Home' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                                        {match.home_away || 'Home'}
                                                    </span>
                                                    <span>{match.kickoff_time || 'Time TBD'}</span>
                                                    <span>•</span>
                                                    <span>{match.location || 'Location TBD'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <ChevronDown className="text-slate-600 -rotate-90" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Players View */}
                {view === 'players' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h2 className="font-bold flex items-center gap-2">
                                <Users size={18} className="text-green-400" /> Players ({displayedPlayers.length})
                            </h2>
                            <div className="flex items-center gap-4">
                                {team?.spond_group_id && (
                                    <button 
                                        onClick={() => setIsLinkPlayersOpen(true)}
                                        className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-800/50 px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition-colors"
                                        title="Manage Spond Links"
                                    >
                                        <LinkIcon size={14} /> Link Spond
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsMergeModalOpen(true)}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition-colors"
                                    title="Merge duplicate players"
                                >
                                    <GitMerge size={14} /> Merge
                                </button>
                                
                                <div className="h-4 w-px bg-slate-700"></div>

                                <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showLeft}
                                        onChange={(e) => setSearchParams({ view, showLeft: e.target.checked })}
                                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-offset-slate-900"
                                    />
                                    Show Left Players
                                </label>
                            </div>
                        </div>
                        {displayedPlayers.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No players found. Sync from spreadsheet to populate.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700">
                                {displayedPlayers.map(player => {
                                    const isLinked = !!player.spond_id;
                                    const isValidLink = isLinked && spondMemberIds.has(player.spond_id);
                                    const isBrokenLink = isLinked && !isValidLink && spondMembersData; // Only show broken if data loaded

                                    return (
                                    <Link 
                                        key={player.id}
                                        to={`/player/${player.id}`}
                                        className={`p-4 hover:bg-slate-750 flex justify-between items-center group cursor-pointer transition-colors ${player.left_date ? 'opacity-50 bg-red-900/10' : ''}`}
                                    >
                                        <div>
                                            <h3 className={`font-bold transition-colors flex items-center gap-2 ${player.left_date ? 'text-red-400' : 'text-white group-hover:text-green-400'}`}>
                                                {player.name}
                                                {/* Spond Status Indicators */}
                                                {isValidLink && (
                                                    <span className="bg-green-500/10 text-green-400 border border-green-500/20 rounded p-0.5" title="Linked to Spond Member">
                                                        <LinkIcon size={12} />
                                                    </span>
                                                )}
                                                {isBrokenLink && (
                                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 text-[10px] uppercase font-bold flex items-center gap-1" title="Spond Member Not Found">
                                                        <LinkIcon size={12} /> Invalid Link
                                                    </span>
                                                )}
                                                {!isLinked && !player.left_date && (
                                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 rounded p-0.5" title="Not Linked to Spond">
                                                        <AlertCircle size={12} />
                                                    </span>
                                                )}

                                                {player.left_date && <span className="text-xs font-normal border border-red-500/50 rounded px-1.5 py-0.5 ml-2 text-red-500 uppercase tracking-wide">Left</span>}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {player.position || 'Unknown Position'} 
                                                {player.left_date && <span className="text-red-400/70 ml-2 text-xs">Left on {player.left_date}</span>}
                                            </p>
                                        </div>
                                        <ChevronDown className="text-slate-600 -rotate-90" />
                                    </Link>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </>
        )}

      </main>

      <AddFixtureModal 
        isOpen={isAddFixtureOpen} 
        onClose={() => setIsAddFixtureOpen(false)} 
        teamSeasonId={selectedContext?.id}
      />
      <MergePlayersModal 
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        players={allPlayers}
        contextId={selectedContext?.id}
      />
      <LinkSpondPlayersModal
        isOpen={isLinkPlayersOpen}
        onClose={() => setIsLinkPlayersOpen(false)}
        team={team}
        players={allPlayers}
      />
      <EditTeamModal 
        isOpen={isEditTeamOpen}
        onClose={() => setIsEditTeamOpen(false)}
        team={team}
      />
    </div>
  );
}
