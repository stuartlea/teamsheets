import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Search, Home, X, MapPin } from 'lucide-react';
import { fixtureService } from '../services/fixtures';
import { playerService } from '../services/players';

export default function MatchDetailsForm({ match, onSubmit, isPending }) {
    const [kickoff, setKickoff] = useState(match.kickoff_time || '');
    const [meetTime, setMeetTime] = useState(match.meet_time || '');
    const [location, setLocation] = useState(match.location || '');
    const [opponent, setOpponent] = useState(match.opponent_name || '');
    const [notes, setNotes] = useState(match.notes || '');
    const [featuredPlayer, setFeaturedPlayer] = useState(match.featured_player || '');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Fetch roster for featured player dropdown
    const { data: rosterData } = useQuery({
        queryKey: ['roster'],
        queryFn: playerService.getAll
    });
    const players = rosterData || [];

    // Fetch historical locations
    const { data: locationsData } = useQuery({
        queryKey: ['locations'],
        queryFn: fixtureService.getLocations,
        staleTime: 5 * 60 * 1000 // 5 mins
    });

    const locations = locationsData?.locations || [];

    // Auto-populate Home
    useEffect(() => {
        const isHome = (match.home_away || '').toLowerCase() === 'home' || (match.home_away || '').toLowerCase() === 'h';
        if (isHome && !match.location && !location) {
            setLocation('Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA');
        }
    }, [match.home_away, match.location]); // Only runs if match data implies home and no location set

    const handleKickoffChange = (e) => {
        const val = e.target.value;
        setKickoff(val);
        
        // Auto-calculate meet time if meet time is empty and valid kickoff
        if (!meetTime && val.match(/^\d{2}:\d{2}$/)) {
            const [hours, mins] = val.split(':').map(Number);
            let meetH = hours - 1;
            if (meetH < 0) meetH += 24;
            const newMeet = `${meetH.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            setMeetTime(newMeet);
        }
    };

    const handleSetHome = () => {
        setLocation('Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA');
    };

    const handleSearchLocation = () => {
        let cleanName = (opponent || match.name || '').replace(/RUFC/i, '').replace(/RFC/i, '').trim();
        const query = `get me the address of ${cleanName} RUFC`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Opponent Name</label>
                <input 
                    name="opponent_name" 
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder={match.name}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Used for searches and team sheets.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-400 mb-1">Kickoff Time</label>
                    <div className="relative">
                        <input 
                            name="kickoff" 
                            value={kickoff}
                            onChange={handleKickoffChange}
                            placeholder="HH:MM"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none"
                        />
                        <Clock className="absolute left-2.5 top-2.5 text-slate-500" size={16} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-400 mb-1">Meet Time</label>
                    <div className="relative">
                        <input 
                            name="meet_time" 
                            value={meetTime}
                            onChange={(e) => setMeetTime(e.target.value)}
                            placeholder="HH:MM"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none"
                        />
                         <Clock className="absolute left-2.5 top-2.5 text-slate-500" size={16} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Auto-set to 1h before KO if empty.</p>
                </div>
            </div>

            <div className="relative">
                <label className="block text-sm font-semibold text-slate-400 mb-1">Location</label>
                <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                        <input 
                            name="location" 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Match Location"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        />
                        {/* Suggestions Dropdown */}
                        {showSuggestions && locations.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                                {/* Suggestions for current opponent */}
                                {opponent && locations.filter(l => l.opponents && l.opponents.some(op => op.toLowerCase().includes(opponent.toLowerCase()))).length > 0 && (
                                    <div className="p-2 bg-slate-900/50 text-xs font-bold text-blue-400 uppercase tracking-wider sticky top-0">
                                        Suggested for {opponent}
                                    </div>
                                )}
                                {locations
                                    .sort((a, b) => {
                                        // Custom sort: matches for opponent come first
                                        const aMatch = opponent && a.opponents && a.opponents.some(op => op.toLowerCase().includes(opponent.toLowerCase()));
                                        const bMatch = opponent && b.opponents && b.opponents.some(op => op.toLowerCase().includes(opponent.toLowerCase()));
                                        if (aMatch && !bMatch) return -1;
                                        if (!aMatch && bMatch) return 1;
                                        return 0;
                                    })
                                    .filter(l => {
                                        if (location && !opponent) {
                                            return l.address.toLowerCase().includes(location.toLowerCase());
                                        }
                                        return true; 
                                    })
                                    .slice(0, 10) // Limit to 10 unique addresses
                                    .map((loc, idx) => {
                                        const isMatch = opponent && loc.opponents.some(op => op.toLowerCase().includes(opponent.toLowerCase()));
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onMouseDown={() => setLocation(loc.address)}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700/50 last:border-0"
                                            >
                                                <div className="font-medium text-white truncate">{loc.address}</div>
                                                {isMatch && <div className="text-xs text-blue-400">Used vs {opponent}</div>}
                                            </button>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={() => setLocation('')}
                        className="p-2 border border-slate-700 rounded hover:bg-slate-700 text-slate-400"
                        title="Clear"
                    >
                        <X size={18} />
                    </button>
                </div>
                
                <div className="flex gap-2 mt-2">
                    <button 
                        type="button" 
                        onClick={handleSetHome}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-green-400 text-xs font-medium rounded transition-colors"
                    >
                        <Home size={12} /> Set Home
                    </button>
                     <button 
                        type="button" 
                        onClick={handleSearchLocation}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-blue-400 text-xs font-medium rounded transition-colors"
                    >
                        <Search size={12} /> Search Address
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Featured Player</label>
                <select 
                    name="featured_player"
                    value={featuredPlayer}
                    onChange={(e) => setFeaturedPlayer(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none appearance-none"
                >
                    <option value="">No Featured Player</option>
                    {players.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">This player will be highlighted on the team sheet.</p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Team Sheet Notes / Kit</label>
                <textarea 
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Number 1s post-match, arrive in polos..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Appears at the bottom of the generated team sheet image.</p>
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-700 mt-6">
                <button 
                    type="submit" 
                    disabled={isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}
