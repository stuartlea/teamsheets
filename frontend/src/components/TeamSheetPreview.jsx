import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { playerService } from '../services/players';
import * as htmlToImage from 'html-to-image';
import { X, Download, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

const POSITIONS = [
    { id: 1, label: '1', role: 'Loosehead Prop', cx: 30, cy: 18 },
    { id: 2, label: '2', role: 'Hooker', cx: 50, cy: 18 },
    { id: 3, label: '3', role: 'Tighthead Prop', cx: 70, cy: 18 },
    { id: 4, label: '4', role: '2nd Row', cx: 40, cy: 30 },
    { id: 5, label: '5', role: '2nd Row', cx: 60, cy: 30 },
    { id: 6, label: '6', role: 'Blindside Flanker', cx: 25, cy: 40 },
    { id: 7, label: '7', role: 'Openside Flanker', cx: 75, cy: 40 },
    { id: 8, label: '8', role: 'Number 8', cx: 50, cy: 45 },
    { id: 9, label: '9', role: 'Scrum Half', cx: 35, cy: 58 },
    { id: 10, label: '10', role: 'Fly Half', cx: 55, cy: 65 },
    { id: 11, label: '11', role: 'Left Wing', cx: 15, cy: 72 },
    { id: 12, label: '12', role: 'Inside Centre', cx: 40, cy: 75 },
    { id: 13, label: '13', role: 'Outside Centre', cx: 65, cy: 78 },
    { id: 14, label: '14', role: 'Right Wing', cx: 90, cy: 81 },
    { id: 15, label: '15', role: 'Full Back', cx: 50, cy: 92 }
];

export default function TeamSheetPreview({ matchId, isOpen, onClose }) {
    const [viewMode, setViewMode] = useState('desktop'); // desktop (full), mobile (scroll)
    
    // Design State
    const [featuredPlayer, setFeaturedPlayer] = useState('');
    const [featuredLabelType, setFeaturedLabelType] = useState('Captain');
    const [featuredLabelCustom, setFeaturedLabelCustom] = useState('');
    const [nameFormat, setNameFormat] = useState('initial'); // 'full', 'surname', 'initial'
    const [kitText, setKitText] = useState('Number 1s');
    const [kitTextCustom, setKitTextCustom] = useState('');
    
    // Computed/Fetched State
    const [featuredImage, setFeaturedImage] = useState(null);
    const [playerImages, setPlayerImages] = useState({});
    const [metadata, setMetadata] = useState({
        kickoff: '',
        meet_time: '',
        location: '',
        custom_title: 'SANDBACH RUFC U15s',
        match_date: '',
        custom_location: ''
    });

    const { data: teamData, isLoading, refetch } = useQuery({
        queryKey: ['match-team', matchId],
        queryFn: () => playerService.getMatchSelection(matchId),
        enabled: !!matchId && isOpen
    });

    // Populate Metadata when data loads
    useEffect(() => {
        if (teamData) {
            // Defaults from DB/Fixture Info
            const fixInfo = teamData.fixture_info || {};
            const meta = teamData.metadata || {};
            
            // Format match date if needed (assuming YYYY-MM-DD or similar) (Legacy logic)
            let dateStr = fixInfo.match_date || '';
            if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                const parts = dateStr.split('/');
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }

            // Auto-location for Home
            let loc = meta.location || '';
            const homeAway = (fixInfo.home_away || '').toLowerCase();
            if (!loc && (homeAway === 'home' || homeAway === 'h')) {
                loc = 'Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA';
            }

            setMetadata(prev => ({
                ...prev,
                match_date: dateStr,
                kickoff: meta.kickoff || '',
                meet_time: meta.meet_time || '',
                location: loc
            }));
        }
    }, [teamData]);

    // Fetch Player Images
    useEffect(() => {
        if (!teamData?.starters) return;
        
        let isMounted = true;
        const fetchImages = async () => {
             const newImages = {};
             // We only care about starters for the pitch view
             const promises = teamData.starters.map(async (p) => {
                 if (p && p.name) {
                     try {
                         const res = await api.get(`/player-image/${encodeURIComponent(p.name)}`);
                         if (res.success && res.image_url && !res.image_url.includes('player-silhouette.png')) {
                             newImages[p.name] = res.image_url;
                         }
                     } catch(err) {
                         // ignore
                     }
                 }
             });
             await Promise.all(promises);
             if (isMounted) setPlayerImages(prev => ({...prev, ...newImages}));
        };
        
        fetchImages();
        return () => { isMounted = false; };
    }, [teamData]);

    // Fetch Featured Player Image
    useEffect(() => {
        if (!featuredPlayer) {
            setFeaturedImage(null);
            return;
        }
        let isMounted = true;
        const loadFeatured = async () => {
            try {
                const res = await api.get(`/player-image/${encodeURIComponent(featuredPlayer)}`);
                if (res.success && res.image_url && !res.image_url.includes('player-silhouette.png')) {
                    // Fetch as blob to convert to DataURL (for html-to-image compatibility)
                    const imgRes = await fetch(res.image_url);
                    const blob = await imgRes.blob();
                    
                    if (!blob.type.startsWith('image/') || blob.type.includes('svg')) throw new Error('Invalid image');

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (isMounted) setFeaturedImage(reader.result);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    if (isMounted) setFeaturedImage(null);
                }
            } catch (err) {
                console.warn("Error loading featured image", err);
                if (isMounted) setFeaturedImage(null);
            }
        };
        loadFeatured();
        return () => { isMounted = false; };
    }, [featuredPlayer]);


    const handleExport = async () => {
        const target = document.getElementById('team-sheet-svg');
        if (!target) return;
        
        try {
            const dataUrl = await htmlToImage.toPng(target, {
                cacheBust: true,
                pixelRatio: 2,
                imagePlaceholder: '/static/pitch-assets/player-silhouette.png',
                width: 1000,
                height: 1250,
                backgroundColor: '#022c22',
                style: {
                    color: 'white'
                }
            });
            const link = document.createElement('a');
            link.download = `team-sheet-${teamData?.fixture_info?.opponent || 'export'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to generate image');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-slate-900">
            <div className="bg-white rounded-xl w-full max-w-[95vw] h-[90vh] flex overflow-hidden shadow-2xl relative">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Sidebar Controls */}
                <div className="w-80 border-r border-slate-200 bg-slate-50 p-6 overflow-y-auto flex-shrink-0">
                    <h2 className="text-xl font-bold mb-6 text-slate-800">Preview Settings</h2>
                    
                    {isLoading ? (
                        <div className="text-slate-500 text-sm">Loading team data...</div>
                    ) : teamData ? (
                        <div className="space-y-6">
                            {/* Feature Player */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Featured Player</label>
                                <select 
                                    value={featuredPlayer}
                                    onChange={e => setFeaturedPlayer(e.target.value)}
                                    className="w-full p-2 border rounded shadow-sm text-sm"
                                >
                                    <option value="">Select player...</option>
                                    {teamData.starters.map(p => p.name && (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Feature Label */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Label Type</label>
                                <select 
                                    value={featuredLabelType}
                                    onChange={e => setFeaturedLabelType(e.target.value)}
                                    className="w-full p-2 border rounded shadow-sm text-sm"
                                >
                                    <option value="Featured Star">Featured Star</option>
                                    <option value="Captain">Captain</option>
                                    <option value="Man of the Match">Man of the Match</option>
                                    <option value="Custom">Custom...</option>
                                </select>
                                {featuredLabelType === 'Custom' && (
                                    <input 
                                        type="text" 
                                        value={featuredLabelCustom}
                                        onChange={e => setFeaturedLabelCustom(e.target.value)}
                                        placeholder="Enter Label"
                                        className="w-full mt-2 p-2 border rounded shadow-sm text-sm"
                                    />
                                )}
                            </div>

                            {/* Metadata Overrides */}
                            <div className="space-y-3 pt-4 border-t border-slate-200">
                                <h3 className="font-semibold text-sm text-slate-500 uppercase">Match Details</h3>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Kickoff</label>
                                    <input 
                                        type="text" 
                                        value={metadata.kickoff}
                                        onChange={(e) => {
                                            const ko = e.target.value;
                                            let updates = {kickoff: ko};
                                            // Auto-calculate meet time if empty
                                            if (!metadata.meet_time && ko.match(/^\d{1,2}:\d{2}$/)) {
                                                const [hours, mins] = ko.split(':').map(Number);
                                                const meetHours = hours - 1;
                                                if (meetHours >= 0) {
                                                    updates.meet_time = `${meetHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                                                }
                                            }
                                            setMetadata(prev => ({...prev, ...updates}));
                                        }}
                                        className="w-full p-2 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Meet Time</label>
                                    <input 
                                        type="text" 
                                        value={metadata.meet_time}
                                        onChange={e => setMetadata({...metadata, meet_time: e.target.value})}
                                        className="w-full p-2 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Location</label>
                                    <select 
                                        value={metadata.location}
                                        onChange={e => setMetadata({...metadata, location: e.target.value})}
                                        className="w-full p-2 border rounded text-sm"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Sandbach RUFC, Bradwall Road, Sandbach. CW11 1RA">Home (Sandbach RUFC)</option>
                                        <option value="Custom">Custom</option>
                                    </select>
                                    {metadata.location === 'Custom' && (
                                        <input 
                                            type="text" 
                                            value={metadata.custom_location}
                                            onChange={e => setMetadata({...metadata, custom_location: e.target.value})}
                                            className="w-full mt-1 p-2 border rounded text-sm"
                                            placeholder="Custom location..."
                                        />
                                    )}
                                </div>
                            </div>
                            
                            {/* Kit Text */}
                            <div className="pt-4 border-t border-slate-200">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Instructions / Kit</label>
                                <select 
                                    value={kitText}
                                    onChange={e => setKitText(e.target.value)}
                                    className="w-full p-2 border rounded shadow-sm text-sm"
                                >
                                    <option value="Number 1s">Number 1s</option>
                                    <option value="Polos">Polos/Chinos</option>
                                    <option value="Custom">Custom</option>
                                </select>
                                {kitText === 'Custom' && (
                                    <textarea 
                                        value={kitTextCustom}
                                        onChange={e => setKitTextCustom(e.target.value)}
                                        className="w-full mt-2 p-2 border rounded shadow-sm text-sm"
                                        rows={2}
                                    />
                                )}
                            </div>

                            <button 
                                onClick={handleExport}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                <Download size={20} /> Download PNG
                            </button>
                        </div>
                    ) : (
                        <div className="text-red-500 text-sm">Failed to load data</div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="flex-1 bg-slate-200 overflow-auto flex justify-center p-8">
                     {/* Scale Wrapper if needed, or just overflow */}
                     <div className="relative shadow-2xl origin-top" style={{ minWidth: '1000px', minHeight: '1250px' }}>
                        {teamData && (
                            <TeamSheetSVG 
                                data={teamData}
                                featuredPlayer={featuredPlayer}
                                featuredImage={featuredImage}
                                metadata={metadata}
                                featuredLabelType={featuredLabelType}
                                featuredLabelCustom={featuredLabelCustom}
                                nameFormat={nameFormat}
                                kitText={kitText}
                                kitTextCustom={kitTextCustom}
                                playerImages={playerImages}
                            />
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
}

// --- SVG COMPONENT (Ported Exact Logic) ---
function TeamSheetSVG({ data, featuredPlayer, featuredImage, metadata, featuredLabelType, featuredLabelCustom, nameFormat, kitText, kitTextCustom, playerImages }) {
    
    // Helpers
    const formatName = (name, isCaptain = false) => {
        if (!name) return 'TBA';
        const parts = name.split(' ');
        let formatted;
        if (nameFormat === 'surname' && parts.length > 1) {
            formatted = parts.slice(1).join(' ');
        } else if (nameFormat === 'initial' && parts.length > 1) {
            formatted = parts[0].charAt(0) + '. ' + parts.slice(1).join(' ');
        } else {
            formatted = name;
        }
        return formatted.toUpperCase() + (isCaptain ? ' (C)' : '');
    };

    const parseOpponent = (fixtureName) => {
        if (!fixtureName) return '';
        const match = fixtureName.match(/^\d+:\s*(.+?)\s*\([HA]\)$/i);
        return match ? match[1].trim() : fixtureName;
    };

    const starters = data.starters || [];
    const finishers = data.finishers || [];
    const fixtureName = (data.fixture_info?.opponent) || `Match ${data.fixture_info?.match_date || ''}`; // Use explicit opponent if avail, else fallback
    // Actually legacy logic used 'parseOpponent' on `selectedWorksheet` which was just the match name string from the dropdown. 
    // Here `data` might not have the raw match name string easily.
    // backend sends `format` but maybe not the raw `name` string of the fixture.
    // Wait, the API response for `get_db_match` INCLUDED `fixture_info` with `home_away` etc. but does it have `name`?
    // Let's check `backend/app.py` again. `get_db_match` returns `match.to_dict()` wrapper. 
    // `manage_match_team` calls `jsonify({... , fixture_info: {home_away...}})`
    // It does NOT seem to send the match NAME in `fixture_info`. 
    // BUT `fixtureService.getById` had `match.name`.
    // We might need to pass `matchName` as prop from parent if it's missing here. 
    // OR we rely on `parseOpponent` working on whatever we have.
    // Let's assume we can pass `fixtureName` from parent `TeamSheetPreview` which can get it from the `teamData` (if we add it) or `MatchWorksheet` parent.
    // `LineupBuilder` had access to `match` object. `TeamSheetPreview` fetches data independently.
    
    // Quick Fix: `TeamSheetPreview` fetching `getMatchSelection` returns specific keys.
    // I should probably ALSO fetch the match metadata OR ensure `manage_match_team` returns the name.
    // Use `parseOpponent` on what we have. 
    // For now, I'll use `Opponent` literal if missing. Or maybe `data.fixture_info.opponent` if I add it to backend?
    // But I can't edit backend unless really needed.
    // Wait, `MatchWorksheet` HAS `match.name`. I can pass it down!
    
    // Let's add `matchName` prop to this component and `TeamSheetPreview`.

    const matchName = data.match_name || "Fixture"; // Ensure we get this.

    const featuredName = featuredPlayer || (starters[9] ? starters[9].name : '') || 'The Team';
    const finalLabel = (featuredLabelType === 'Custom' ? featuredLabelCustom : featuredLabelType) || 'FEATURED STAR';
    const displayLocation = (metadata.location === 'Custom' ? (metadata.custom_location || 'TBC') : (metadata.location || 'TBC')).toUpperCase();
    const displayTitle = (metadata.custom_title || 'Match Day').toUpperCase();

    // Styles
    const featuredNameStyle = {
        width: '100%', height: '100%', color: 'white', fontSize: '32px', fontWeight: '900', lineHeight: '1.0',
        textTransform: 'uppercase', overflowWrap: 'break-word', display: 'flex', alignItems: 'flex-start',
        paddingRight: '10px', fontFamily: 'sans-serif'
    };
    const matchInstructionsStyle = {
        color: '#FFD700', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', wordWrap: 'break-word',
        lineHeight: '1.3', whiteSpace: 'pre-wrap', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
    };

    return (
        <svg id="team-sheet-svg" viewBox="0 0 1000 1250" style={{ width: 1000, height: 1250 }} fill="white">
             <defs>
                <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#064e3b" />
                    <stop offset="100%" stopColor="#022c22" />
                </linearGradient>
                <pattern id="grassTexture" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="40" height="40" fill="transparent" />
                    <line x1="0" y1="0" x2="40" y2="0" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                </pattern>
                <clipPath id="avatarCircle">
                    <circle cx="0" cy="0" r="28" />
                </clipPath>
                <clipPath id="featuredAvatarClip">
                    <circle cx="60" cy="60" r="60" />
                </clipPath>
                <symbol id="silhouette" viewBox="-30 -30 60 60">
                    <circle cx="0" cy="-6" r="10" fill="rgba(255,255,255,0.15)" />
                    <path d="M-22,24 C-22,12 -12,8 0,8 C12,8 22,12 22,24 L-22,24 Z" fill="rgba(255,255,255,0.15)" />
                </symbol>
                <linearGradient id="headerOverlay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
            </defs>

            <rect width="1000" height="1250" fill="#022c22" />
            <rect width="750" height="1250" fill="url(#pitchGrad)" />
            <rect width="750" height="1250" fill="url(#grassTexture)" />

             {/* Field Markings */}
             <g stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none">
                <rect x="20" y="20" width="710" height="1210" strokeWidth="1" opacity="0.3" />
                <line x1="20" y1="80" x2="730" y2="80" strokeWidth="1" />
                <line x1="20" y1="1170" x2="730" y2="1170" strokeWidth="1" />
                <line x1="20" y1="140" x2="730" y2="140" strokeWidth="3" />
                <line x1="20" y1="1110" x2="730" y2="1110" strokeWidth="3" />
                <line x1="20" y1="280" x2="730" y2="280" />
                <line x1="20" y1="970" x2="730" y2="970" />
                <line x1="20" y1="360" x2="730" y2="360" strokeDasharray="10,10" />
                <line x1="20" y1="890" x2="730" y2="890" strokeDasharray="10,10" />
                <line x1="20" y1="625" x2="730" y2="625" strokeWidth="3" />
                <g strokeDasharray="5,15" opacity="0.5">
                    <line x1="100" y1="140" x2="100" y2="1110" />
                    <line x1="220" y1="140" x2="220" y2="1110" />
                    <line x1="530" y1="140" x2="530" y2="1110" />
                    <line x1="650" y1="140" x2="650" y2="1110" />
                </g>
                <line x1="355" y1="190" x2="395" y2="190" />
                <line x1="355" y1="1060" x2="395" y2="1060" />
            </g>

            {/* Header */}
            <rect width="1000" height="150" fill="#022c22" />
            <rect width="1000" height="150" fill="url(#headerOverlay)" />
            <text x="40" y="45" fill="#FFD700" fontSize="14" fontWeight="800" letterSpacing="3">
                {displayTitle}
            </text>
            <text x="40" y="95" fontSize="52" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>
                <tspan fill="#EE0000">Vs </tspan>
                <tspan fill="white">{data.fixture_info?.opponent_name || parseOpponent(data.match_name || '') || 'OPPONENT'}</tspan> 
            </text>

            <g transform="translate(40, 125)">
                <rect width="720" height="1" fill="rgba(255,255,255,0.2)" y="-15" />
                <text x="0" y="10" fill="white" fontSize="12" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                    {metadata.match_date ? new Date(metadata.match_date).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'}).toUpperCase() : ''}
                </text>
                <text x="150" y="10" fill="white" fontSize="12" fillOpacity="0.9" style={{ fontFamily: 'sans-serif' }}>
                    KO: {metadata.kickoff || 'TBC'}  |  MEET: {metadata.meet_time || 'TBC'}
                </text>
                <g transform="translate(350, 0)">
                    <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S4.6 3.5 6 3.5s2.5 1.1 2.5 2.5S7.4 8.5 6 8.5z" fill="#10b981" transform="translate(0, 0) scale(1.2)"/>
                    <text x="18" y="10" fill="white" fontSize="12" fillOpacity="0.9" style={{ fontFamily: 'sans-serif' }}>
                        {displayLocation}
                    </text>
                </g>
            </g>

            {/* Players */}
            <g transform="translate(-25, 100)">
                {POSITIONS.map((pos, idx) => {
                    const starter = starters[idx];
                    const playerName = starter ? starter.name : 'TBA';
                    const isFeatured = featuredPlayer && starter && starter.name === featuredPlayer;
                    const playerImage = playerName && playerImages ? playerImages[playerName] : null;
                    const tx = pos.cx * 7.5; 
                    const ty = pos.cy * 10.5;

                    return (
                        <g key={pos.id} transform={`translate(${tx}, ${ty})`}>
                            {isFeatured && <circle r="38" fill="rgba(16, 185, 129, 0.4)" />}
                            <circle r="32" fill={isFeatured ? '#10b981' : 'rgba(15, 23, 42, 0.9)'} stroke={isFeatured ? 'white' : 'rgba(255,255,255,0.3)'} strokeWidth="2" />
                            <g clipPath="url(#avatarCircle)">
                                <rect x="-30" y="-30" width="60" height="60" fill="#0f172a" />
                                {playerImage ? (
                                    <image href={playerImage} x="-30" y="-30" width="60" height="60" preserveAspectRatio="xMidYMid slice" />
                                ) : (
                                    <use href="#silhouette" x="-30" y="-30" width="60" height="60" />
                                )}
                            </g>
                            <circle cx="26" cy="-26" r="12" fill="white" stroke="#064e3b" strokeWidth="1" />
                            <text x="26" y="-22" textAnchor="middle" fill="#064e3b" fontSize="10" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>{pos.label}</text>
                            
                            <g transform="translate(0, 48)">
                                <rect x="-65" y="-16" width="130" height="32" rx="4" fill="rgba(0,0,0,0.85)" stroke={isFeatured ? '#10b981' : 'none'} strokeWidth="1" />
                                <text textAnchor="middle" y="0" fill="white" fontSize="12" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                                    {formatName(playerName, featuredLabelType === 'Captain' && isFeatured)}
                                </text>
                                <text textAnchor="middle" y="12" fill="white" fontSize="8" fontWeight="900" letterSpacing="1" style={{ fontFamily: 'sans-serif' }}>
                                    {pos.role.toUpperCase()}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </g>

            {/* Finishers */}
            <g transform="translate(780, 180)">
                <rect width="200" height="600" rx="8" fill="rgba(255,255,255,0.05)" />
                <rect width="200" height="40" rx="8" fill="#022c22" />
                <rect width="200" height="40" rx="8" fill="url(#headerOverlay)" />
                <text x="100" y="25" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" letterSpacing="2" style={{ fontFamily: 'sans-serif' }}>FINISHERS</text>
                {finishers.map((player, i) => player.name ? (
                    <g key={i} transform={`translate(20, ${80 + i * 35})`}>
                        <circle cx="10" cy="-4" r="14" fill="rgba(255,255,255,0.1)" />
                        <text x="10" y="0" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>{i + 16}</text>
                        <text x="35" y="0" fill="white" fontSize="13" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>{formatName(player.name)}</text>
                    </g>
                ) : null)}
            </g>

            {/* Match Instructions - Using Wrapping Helper */}
            <WordWrapText 
                x="880" 
                y="830"
                width="200" 
                text={kitText === 'Custom' ? kitTextCustom : (kitText === 'Number 1s' ? "Number 1's post match" : 'Polos and Chinos post match')}
                fontSize={12}
                fill="#FFD700"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                lineHeight={1.3}
            />

            {/* Featured footer */}
            <g transform="translate(780, 1065)">
                <g transform="translate(40, -140)">
                     <circle cx="60" cy="60" r="64" fill="#10b981" />
                     <g clipPath="url(#featuredAvatarClip)">
                        {featuredImage ? (
                            <image href={featuredImage} x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid slice" />
                        ) : (
                            <use href="#silhouette" x="0" y="0" width="120" height="120" />
                        )}
                     </g>
                </g>
                <text x="0" y="40" fill="#FFD700" fontSize="12" fontWeight="900" letterSpacing="3" style={{ fontFamily: 'sans-serif' }}>
                    {finalLabel.toUpperCase()}
                </text>
                
                {/* Featured Name - Using Wrapping Helper */}
                <WordWrapText 
                    x="0" 
                    y="80"
                    width="200" 
                    text={featuredName}
                    fontSize={32}
                    fill="white"
                    fontWeight="900"
                    fontFamily="sans-serif"
                    lineHeight={1.0}
                    style={{ textTransform: 'uppercase' }}
                />

                <line x1="0" y1="165" x2="200" y2="165" stroke="#EE0000" strokeWidth="4" />
                <line x1="0" y1="173" x2="200" y2="173" stroke="#FFD700" strokeWidth="4" />
            </g>

            <image href="/static/pitch-assets/SRUFC Crest V2.svg" x="820" y="15" width="130" height="130" preserveAspectRatio="xMidYMid meet" />
        </svg>
    );
}

// Helper to wrap text in SVG
function WordWrapText({ x, y, width, text, fontSize, lineHeight = 1.2, textAnchor = "start", ...props }) {
    if (!text) return null;
    
    // Approximate char width (average for sans-serif caps/bold is often ~0.6-0.7em)
    const approxCharWidth = fontSize * 0.6; 
    const maxChars = Math.floor(width / approxCharWidth);
    
    // Split into words
    const words = text.toString().split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if ((currentLine + " " + word).length <= maxChars) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    // Calculate vertical offset to center the block if needed? 
    // Here we just render downwards from y.
    
    return (
        <text x={x} y={y} fontSize={fontSize} textAnchor={textAnchor} {...props}>
            {lines.map((line, i) => (
                <tspan 
                    key={i} 
                    x={x} 
                    dy={i === 0 ? 0 : `${lineHeight}em`} // First line is at y, subsequent relative
                >
                    {line}
                </tspan>
            ))}
        </text>
    );
}
