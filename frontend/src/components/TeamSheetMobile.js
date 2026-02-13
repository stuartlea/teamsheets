
// --- MOBILE SVG COMPONENT ---
function TeamSheetMobileSVG({ data, featuredPlayer, featuredImage, metadata, featuredLabelType, featuredLabelCustom, nameFormat, kitText, kitTextCustom, playerImages }) {
    
    // Helper to format name
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
    const matchName = data.match_name || "Fixture";
    
    const featuredName = featuredPlayer || '';
    const finalLabel = featuredPlayer ? ((featuredLabelType === 'Custom' ? featuredLabelCustom : featuredLabelType) || 'FEATURED STAR') : '';
    const displayLocation = (metadata.location === 'Custom' ? (metadata.custom_location || 'TBC') : (metadata.location || 'TBC')).toUpperCase();
    const displayTitle = (metadata.custom_title || 'Match Day').toUpperCase();

    // Dimensions: 1080 x 1920
    // Pitch Strategy:
    // Standard pitch drawing is 750px wide x 1250px tall (roughly).
    // We want to fit it in the top part.
    // Let's scale the pitch group by ~0.8 to fit 600px width? Or keep it wide?
    // 1080 width allows for full 750px pitch centered.
    // But height might be issue. 1250 height is too tall for top half.
    // Scale 0.8 => 600w x 1000h. Leaves 900px for rest. Good.
    
    return (
        <svg id="team-sheet-svg" viewBox="0 0 1080 1920" style={{ width: 1080, height: 1920 }} fill="white">
            <defs>
                <linearGradient id="pitchGradMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#064e3b" />
                    <stop offset="100%" stopColor="#022c22" />
                </linearGradient>
                <pattern id="grassTextureMobile" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="40" height="40" fill="transparent" />
                    <line x1="0" y1="0" x2="40" y2="0" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                </pattern>
                <clipPath id="avatarCircleMobile">
                    <circle cx="0" cy="0" r="28" />
                </clipPath>
                <clipPath id="featuredAvatarClipMobile">
                     {/* Larger for mobile feature */}
                    <circle cx="100" cy="100" r="100" />
                </clipPath>
                 {/* Re-define gradient for bottom fade */}
                <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#022c22" stopOpacity="0" />
                    <stop offset="80%" stopColor="#022c22" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#022c22" stopOpacity="1" />
                </linearGradient>
            </defs>

            {/* Background */}
            <rect width="1080" height="1920" fill="#022c22" />
            
            {/* Header Section (0 - 200) */}
             <rect width="1080" height="200" fill="#022c22" /> 
             {/* Title Left */}
             <text x="50" y="80" fill="#FFD700" fontSize="24" fontWeight="800" letterSpacing="4">
                {displayTitle}
            </text>
            <text x="50" y="150" fontSize="72" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>
                <tspan fill="#EE0000">Vs </tspan>
                <tspan fill="white">{data.fixture_info?.opponent_name || parseOpponent(data.match_name || '') || 'OPPONENT'}</tspan> 
            </text>

            {/* Match Details Line */}
            <line x1="50" y1="180" x2="1030" y2="180" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <text x="50" y="210" fill="white" fontSize="20" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                 {metadata.match_date ? new Date(metadata.match_date).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'}).toUpperCase() : ''}
                 {'  |  '}
                 <tspan fill="#10b981">{displayLocation}</tspan>
            </text>
            <text x="1030" y="210" textAnchor="end" fill="white" fontSize="20" fillOpacity="0.8" style={{ fontFamily: 'sans-serif' }}>
                KO: {metadata.kickoff || 'TBC'}
            </text>

            {/* Logo - Top Right (Smaller) */}
            <image href="/static/pitch-assets/SRUFC Crest V2.svg" x="880" y="20" width="150" height="150" preserveAspectRatio="xMidYMid meet" />

            {/* PITCH SECTION - Centered and Scaled down slightly to fit */}
            {/* Standard pitch drawing starts at 0,0 and is ~750 wide x 1250 high (from previous code logic, we assumed 750 width for pitch rects? Wait, standard svg is 1000 width, pitch rect 750) */}
            {/* Let's transform scale 0.9 and center it */}
            <g transform="translate(165, 250) scale(0.9)">
                 {/* Pitch Backgrounds */}
                <rect width="750" height="1100" fill="url(#pitchGradMobile)" />
                <rect width="750" height="1100" fill="url(#grassTextureMobile)" />

                 {/* Markings */}
                 <g stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none">
                    <rect x="20" y="20" width="710" height="1060" strokeWidth="1" opacity="0.3" />
                    <line x1="20" y1="80" x2="730" y2="80" strokeWidth="1" />
                    {/* Simplified markings for mobile view or keep same? keeping same but adjusted for 1100 height if we cut off bottom? */}
                    {/* The standard view had 1210 height. I reduced to 1100. Let's just crop/mask. */}
                    {/* Actually, let's just draw the players. The markings are decorative. */}
                    {/* Simple box is enough. */}
                </g>

                {/* PLAYERS */}
                <g transform="translate(-25, 50)">
                    {POSITIONS.map((pos, idx) => {
                        const starter = starters[idx];
                        const playerName = starter ? starter.name : 'TBA';
                        const isFeatured = featuredPlayer && starter && starter.name === featuredPlayer;
                        const playerImage = playerName && playerImages ? playerImages[playerName] : null;
                        
                        // Scale positions slightly to compress vertical height?
                        // Standard cy goes from 18 to 92.
                        // Let's compress y a bit: cy * 9.5 instead of 10.5
                        const tx = pos.cx * 7.5; 
                        const ty = pos.cy * 9.5; 

                        return (
                            <g key={pos.id} transform={`translate(${tx}, ${ty})`}>
                                {isFeatured && <circle r="38" fill="rgba(16, 185, 129, 0.4)" />}
                                <circle r="32" fill={isFeatured ? '#10b981' : 'rgba(15, 23, 42, 0.9)'} stroke={isFeatured ? 'white' : 'rgba(255,255,255,0.3)'} strokeWidth="2" />
                                <g clipPath="url(#avatarCircleMobile)">
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
            </g>

            {/* FINISHERS - Blue Area - 2 Columns */}
            {/* Located below pitch. Pitch ends at 250 + 1100*0.9 = 250 + 990 = 1240 roughly. */}
            <g transform="translate(40, 1280)">
                <rect width="1000" height="260" rx="16" fill="rgba(255,255,255,0.05)" />
                <rect width="300" height="40" rx="8" x="20" y="-20" fill="#022c22" />
                <text x="170" y="5" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" letterSpacing="2" style={{ fontFamily: 'sans-serif' }}>FINISHERS</text>
                
                {/* 2 Column Layout */}
                {finishers.map((player, i) => player.name ? (
                    <g key={i} transform={`translate(${i % 2 === 0 ? 40 : 540}, ${50 + Math.floor(i/2) * 50})`}>
                         {/* Circle Number */}
                        <circle cx="20" cy="-6" r="18" fill="rgba(255,255,255,0.1)" />
                        <text x="20" y="0" textAnchor="middle" fill="#10b981" fontSize="16" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>{i + 16}</text>
                        {/* Name */}
                        <text x="60" y="0" fill="white" fontSize="18" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>{formatName(player.name)}</text>
                    </g>
                ) : null)}
            </g>

            {/* FEATURED PLAYER - Green Area - Bottom */}
            {/* Below Finishers (end at 1280 + 260 = 1540). */}
            <g transform="translate(0, 1560)">
                 {/* Gradient Fade BG for this section */}
                <rect width="1080" height="360" fill="url(#bottomFade)" />
                
                {featuredPlayer && (
                    <g transform="translate(540, 0)"> 
                        {/* Centered feature */}
                        <circle cx="0" cy="80" r="108" fill="#10b981" />
                        <g clipPath="url(#featuredAvatarClipMobile)" transform="translate(-100, -20)">
                            {featuredImage ? (
                                <image href={featuredImage} x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice" />
                            ) : (
                                <use href="#silhouette" x="0" y="0" width="200" height="200" />
                            )}
                        </g>

                        <text x="0" y="240" textAnchor="middle" fill="#FFD700" fontSize="24" fontWeight="900" letterSpacing="4" style={{ fontFamily: 'sans-serif' }}>
                            {finalLabel.toUpperCase()}
                        </text>

                         <text x="0" y="290" textAnchor="middle" fill="white" fontSize="48" fontWeight="900" style={{ fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
                            {featuredName}
                        </text>
                    </g>
                )}
            </g>
            
            {/* INSTRUCTIONS - Bottom Overlay */}
            <text x="540" y="1880" textAnchor="middle" fill="#FFD700" fontSize="16" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                 {(!kitText || kitText === 'None') ? '' : (kitText === 'Custom' ? kitTextCustom : (kitText === 'Number 1s' ? "Number 1's post match" : 'Polos and Chinos post match'))}
            </text>
        </svg>
    );
}

