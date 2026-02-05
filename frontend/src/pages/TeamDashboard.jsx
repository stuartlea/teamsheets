import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamService } from '../services/teams';
import { seasonService, fixtureService } from '../services/fixtures';
import { playerService } from '../services/players';
import { spondService } from '../services/spond';
import { Calendar, Users, Settings, ChevronDown, ListFilter, Shield, GitMerge, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import AddFixtureModal from '../components/AddFixtureModal';
import MergePlayersModal from '../components/MergePlayersModal';
import EditTeamModal from '../components/EditTeamModal';
import LinkSpondPlayersModal from '../components/LinkSpondPlayersModal';

export default function TeamDashboard() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [isAddFixtureOpen, setIsAddFixtureOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isLinkPlayersOpen, setIsLinkPlayersOpen] = useState(false);
  const [view, setView] = useState('fixtures'); // 'fixtures' | 'players'
  const [showLeft, setShowLeft] = useState(false);
  
  // 1. Fetch Team Details
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamService.getById(teamId)
  });

  // 2. Fetch All Contexts (Team-Seasons)
  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['contexts'],
    queryFn: seasonService.getContexts
  });

  const team = teamData?.team;
  
  // Filter contexts for THIS team
  const availableSeasons = contextData?.contexts?.filter(c => c.team_id === parseInt(teamId)) || [];
  
  // State for selected context (TeamSeason)
  const [selectedContext, setSelectedContext] = useState(null);

  // Auto-select latest/current season when availableSeasons loads
  useEffect(() => {
    if (availableSeasons.length > 0 && !selectedContext) {
      // Prefer "current" or last item
      const current = availableSeasons.find(c => c.season.is_current) || availableSeasons[availableSeasons.length - 1];
      setSelectedContext(current);
    }
  }, [availableSeasons]);

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
      queryFn: () => spondService.getMembers(team.spond_group_id),
      enabled: !!team?.spond_group_id
  });

  const spondMemberIds = new Set(spondMembersData?.members?.map(m => m.id) || []);

  const fixtures = fixtureData?.fixtures || [];
  
  // Filter Players
  const allPlayers = (rosterData?.players || []).filter(p => !['#N/A', '0', ''].includes(p.name));
  const displayedPlayers = allPlayers.filter(p => {
      if (showLeft) return true; // Show all
      return !p.left_date; // Hide if has left_date
  });

  if (teamLoading) return <div className="p-8 text-white">Loading Team...</div>;
  if (!team) return <div className="p-8 text-red-500">Team not found</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top Navigation Bar */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
             <Link to="/teams" className="text-slate-400 hover:text-white transition-colors">
                &larr; All Teams
             </Link>
             <Link to="/admin" className="text-slate-500 hover:text-white transition-colors text-sm flex items-center gap-1">
                 <Settings size={14} /> Admin
             </Link>

             <button 
                onClick={() => setIsEditTeamOpen(true)}
                className="text-slate-500 hover:text-blue-400 transition-colors text-sm flex items-center gap-1"
                title="Edit Team Settings"
             >
                 <Settings size={14} /> Edit Team
             </button>
             <div className="h-6 w-px bg-slate-800"></div>
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Shield size={16} />
                </div>
                <h1 className="font-bold text-lg">{team.name}</h1>
             </div>
        </div>

        {/* Season Switcher */}
        <div className="relative group">
            {availableSeasons.length > 0 ? (
                <div className="flex items-center gap-2">
                    <select 
                        className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-1.5 text-sm appearance-none cursor-pointer hover:border-slate-600 focus:outline-none focus:border-blue-500"
                        value={selectedContext?.id || ''}
                        onChange={(e) => {
                            const ctx = availableSeasons.find(s => s.id === parseInt(e.target.value));
                            setSelectedContext(ctx);
                        }}
                    >
                        {availableSeasons.map(ctx => (
                            <option key={ctx.id} value={ctx.id}>
                                {ctx.season.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <span className="text-slate-500 text-sm">No Active Seasons</span>
            )}
        </div>
      </nav>

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
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div 
                        className={`bg-slate-800 p-6 rounded-xl border ${view === 'fixtures' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'} shadow-sm cursor-pointer hover:bg-slate-750 transition-all`}
                        onClick={() => setView('fixtures')}
                    >
                        <div className="flex items-center gap-3 mb-2 text-slate-400">
                            <Calendar size={20} className={view === 'fixtures' ? 'text-blue-400' : ''} />
                            <h3 className="font-semibold uppercase text-xs tracking-wider">Next Fixture</h3>
                        </div>
                        {selectedContext.stats?.next_fixture ? (
                             <div>
                                <p className="text-xl font-bold">{selectedContext.stats.next_fixture.name}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    {selectedContext.stats.next_fixture.date} • {selectedContext.stats.next_fixture.kickoff_time || 'TBD'}
                                </p>
                             </div>
                        ) : (
                            <p className="text-lg text-slate-500 italic">No upcoming fixtures</p>
                        )}
                    </div>

                    <div 
                        className={`bg-slate-800 p-6 rounded-xl border ${view === 'players' ? 'border-green-500 ring-1 ring-green-500' : 'border-slate-700'} shadow-sm cursor-pointer hover:bg-slate-750 transition-all`}
                        onClick={() => setView('players')}
                    >
                        <div className="flex items-center gap-3 mb-2 text-slate-400">
                            <Users size={20} className={view === 'players' ? 'text-green-400' : ''} />
                            <h3 className="font-semibold uppercase text-xs tracking-wider">Squad Size</h3>
                        </div>
                        <p className="text-2xl font-bold">{allPlayers.length || selectedContext.stats?.player_count || 0} Players</p>
                        <p className="text-sm text-slate-500 mt-1">Active in this season</p>
                    </div>
                    
                     <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm opacity-75">
                        <div className="flex items-center gap-3 mb-2 text-slate-400">
                             <ListFilter size={20} />
                            <h3 className="font-semibold uppercase text-xs tracking-wider">Total Fixtures</h3>
                        </div>
                        <p className="text-2xl font-bold">{fixtures.length}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    {view === 'fixtures' ? (
                        <>
                            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                                <h2 className="font-bold flex items-center gap-2">
                                    <Calendar size={18} className="text-blue-400" /> Fixtures ({fixtures.length})
                                </h2>
                                <button 
                                    onClick={() => setIsAddFixtureOpen(true)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-white font-medium flex items-center gap-1"
                                >
                                    + Add Fixture
                                </button>
                            </div>
                            <div className="divide-y divide-slate-700">
                                {fixtures.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 text-sm">
                                        No fixtures found for this season.
                                    </div>
                                ) : (
                                    fixtures.map(match => (
                                        <div 
                                            key={match.id} 
                                            onClick={() => navigate(`/match/${match.id}`)}
                                            className="p-4 hover:bg-slate-750 flex justify-between items-center group cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-center w-16">
                                                    <div className="text-xs font-bold uppercase text-slate-400">
                                                        {match.date ? format(new Date(match.date), 'MMM') : 'TBD'}
                                                    </div>
                                                    <div className="text-xl font-bold text-white">
                                                         {match.date ? format(new Date(match.date), 'dd') : '-'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                        {match.name}
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
                        </>
                    ) : (
                        <>
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
                                            onChange={(e) => setShowLeft(e.target.checked)}
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
                        </>
                    )}
                </div>
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
