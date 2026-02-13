import api from './api';

export const spondService = {
  // Get all Spond groups
  getGroups: () => api.get('/spond/groups'),

  // Get events for a group
  getEvents: (groupId) => api.get('/spond/events', { params: { groupId } }),

  // Get members of a group
  getMembers: (groupId) => api.get('/spond/members', { params: { groupId } }),
  
  // Link Player to Spond Member
  linkPlayer: (playerId, spondId) => api.post(`/players/${playerId}/link-spond`, { spond_id: spondId }),

  // Link Match to Spond Event
  // Link Match to Spond Event/Availability
  // data: { spond_event_id?, spond_availability_id? }
  linkMatch: (matchId, data) => api.post(`/matches/${matchId}/link-spond/`, data),

  // Sync Match Availability
  syncMatch: (matchId) => api.post(`/matches/${matchId}/spond-sync/`)
};
