import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spondService } from '../services/spond';
import { X, Link as LinkIcon, Calendar, Clock, AlertCircle, Filter, Trash2 } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import ConfirmModal from './ConfirmModal';

export default function LinkSpondEventModal({ isOpen, onClose, match, mode = 'event' }) {
    // mode: 'event' | 'availability'
    const queryClient = useQueryClient();
    
    // Determine current ID based on mode
    const currentId = mode === 'event' ? match?.spond_event_id : match?.spond_availability_id;
    
    const [selectedEventId, setSelectedEventId] = useState('');
    const [error, setError] = useState(null);
    const [showAllEvents, setShowAllEvents] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedEventId(currentId || '');
            setShowAllEvents(false);
            setError(null);
        }
    }, [isOpen, currentId]);

    // Get Group ID from Team Context
    const groupId = match?.team_spond_group_id;

    // Fetch Events for the Team's Group
    const { data: eventsData, isLoading: eventsLoading, isError: eventsError } = useQuery({
        queryKey: ['spond-events', groupId],
        queryFn: () => spondService.getEvents(groupId),
        enabled: isOpen && !!groupId
    });

    const events = eventsData?.events || [];

    // Filter events based on match date
    const filteredEvents = events.filter(event => {
        if (showAllEvents) return true;
        if (!event.startTimestamp || !match?.date) return true; 
        
        try {
            const eventDate = new Date(event.startTimestamp);
            const matchDate = new Date(match.date);
            return isSameDay(eventDate, matchDate);
        } catch (e) {
            return true;
        }
    });

    const linkMutation = useMutation({
        mutationFn: (data) => spondService.linkMatch(match.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['match', match.id]);
            onClose();
        },
        onError: (err) => {
            setError(err.response?.data?.error || err.message);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedEventId) {
            setError("Please select a Spond event.");
            return;
        }
        
        // Construct payload based on mode
        const payload = {};
        if (mode === 'event') {
            payload.spond_event_id = selectedEventId;
        } else {
            payload.spond_availability_id = selectedEventId;
        }
        
        linkMutation.mutate(payload);
    };

    const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);

    const handleUnlink = () => {
        setIsUnlinkConfirmOpen(true);
    };

    const confirmUnlink = () => {
        const payload = {};
        if (mode === 'event') {
            payload.spond_event_id = null;
        } else {
            payload.spond_availability_id = null;
        }
        
        linkMutation.mutate(payload);
    };

    if (!isOpen) return null;

    const title = mode === 'event' ? 'Link Match Event' : 'Link Availability Request';
    const description = mode === 'event' 
        ? 'Select the corresponding Spond event for this match.' 
        : 'Select the Spond event/request used for player availability.';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-xl relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <LinkIcon size={20} className="text-blue-500" />
                        {title}
                    </h2>
                    <div className="text-sm text-slate-400 mb-6">
                        {description}
                        {match?.date && (
                            <div className="flex items-center gap-2 mt-1 text-slate-500">
                                <Calendar size={14} /> Match Date: <span className="text-slate-300">{format(new Date(match.date), 'EEE, MMM d, yyyy')}</span>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    
                    {!groupId ? (
                        <div className="bg-amber-900/20 border border-amber-900/50 text-amber-200 p-4 rounded-lg text-sm text-center">
                            <p className="font-bold mb-1">Team Not Linked</p>
                            <p>This team is not linked to a Spond Group yet.</p>
                            <p className="mt-2 text-amber-400/70">Please go to the Team Dashboard and link the team to Spond first.</p>
                            <div className="mt-4">
                                <button 
                                    onClick={onClose}
                                    className="px-4 py-2 bg-amber-700/50 hover:bg-amber-700 text-white rounded transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Spond Events ({filteredEvents.length} shown)
                                    </label>
                                    <button 
                                        type="button"
                                        onClick={() => setShowAllEvents(!showAllEvents)}
                                        className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${showAllEvents ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    >
                                        <Filter size={12} />
                                        {showAllEvents ? 'Showing All' : 'Match Date Only'}
                                    </button>
                                </div>

                                {eventsLoading ? (
                                    <div className="text-sm text-slate-500 italic p-2">Loading events from Spond...</div>
                                ) : eventsError ? (
                                    <div className="text-sm text-red-500 p-2">Failed to load events. Check credentials.</div>
                                ) : (
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredEvents.length === 0 ? (
                                            <div className="text-sm text-slate-500 bg-slate-900/50 p-6 rounded text-center border border-slate-700 border-dashed">
                                                <p className="mb-2">No events found matching the match date.</p>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowAllEvents(true)}
                                                    className="text-blue-400 hover:text-blue-300 underline"
                                                >
                                                    Show all upcoming events
                                                </button>
                                            </div>
                                        ) : (
                                            filteredEvents.map(event => (
                                                <label 
                                                    key={event.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                        selectedEventId === event.id 
                                                            ? 'bg-blue-900/20 border-blue-500/50 ring-1 ring-blue-500/50' 
                                                            : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                                                    }`}
                                                >
                                                    <input 
                                                        type="radio" 
                                                        name="spond_event" 
                                                        value={event.id}
                                                        checked={selectedEventId === event.id}
                                                        onChange={() => setSelectedEventId(event.id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-white text-sm">
                                                            {event.heading}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                                                            <span className={`flex items-center gap-1 ${match?.date && isSameDay(new Date(event.startTimestamp), new Date(match.date)) ? 'text-green-400' : ''}`}>
                                                                <Calendar size={12} />
                                                                {event.startTimestamp ? format(new Date(event.startTimestamp), 'MMM d, HH:mm') : 'TBD'}
                                                            </span>
                                                            {event.location && (
                                                                <span>{event.location.feature || event.location.address}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
                                 {/* Left side: Remove Link button (only if linked) */}
                                 {currentId ? (
                                    <button
                                        type="button"
                                        onClick={handleUnlink}
                                        className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Remove Link
                                    </button>
                                 ) : (
                                    <div></div> // Spacer
                                 )}

                                <div className="flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={linkMutation.isPending || !selectedEventId}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
                                    >
                                        {linkMutation.isPending ? 'Linking...' : 'Link Selected'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <ConfirmModal 
                isOpen={isUnlinkConfirmOpen}
                onClose={() => setIsUnlinkConfirmOpen(false)}
                onConfirm={confirmUnlink}
                title="Unlink Spond Event"
                message="Are you sure you want to remove the link to this Spond event? Availability data syncing will stop for this match."
                confirmText="Unlink"
                isDestructive={true}
            />
        </>
    );
}
