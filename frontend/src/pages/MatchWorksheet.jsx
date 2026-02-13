import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixtureService } from '../services/fixtures';
import { Calendar, MapPin, Clock, ChevronLeft, Search, Home, X, ExternalLink, RefreshCw, Link as LinkIcon, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import LineupBuilder from '../components/LineupBuilder';
import AvailabilityTab from '../components/AvailabilityTab';
import TeamSheetPreview from '../components/TeamSheetPreview';
import LinkSpondEventModal from '../components/LinkSpondEventModal';
import { spondService } from '../services/spond';

import MatchDetailsForm from '../components/MatchDetailsForm';
import MatchResultForm from '../components/MatchResultForm';

export default function MatchWorksheet() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showPreview, setShowPreview] = useState(false);
  const [isLinkSpondOpen, setIsLinkSpondOpen] = useState(false);
  const [spondLinkMode, setSpondLinkMode] = useState('event'); // 'event' or 'availability'

  const { data: matchData, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fixtureService.getById(matchId)
  });

  const match = matchData;
  const queryClient = useQueryClient();

  const updateMatchMutation = useMutation({
    mutationFn: (data) => fixtureService.update(matchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['match', matchId]);
      queryClient.invalidateQueries(['match-team', matchId]); 
    }
  });

  const syncSpondMutation = useMutation({
    mutationFn: (id) => spondService.syncMatch(id),
    onSuccess: (data) => {
        queryClient.invalidateQueries(['match', matchId]); 
        queryClient.invalidateQueries(['availability', matchId]); 
        queryClient.invalidateQueries(['match-team', matchId]);
        alert(data.message || "Synced with Spond successfully");
    },
    onError: (err) => {
        alert("Failed to sync: " + (err.response?.data?.error || err.message));
    }
  });

  const handleUpdateMatch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        kickoff_time: formData.get('kickoff'),
        meet_time: formData.get('meet_time'),
        location: formData.get('location'),
        opponent_name: formData.get('opponent_name')
    };
    updateMatchMutation.mutate(data);
  };
  
  const openLinkModal = (mode) => {
      setSpondLinkMode(mode);
      setIsLinkSpondOpen(true);
  };


  if (isLoading) return <div className="p-8 text-white">Loading Match...</div>;
  if (!match) return <div className="p-8 text-red-500">Match not found</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-6">
        <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm transition-colors"
        >
            <ChevronLeft size={16} /> Back to Team
        </button>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    {match.opponent_name ? (
                        <span><span className="text-slate-500 font-normal text-xl">vs</span> {match.opponent_name}</span>
                    ) : (
                        match.name || 'Fixture'
                    )}
                </h1>
                <div className="flex items-center gap-4 text-slate-400 mt-2 text-sm">
                    <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {match.date ? format(new Date(match.date), 'EEEE, d MMMM yyyy') : 'Date TBD'}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {match.kickoff_time || 'Time TBD'}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <MapPin size={14} />
                        {match.location || 'Location TBD'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${match.home_away === 'Home' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                        {match.home_away || 'Home'}
                    </span>
                    {match.is_cancelled && (
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-900 text-red-300 flex items-center gap-1">
                            <AlertCircle size={10} /> Cancelled
                        </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Source: {match.source || 'Manual'}
                    </span>
                </div>
            </div>
            
            <div className="flex gap-2">
                 <button 
                    onClick={() => setShowPreview(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                 >
                    Preview Team Sheet
                 </button>
            </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-6">
        <div className="flex gap-6">
            {['overview', 'lineup', 'availability', 'result'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                        "py-3 text-sm font-medium border-b-2 transition-colors capitalize",
                        activeTab === tab 
                            ? "border-blue-500 text-blue-400" 
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                >
                    {tab}
                </button>
            ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Match Details Settings */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-700 pb-2">Match Details</h2>
                    <MatchDetailsForm match={match} onSubmit={handleUpdateMatch} isPending={updateMatchMutation.isPending} />
                </div>
                
                {/* Spond Integration Panel */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-fit">
                    <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                        <img src="https://spond.com/favicon.ico" className="w-5 h-5 grayscale opacity-70" alt="" />
                        Spond Integration
                    </h2>
                    
                    <div className="space-y-6">
                        {/* Match Event Link */}
                        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <div>
                                <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                                    <Calendar size={14} className="text-blue-500" />
                                    Match Event
                                </h3>
                                <div className="text-xs text-slate-500 mt-1">
                                    {match.spond_event_id ? (
                                        <span className="text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Linked</span>
                                    ) : (
                                        "Not linked"
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => openLinkModal('event')}
                                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded transition-colors"
                            >
                                {match.spond_event_id ? 'Edit Link' : 'Link Event'}
                            </button>
                        </div>
                        
                        {/* Availability Request Link */}
                        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <div>
                                <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                                    <Smartphone size={14} className="text-purple-500" />
                                    Availability Request
                                </h3>
                                <div className="text-xs text-slate-500 mt-1">
                                    {match.spond_availability_id ? (
                                        <span className="text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Linked</span>
                                    ) : (
                                        "Not linked"
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => openLinkModal('availability')}
                                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded transition-colors"
                            >
                                {match.spond_availability_id ? 'Edit Link' : 'Link Availability'}
                            </button>
                        </div>
                        
                        {/* Sync Action */}
                        <div className="pt-4 border-t border-slate-700">
                            <button 
                                onClick={() => syncSpondMutation.mutate(match.id)}
                                disabled={syncSpondMutation.isPending || (!match.spond_event_id && !match.spond_availability_id)}
                                className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 hover:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={16} className={syncSpondMutation.isPending ? "animate-spin" : ""} />
                                {syncSpondMutation.isPending ? "Syncing..." : "Sync Availability from Spond"}
                            </button>
                            <p className="text-[10px] text-slate-500 text-center mt-2">
                                Pulls response status (Attending/Declined) for linked players.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {activeTab === 'lineup' && match && (
             <LineupBuilder match={match} teamSeasonId={match.team_season_id} />
        )}

        {activeTab === 'availability' && (
             <AvailabilityTab match={match} />
        )}

        {activeTab === 'result' && (
            <MatchResultForm match={match} />
        )}
      </div>

      <TeamSheetPreview 
        matchId={matchId} 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)} 
      />
      <LinkSpondEventModal 
        isOpen={isLinkSpondOpen}
        onClose={() => setIsLinkSpondOpen(false)}
        match={match}
        mode={spondLinkMode}
      />
    </div>
  );
}
