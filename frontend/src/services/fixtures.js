import api from './api';

export const seasonService = {
  // Get all seasons
  getAll: () => api.get('/seasons'),

  // Get available contexts (Team + Season)
  getContexts: () => api.get('/contexts'),
};

export const fixtureService = {
  // Get fixtures, optionally filtered by team_season_id
  getFixtures: (teamSeasonId) => api.get('/fixtures', { params: { team_season_id: teamSeasonId } }),
  
  // Get DB Matches specific endpoint
  getDbMatches: (teamSeasonId) => api.get('/db/matches', { params: { team_season_id: teamSeasonId } }),

  // Get single match by ID
  getById: (id) => api.get(`/db/match/${id}`),

  create: (data) => api.post('/fixtures', data),
  
  update: async (id, data) => {
        const res = await api.post(`/db/match/${id}`, data);
        return res;
    },
    getAvailability: async (id) => {
        const res = await api.get(`/db/match/${id}/availability`);
        return res;
    },
  
  delete: (id) => api.delete(`/fixtures/${id}`),
};
