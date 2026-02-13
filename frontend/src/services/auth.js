import api from './api';

export const authService = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  logout: async () => {
    try {
        await api.post('/auth/logout/');
    } catch (e) {
        console.error("Logout failed", e);
    }
  },
  status: () => api.get('/auth/status/')
};
