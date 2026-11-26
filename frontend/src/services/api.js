import axios from 'axios';

// Auto-resolving API Base URL:
// - When running locally (localhost / 127.0.0.1), connect to local backend (port 5000)
//   which connects directly to the local Python ML service (port 8000).
// - When deployed in production (Vercel / Cloud), connect to the production Render backend.
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

let resolvedBaseUrl = isLocal
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL || 'https://smart-merchant-appplication.onrender.com/api');

if (
  !resolvedBaseUrl ||
  resolvedBaseUrl === '/api' ||
  resolvedBaseUrl.startsWith('/') ||
  resolvedBaseUrl.includes('smart-merchant-api.onrender.com')
) {
  resolvedBaseUrl = isLocal ? 'http://localhost:5000/api' : 'https://smart-merchant-appplication.onrender.com/api';
}

// Ensure trailing slash is stripped
if (resolvedBaseUrl.endsWith('/')) {
  resolvedBaseUrl = resolvedBaseUrl.slice(0, -1);
}

const api = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Optional auto redirect or token refresh
    }
    return Promise.reject(error);
  }
);

export default api;
