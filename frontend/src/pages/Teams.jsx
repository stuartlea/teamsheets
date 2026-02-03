import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { teamService } from '../services/teams';
import { Plus, Users, ChevronRight, Shield } from 'lucide-react';

export default function Teams() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // Fetch Teams
  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: teamService.getAll
  });
  
  const teams = data?.teams || [];

  // Create Team Mutation
  const createMutation = useMutation({
    mutationFn: teamService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']);
      setIsCreating(false);
      setNewTeamName('');
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      createMutation.mutate({ name: newTeamName });
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen text-slate-400">
      Loading Teams...
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen text-red-500">
      Error loading teams: {error.message}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Teams</h1>
            <p className="text-slate-400">Select a team to manage</p>
          </div>
          
          {/* TODO: Check Admin Permission */}
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span>Add Team</span>
          </button>
        </header>

        {/* Create Team Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="mb-8 bg-slate-800 p-6 rounded-xl border border-slate-700 fade-in">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Team</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Team Name (e.g. U15s Eagles)"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <div 
              key={team.id}
              onClick={() => navigate(`/team/${team.id}`)}
              className="group bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-blue-400">
                  <Shield size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {team.name}
                  </h2>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                   Manage Squad & Fixtures
                  </p>
                </div>
              </div>
              <ChevronRight className="text-slate-600 group-hover:text-blue-400 transition-colors" />
            </div>
          ))}

          {teams.length === 0 && !isCreating && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-800 border-dashed">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No teams found. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
