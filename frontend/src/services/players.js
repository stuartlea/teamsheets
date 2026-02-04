import api from './api';

export const playerService = {
  // Get all players for a specific team season context
  getByContext: (teamSeasonId) => api.get('/db/players', { params: { team_season_id: teamSeasonId } }),

  // Get specific team selection for a match
  getMatchSelection: (matchId) => api.get(`/db/match/${matchId}/team`),

  // Update match selection (save lineup)
  saveMatchSelection: (matchId, selectionData) => api.post(`/db/match/${matchId}/team`, selectionData),

  // Merge players
  merge: (sourceId, targetId) => api.post('/players/merge', { source_id: sourceId, target_id: targetId })
};
