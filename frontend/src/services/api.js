import axios from 'axios';

// Helper to read a cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: explicitly attach CSRF token to every mutating request
api.interceptors.request.use((config) => {
  const csrftoken = getCookie('csrftoken');
  if (csrftoken) {
    config.headers['X-CSRFToken'] = csrftoken;
  }
  return config;
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
