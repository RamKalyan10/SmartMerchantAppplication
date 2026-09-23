import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('sm_token');
    const saved = localStorage.getItem('sm_user');
    if (token && saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('sm_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('sm_user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          // Token invalid or expired, clean up
          localStorage.removeItem('sm_token');
          localStorage.removeItem('sm_user');
          setUser(null);
        });
    }
  }, []);

  const openAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthError(null);
    setAuthModalOpen(true);
  };

  const closeAuth = () => {
    setAuthModalOpen(false);
    setAuthError(null);
  };

  const login = async (email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.token) {
        localStorage.setItem('sm_token', res.data.token);
        setUser(res.data.user);
        localStorage.setItem('sm_user', JSON.stringify(res.data.user));
        setAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.post('/auth/register', userData);
      if (res.data?.token) {
        localStorage.setItem('sm_token', res.data.token);
        setUser(res.data.user);
        localStorage.setItem('sm_user', JSON.stringify(res.data.user));
        setAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await api.patch('/auth/profile', profileData);
      if (res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem('sm_user', JSON.stringify(res.data.user));
        return { success: true, message: res.data.message };
      }
      return { success: false, message: 'Update failed' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('sm_token');
    localStorage.removeItem('sm_user');
    setUser(null);
    setAuthModalOpen(false);
  };

  const hasPermission = (minRole) => {
    if (!user) return false;
    const weights = { Owner: 4, Admin: 3, Manager: 2, Staff: 1 };
    return (weights[user?.role] || 1) >= (weights[minRole] || 1);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      authError,
      authModalOpen,
      authModalMode,
      setAuthModalMode,
      setAuthModalOpen,
      openAuth,
      closeAuth,
      login,
      register,
      updateProfile,
      logout,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
