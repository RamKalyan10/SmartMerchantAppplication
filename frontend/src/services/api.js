import axios from 'axios';

// Auto-resolving API Base URL:
// 1. In local development (localhost), use VITE_API_URL or default to '/api' (proxied by Vite).
// 2. In deployed environments (Vercel, custom domain), always connect to the production Render backend
//    (https://smart-merchant-appplication.onrender.com/api) unless a custom absolute URL is provided.
let resolvedBaseUrl = import.meta.env.VITE_API_URL || '/api';

if (typeof window !== 'undefined') {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) {
    // If running in production on Vercel and URL is relative ('/api') or points to the placeholder domain
    if (
      !resolvedBaseUrl ||
      resolvedBaseUrl === '/api' ||
      resolvedBaseUrl.startsWith('/') ||
      resolvedBaseUrl.includes('smart-merchant-api.onrender.com')
    ) {
      resolvedBaseUrl = 'https://smart-merchant-appplication.onrender.com/api';
    }
  }
}

// Ensure trailing slash is not duplicated
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
