import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { getUserProfile, upsertUserProfile, DEFAULT_STORE_ID } from '../services/firestoreService';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sm_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register' | 'phone'
  const [authError, setAuthError] = useState(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // 1. Sync with backend API to obtain valid backend JWT token
          try {
            const syncRes = await api.post('/auth/firebase-sync', {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              phoneNumber: fbUser.phoneNumber
            });
            if (syncRes.data?.token) {
              localStorage.setItem('sm_token', syncRes.data.token);
              if (syncRes.data.user) {
                setUser(syncRes.data.user);
                localStorage.setItem('sm_user', JSON.stringify(syncRes.data.user));
              }
            }
          } catch (syncErr) {
            console.warn('Backend token sync note:', syncErr.message);
            const idToken = await fbUser.getIdToken();
            if (!localStorage.getItem('sm_token')) {
              localStorage.setItem('sm_token', idToken);
            }
          }

          const userStoreId = `store_${fbUser.uid}`;
          const storeName = fbUser.displayName ? `${fbUser.displayName}'s Store` : 'Smart Merchant Store';

          // 2. Retrieve or create profile document in Firestore
          let profile = await getUserProfile(fbUser.uid);
          if (!profile) {
            profile = await upsertUserProfile(fbUser.uid, {
              uid: fbUser.uid,
              email: fbUser.email || '',
              phone: fbUser.phoneNumber || '',
              name: fbUser.displayName || fbUser.email?.split('@')[0] || (fbUser.phoneNumber ? `User ${fbUser.phoneNumber.slice(-4)}` : 'Store Owner'),
              role: 'Owner',
              store_id: userStoreId,
              avatar: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
              business_name: storeName
            });
          }

          setUser(prev => {
            const updated = {
              id: fbUser.uid,
              uid: fbUser.uid,
              email: fbUser.email || profile?.email || prev?.email,
              phone: fbUser.phoneNumber || profile?.phone || prev?.phone,
              name: profile?.name || fbUser.displayName || prev?.name || 'Merchant Owner',
              role: prev?.role || profile?.role || 'Owner',
              store_id: prev?.store_id || profile?.store_id || userStoreId,
              avatar: profile?.avatar || fbUser.photoURL || prev?.avatar,
              business_name: profile?.business_name || prev?.business_name || storeName
            };
            localStorage.setItem('sm_user', JSON.stringify(updated));
            return updated;
          });
        } catch (err) {
          console.warn('Profile sync notice:', err.message);
        }
      } else {
        // If not logged in via backend either, clear session
        const existingToken = localStorage.getItem('sm_token');
        const existingUser = localStorage.getItem('sm_user');
        if (!existingToken && !existingUser) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthError(null);
    setAuthModalOpen(true);
  };

  const closeAuth = () => {
    setAuthModalOpen(false);
    setAuthError(null);
    setPhoneConfirmation(null);
  };

  // 1. Google Sign-In
  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      closeAuth();
      return { success: true, user: result.user };
    } catch (err) {
      const msg = err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled'
        : (err.message || 'Google sign-in failed');
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // 2. Email & Password Login
  const login = async (email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      // 1. Try backend API first (Supabase PostgreSQL database user e.g. onr1@gmail.com)
      try {
        const res = await api.post('/auth/login', { email, password });
        if (res.data?.token) {
          localStorage.setItem('sm_token', res.data.token);
          localStorage.setItem('sm_user', JSON.stringify(res.data.user));
          setUser(res.data.user);
          closeAuth();
          return { success: true, user: res.data.user };
        }
      } catch (backendErr) {
        // Backend didn't recognize or error - proceed to check Firebase
      }

      // 2. Try Firebase Auth
      const res = await signInWithEmailAndPassword(auth, email, password);
      closeAuth();
      return { success: true, user: res.user };
    } catch (err) {
      let msg = 'Login failed. Please check credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again later.';
      }
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // 3. Email & Password Register
  const register = async (userData) => {
    setLoading(true);
    setAuthError(null);
    try {
      // 1. Register with backend DB
      try {
        const backendRes = await api.post('/auth/register', userData);
        if (backendRes.data?.token) {
          localStorage.setItem('sm_token', backendRes.data.token);
          localStorage.setItem('sm_user', JSON.stringify(backendRes.data.user));
          setUser(backendRes.data.user);
        }
      } catch (beErr) {
        console.warn('Backend register notice:', beErr.response?.data?.message || beErr.message);
      }

      // 2. Register with Firebase
      const res = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      
      // Update display name
      if (userData.name) {
        await updateFirebaseProfile(res.user, {
          displayName: userData.name,
          photoURL: userData.avatar || undefined
        });
      }

      // Persist user profile document in Firestore
      await upsertUserProfile(res.user.uid, {
        uid: res.user.uid,
        email: userData.email,
        name: userData.name,
        role: userData.role || 'Owner',
        phone: userData.phone || '',
        business_name: userData.business_name || 'Smart Merchant Store',
        avatar: userData.avatar || '',
        store_id: `store_${res.user.uid}`
      });

      closeAuth();
      return { success: true, user: res.user };
    } catch (err) {
      let msg = 'Registration failed.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // 4. Mobile Number (SMS OTP)
  const setupRecaptcha = (containerId = 'recaptcha-container') => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {}
      });
    }
    return window.recaptchaVerifier;
  };

  const sendPhoneOtp = async (phoneNumber, containerId = 'recaptcha-container') => {
    setLoading(true);
    setAuthError(null);
    try {
      const verifier = setupRecaptcha(containerId);
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setPhoneConfirmation(confirmation);
      return { success: true };
    } catch (err) {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
      }
      const msg = err.code === 'auth/invalid-phone-number'
        ? 'Invalid phone number format. Use international format (e.g. +91 99999 12345)'
        : (err.message || 'Failed to send OTP SMS');
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (otpCode) => {
    if (!phoneConfirmation) {
      return { success: false, message: 'No OTP session found. Please request OTP again.' };
    }
    setLoading(true);
    setAuthError(null);
    try {
      const result = await phoneConfirmation.confirm(otpCode);
      closeAuth();
      return { success: true, user: result.user };
    } catch (err) {
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Invalid OTP verification code. Please check and try again.'
        : (err.message || 'OTP verification failed');
      setAuthError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    if (!user) return { success: false, message: 'Not authenticated' };
    try {
      await upsertUserProfile(user.uid || user.id, profileData);
      const updated = { ...user, ...profileData };
      setUser(updated);
      localStorage.setItem('sm_user', JSON.stringify(updated));
      return { success: true, message: 'Profile updated' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {}
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
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      phoneConfirmation,
      updateProfile,
      logout,
      hasPermission
    }}>
      {children}
      <div id="recaptcha-container"></div>
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
