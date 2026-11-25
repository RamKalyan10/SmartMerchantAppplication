import axios from 'axios';

// Auto-resolving API Base URL:
// Always connect to the production Render backend unless an explicit custom URL is configured.
// This ensures authentication and data load correctly both locally (npm run dev) and in production (Vercel).
let resolvedBaseUrl = import.meta.env.VITE_API_URL || 'https://smart-merchant-appplication.onrender.com/api';

if (
  !resolvedBaseUrl ||
  resolvedBaseUrl === '/api' ||
  resolvedBaseUrl.startsWith('/') ||
  resolvedBaseUrl.includes('smart-merchant-api.onrender.com')
) {
  resolvedBaseUrl = 'https://smart-merchant-appplication.onrender.com/api';
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
