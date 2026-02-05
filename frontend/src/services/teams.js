import api from './api';

export const teamService = {
  // Get all teams (future: filtered by permission)
  getAll: () => api.get('/teams'),

  // Get single team by ID
  getById: (id) => api.get(`/teams/${id}`),

  // Create a new team
  create: (data) => api.post('/teams', data),

  // Update a team
  update: (id, data) => api.put(`/teams/${id}`, data),

  // Delete a team
  delete: (id) => api.delete(`/teams/${id}`),

  // Link to Spond Group
  linkSpond: (teamId, spondGroupId) => api.post(`/teams/${teamId}/link-spond`, { spond_group_id: spondGroupId })
};
