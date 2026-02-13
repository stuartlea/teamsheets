import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Return a standardized error object
    const message = error.response?.data?.error || error.response?.data?.message || error.message;
    
    // Auto-redirect to login on 401
    if (error.response?.status === 401) {
        window.location.href = '/login';
    }
    
    return Promise.reject({ message, status: error.response?.status });
  }
);

export default api;
