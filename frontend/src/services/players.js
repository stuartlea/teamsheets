import api from './api';

export const playerService = {
  // Get all players for a specific team season context
  // NOTE: Django PlayerViewSet needs filtering by team_season_id?
  // Currently Player model doesn't explicitly link to TeamSeason, only via Matches/Availability/Selections
  // OR Player is Global?
  // Looking at models: Player is Global.
  // Flask usage: `playerService.getByContext` suggests filtering?
  // Let's point to /players first.
  getByContext: async (teamSeasonId) => {
      const response = await api.get('/players');
      return response.players || response; 
  }, 

  getById: (id) => api.get(`/players/${id}`),
 

  // Get specific team selection for a match
  getMatchSelection: (matchId) => api.get(`/matches/${matchId}/team`),

  // Update match selection (save lineup)
  saveMatchSelection: (matchId, selectionData) => api.post(`/matches/${matchId}/team`, selectionData),

  // Merge players - Need to implement logic in PlayerViewSet if not present
  merge: (sourceId, targetId) => api.post('/players/merge/', { source_id: sourceId, target_id: targetId }),

  // Delete player
  delete: (id) => api.delete(`/players/${id}`)
};
