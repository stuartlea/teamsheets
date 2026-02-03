import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fixtureService } from '../services/fixtures';
import Modal from './Modal';

export default function AddFixtureModal({ isOpen, onClose, teamSeasonId }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    opponent: '',
    date: '',
    time: '14:00', // Default KO
    location: 'Home',
    match_format_id: 1 // Default to 1 for now
  });

  const createMutation = useMutation({
    mutationFn: (data) => fixtureService.create({
      ...data,
      team_season_id: teamSeasonId,
      name: `vs ${data.opponent}`, // Auto-generate name for now
      home_away: data.location
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['fixtures']);
      onClose();
      setFormData({ opponent: '', date: '', time: '14:00', location: 'Home', match_format_id: 1 });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Fixture">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Opponent</label>
          <input
            type="text"
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Macclesfield"
            value={formData.opponent}
            onChange={e => setFormData({...formData, opponent: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
            <input
                type="date"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
            />
           </div>
           <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Kickoff Time</label>
            <input
                type="time"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
            />
           </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
          <div className="flex gap-4">
             <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="location" 
                    value="Home"
                    checked={formData.location === 'Home'}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    className="text-blue-600"
                />
                <span className="text-white">Home</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="location" 
                    value="Away"
                    checked={formData.location === 'Away'}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    className="text-blue-600"
                />
                <span className="text-white">Away</span>
             </label>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:text-white"
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
            >
                {createMutation.isPending ? 'Saving...' : 'Save Fixture'}
            </button>
        </div>
      </form>
    </Modal>
  );
}
