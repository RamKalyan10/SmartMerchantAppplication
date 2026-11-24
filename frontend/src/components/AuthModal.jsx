import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Shield, 
  Lock, 
  Mail, 
  User, 
  Building, 
  Phone, 
  AlertCircle,
  Eye,
  EyeOff,
  Smartphone,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImageUploadPicker from './ImageUploadPicker';
import api from '../services/api';

export default function AuthModal() {
  const { 
    authModalOpen, 
    authModalMode,
    setAuthModalMode,
    closeAuth, 
    login, 
    register, 
    loginWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    phoneConfirmation,
    loading, 
    authError 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('email'); // 'email' | 'phone'
  const [showPassword, setShowPassword] = useState(false);

  // Email login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Owner',
    phone: '',
    business_name: ''
  });

  // Phone auth state
  const [phoneNumber, setPhoneNumber] = useState('+91 ');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Forgot Password (6-Digit Email OTP) state
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: otp + new pass, 3: success
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDevCode, setForgotDevCode] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  const [localError, setLocalError] = useState('');

  if (!authModalOpen) return null;

  const handleForgotSendOtp = async (e) => {
    if (e) e.preventDefault();
    setLocalError('');
    if (!forgotEmail || !forgotEmail.trim()) {
      setLocalError('Please enter your registered email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/send-otp', { email: forgotEmail.trim() });
      if (res.data?.success) {
        setForgotStep(2);
        if (res.data.devOtp) setForgotDevCode(res.data.devOtp);
      } else {
        setLocalError(res.data?.message || 'Failed to send OTP code.');
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || 'Error sending verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyReset = async (e) => {
    if (e) e.preventDefault();
    setLocalError('');
    if (!forgotOtp || forgotOtp.trim().length < 6) {
      setLocalError('Please enter the 6-digit verification code.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setLocalError('New password must be at least 6 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/verify-reset', {
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword
      });
      if (res.data?.success) {
        setForgotSuccessMsg(res.data.message || 'Password successfully reset!');
        setForgotStep(3);
      } else {
        setLocalError(res.data?.message || 'Failed to verify OTP code.');
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || 'Verification failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!loginEmail || !loginPassword) {
      setLocalError('Please enter both email and password.');
      return;
    }
    const result = await login(loginEmail, loginPassword);
    if (!result.success) {
      setLocalError(result.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!regData.name || !regData.email || !regData.password) {
      setLocalError('Please fill in all required fields.');
      return;
    }
    if (regData.password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    const result = await register(regData);
    if (!result.success) {
      setLocalError(result.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError('');
    const result = await loginWithGoogle();
    if (!result.success) {
      setLocalError(result.message);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setLocalError('Please enter a valid phone number with country code (e.g. +91 99999 12345).');
      return;
    }
    const res = await sendPhoneOtp(phoneNumber.trim(), 'recaptcha-phone-btn');
    if (res.success) {
      setOtpSent(true);
    } else {
      setLocalError(res.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!otpCode || otpCode.trim().length < 6) {
      setLocalError('Please enter the complete 6-digit verification code.');
      return;
    }
    const res = await verifyPhoneOtp(otpCode.trim());
    if (!res.success) {
      setLocalError(res.message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="fixed inset-0" onClick={closeAuth} />
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all my-auto z-10">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Smart Merchant Access
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Firebase Cloud Identity & Auth
              </p>
            </div>
          </div>
          <button
            onClick={closeAuth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector: Sign In vs Create Account OR Forgot Password Breadcrumb */}
        {authModalMode === 'forgot' ? (
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 px-4 py-2.5 shrink-0">
            <button
              type="button"
              onClick={() => { setAuthModalMode('login'); setLocalError(''); }}
              className="flex items-center space-x-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {forgotStep === 1 ? 'Step 1: Email Code' : forgotStep === 2 ? 'Step 2: Reset' : 'Done'}
            </span>
          </div>
        ) : (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 p-1.5 gap-1.5 shrink-0">
            <button
              onClick={() => { setAuthModalMode('login'); setLocalError(''); setOtpSent(false); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                authModalMode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => { setAuthModalMode('register'); setLocalError(''); setOtpSent(false); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                authModalMode === 'register'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Store</span>
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          
          {/* Quick Google Sign In Button */}
          {authModalMode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-2.5 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-medium text-slate-400 shrink-0">
                  OR CHOOSE METHOD
                </span>
              </div>
            </>
          )}

          {/* Sub-method tabs (Email/Password vs Mobile Number OTP) */}
          {authModalMode === 'login' && (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setActiveTab('email'); setLocalError(''); }}
                className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  activeTab === 'email'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email & Password</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('phone'); setLocalError(''); }}
                className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  activeTab === 'phone'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Number OTP</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {(localError || authError) && (
            <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError || authError}</span>
            </div>
          )}

          {/* 1. EMAIL LOGIN FORM */}
          {authModalMode === 'login' && activeTab === 'email' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. onr1@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end -mt-1 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('forgot');
                    setForgotStep(1);
                    setForgotEmail(loginEmail || '');
                    setForgotOtp('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setLocalError('');
                    setForgotSuccessMsg('');
                    setForgotDevCode('');
                  }}
                  className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In with Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. PHONE NUMBER OTP FORM */}
          {authModalMode === 'login' && activeTab === 'phone' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Mobile Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+91 99999 12345"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Includes international code (e.g. <code>+91</code>). Test numbers in Firebase Console work without real SMS.
                    </p>
                  </div>

                  <button
                    id="recaptcha-phone-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Send Verification SMS OTP</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>OTP sent to <strong>{phoneNumber}</strong></span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Enter 6-Digit OTP Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-center text-sm tracking-widest font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify & Sign In</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Change phone number / Resend
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 3. REGISTER FORM */}
          {authModalMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regData.name}
                    onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                    placeholder="e.g. Anand Sharma"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    placeholder="e.g. anand@supermart.com"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      placeholder="Min 6 chars"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={regData.phone}
                      onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                      placeholder="+91 98765 00000"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Business / Store Name *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regData.business_name}
                    onChange={(e) => setRegData({ ...regData, business_name: e.target.value })}
                    placeholder="e.g. Sharma Provision Store"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              <ImageUploadPicker
                value={regData.avatar}
                onChange={(img) => setRegData({ ...regData, avatar: img })}
                label="Store Owner Profile Photo / Avatar"
                presets={[
                  { label: 'Executive', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
                  { label: 'Merchant', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
                  { label: 'Manager', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
                  { label: 'Founder', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' }
                ]}
                placeholderText="Upload your owner photo"
              />

              <div className="p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 text-[11px] text-brand-800 dark:text-brand-300 leading-snug">
                👑 <strong>Store Owner Account:</strong> Your profile is securely provisioned in Firebase Auth and Cloud Firestore.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 4. FORGOT PASSWORD (EMAIL OTP) FLOW */}
          {authModalMode === 'forgot' && (
            <div className="space-y-4 animate-fade-in">
              {forgotStep === 1 && (
                <form onSubmit={handleForgotSendOtp} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        2-Step Email Password Recovery
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Enter your registered store account email. We will send a secure 6-digit one-time password (OTP) to verify your identity.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. yourname@gmail.com"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send 6-Digit Security Code</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleForgotVerifyReset} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                    <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Security code dispatched!</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                      We sent a 6-digit verification code to <strong>{forgotEmail}</strong>. Check your inbox or spam folder.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Enter 6-Digit Email OTP
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-center text-base tracking-widest font-mono font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showForgotPass ? 'text' : 'password'}
                          required
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotPass(!showForgotPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showForgotPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showForgotPass ? 'text' : 'password'}
                          required
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify Code & Reset Password</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleForgotSendOtp}
                      disabled={forgotLoading}
                      className="text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 3 && (
                <div className="text-center py-4 space-y-4 animate-fade-in">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Password Reset Complete!
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      {forgotSuccessMsg || 'Your password has been securely updated. You can now log into your merchant account.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      setLoginEmail(forgotEmail);
                      setLoginPassword('');
                      setLocalError('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In Now</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
