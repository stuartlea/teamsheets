import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixtureService } from '../services/fixtures';
import { Calendar, MapPin, Clock, ChevronLeft, Search, Home, X, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import LineupBuilder from '../components/LineupBuilder';
import AvailabilityTab from '../components/AvailabilityTab';
import TeamSheetPreview from '../components/TeamSheetPreview';
import MatchDetailsForm from '../components/MatchDetailsForm';

export default function MatchWorksheet() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showPreview, setShowPreview] = useState(false);

  const { data: matchData, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fixtureService.getById(matchId)
  });

  const match = matchData?.match;
  const queryClient = useQueryClient();

  const updateMatchMutation = useMutation({
    mutationFn: (data) => fixtureService.update(matchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['match', matchId]);
      queryClient.invalidateQueries(['match-team', matchId]); // Also invalidate team data as metadata is there
    }
  });

  const handleUpdateMatch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        kickoff: formData.get('kickoff'),
        meet_time: formData.get('meet_time'),
        location: formData.get('location'),
        opponent_name: formData.get('opponent_name')
    };
    updateMatchMutation.mutate(data);
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
                </div>
            </div>
            
            <div className="flex gap-2">
                 {/* Actions like "Generate PDF" will go here */}
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
            {['overview', 'lineup', 'availability'].map((tab) => (
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
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-700 pb-2">Match Details</h2>
                {match && (
                    <MatchDetailsForm match={match} onSubmit={handleUpdateMatch} isPending={updateMatchMutation.isPending} />
                )}
            </div>
        )}
        
        {activeTab === 'lineup' && match && (
             <LineupBuilder match={match} teamSeasonId={match.team_season_id} />
        )}

        {activeTab === 'availability' && (
             <AvailabilityTab match={match} />
        )}
      </div>

      <TeamSheetPreview 
        matchId={matchId} 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
      />
    </div>
  );
}
