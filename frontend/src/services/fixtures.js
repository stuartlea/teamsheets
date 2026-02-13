import api from './api';

export const seasonService = {
  // Get all seasons
  getAll: () => api.get('/seasons'),

  // Get available contexts (Team + Season)
  getContexts: () => api.get('/team-seasons'),

  // Get specific stats for a Team Season
  getStats: (id) => api.get(`/team-seasons/${id}/stats/`),
};

export const fixtureService = {
  // Get fixtures, optionally filtered by team_season_id
  getFixtures: (teamSeasonId) => api.get('/matches', { params: { team_season_id: teamSeasonId } }),
  
  // Get DB Matches specific endpoint (Legacy alias -> same as getFixtures)
  getDbMatches: (teamSeasonId) => api.get('/matches', { params: { team_season_id: teamSeasonId } }),

  // Get single match by ID
  getById: (id) => api.get(`/matches/${id}`),

  create: (data) => api.post('/matches', data),
  
  update: async (id, data) => {
        const res = await api.patch(`/matches/${id}/`, data); // Ensure trailing slash
        return res;
    },
    // Availability is now part of match/availability endpoints?
    // We didn't explicitly implement /matches/{id}/availability in urls, maybe as extra action?
    // Checking serializers, Availability is separate.
    // Let's rely on MatchViewSet custom actions if relevant or generic queries.
    // For now, assume this might be broken or need /availabilities?match=ID
    getAvailability: async (id) => {
        // Return availabilities list for this match
        return api.get('/availabilities', { params: { match: id } });
    },
    getLocations: async () => {
        // We don't have a locations endpoint yet.
        return []; 
    },
  
  delete: (id) => api.delete(`/matches/${id}`),
};
