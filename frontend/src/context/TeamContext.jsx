import React, { createContext, useContext, useState, useEffect } from 'react';
import { teamService } from '../services/teams';
import { useAuth } from './AuthContext';

const TeamContext = createContext(null);

export const TeamProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [currentTeam, setCurrentTeam] = useState(null);
    const [activeSeason, setActiveSeason] = useState(null);
    const [availableSeasons, setAvailableSeasons] = useState([]);
    
    // New: List of all teams the user has access to
    const [myTeams, setMyTeams] = useState([]);

    useEffect(() => {
        if (isAuthenticated) {
            teamService.getAll().then(data => {
                setMyTeams(Array.isArray(data) ? data : []);
            }).catch(e => console.error("Failed to fetch teams", e));
        } else {
            setMyTeams([]);
        }
    }, [isAuthenticated]);
    
    // Helper to update all context at once (e.g. when loading TeamDashboard)
    const setContext = (team, seasons, season) => {
        setCurrentTeam(team);
        setAvailableSeasons(seasons || []);
        setActiveSeason(season);
    };

    // Helper to just switch season
    const switchSeason = (seasonId) => {
        const season = availableSeasons.find(s => s.id === parseInt(seasonId));
        if (season) {
            setActiveSeason(season);
        }
    };

    const clearTeamContext = () => {
        setCurrentTeam(null);
        setActiveSeason(null);
        setAvailableSeasons([]);
    };

    return (
        <TeamContext.Provider value={{ 
            currentTeam, 
            activeSeason, 
            availableSeasons, 
            myTeams, // Expose this
            setContext, 
            switchSeason,
            clearTeamContext 
        }}>
            {children}
        </TeamContext.Provider>
    );
};

export const useTeam = () => useContext(TeamContext);
