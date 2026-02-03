import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
    return Promise.reject({ message, status: error.response?.status });
  }
);

export default api;
