import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, 
  PlusCircle, 
  Shield, 
  ChevronDown, 
  User, 
  LogIn, 
  LogOut, 
  Sparkles,
  Store,
  UserPlus,
  Settings,
  X,
  Phone,
  Image,
  CheckCircle2,
  Receipt,
  Package,
  Users,
  Truck,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import ImageUploadPicker from './ImageUploadPicker';
import api from '../services/api';
import { buildNotifications, loadReadIds, saveReadIds } from '../services/notifications';

const PROFILE_PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
];

export default function Navbar({ onOpenNewInvoice, onQuickAction }) {
  const { user, isAuthenticated, logout, openAuth, updateProfile } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [quickDropdownOpen, setQuickDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread' | 'alerts'
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Live Notifications State
  //
  // These were previously five hardcoded entries, one of which announced an
  // "Isolation Forest" detection of a freight charge that appears in no table.
  // The list is now built from the model responses, so every entry traces back
  // to a real invoice, expense or stock level.
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [readIds, setReadIds] = useState(() => loadReadIds());

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    setNotificationsLoading(true);
    const errors = [];
    const fetchedAt = new Date().toISOString();

    const [insights, expenses] = await Promise.all([
      api
        .get('/forecast/insights?days=7')
        .then((res) => res.data)
        .catch((err) => {
          errors.push(
            err.response?.data?.message ||
              'The forecast insights endpoint did not respond.'
          );
          return null;
        }),
      api
        .get('/forecast/expenses?days=30')
        .then((res) => res.data)
        .catch((err) => {
          errors.push(
            err.response?.data?.message ||
              'The expense forecast endpoint did not respond.'
          );
          return null;
        })
    ]);

    setNotifications(buildNotifications({ insights, expenses, fetchedAt, errors }));
    setNotificationsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Read state is keyed by a content-derived id, so an alert the merchant
  // already dismissed does not reappear as unread on the next refresh.
  const decorated = notifications.map((n) => ({ ...n, read: readIds.includes(n.id) }));
  const unreadCount = decorated.filter((n) => !n.read).length;

  const markRead = (entries) => {
    setReadIds((prev) => {
      const next = [...new Set([...prev, ...entries.map((n) => n.id)])];
      saveReadIds(next);
      return next;
    });
  };

  const handleMarkAllRead = () => markRead(decorated);

  const handleNotificationClick = (notif) => {
    markRead([notif]);
    setNotificationsOpen(false);
    if (onQuickAction && notif.targetPage) {
      onQuickAction(notif.targetPage);
    }
  };

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleOpenEditProfile = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditBusinessName(user?.business_name || '');
    setEditAvatar(user?.avatar || PROFILE_PRESET_AVATARS[0]);
    setSaveSuccess(false);
    setProfileDropdownOpen(false);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await updateProfile({
        name: editName,
        phone: editPhone,
        business_name: editBusinessName,
        avatar: editAvatar
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditProfileOpen(false);
        setSaveSuccess(false);
      }, 900);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating profile');
    } finally {
      setSaveLoading(false);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Owner': return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
      case 'Admin': return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
      case 'Manager': return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30';
      default: return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  const filteredNotifications = decorated.filter(n => {
    if (notifFilter === 'unread') return !n.read;
    if (notifFilter === 'alerts') return n.category === 'alerts';
    return true;
  });

  return (
    <header className={`h-16 border-b px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 transition-all duration-300 ${
      isAuthenticated
        ? 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0F172A]/70 backdrop-blur-md'
        : 'border-white/10 bg-black/20 backdrop-blur-xl'
    }`}>
      
      {/* Left Area: Search Bar if Authenticated / Platform Brand if Guest */}
      {isAuthenticated ? (
        <div className="flex items-center space-x-4 w-72 sm:w-80 lg:w-[420px]">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, invoices, customers, suppliers..."
              className="w-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-10 pr-14 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
              Ctrl K
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg font-bold text-xs"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>
            SM
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">Smart Merchant</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.2 rounded border border-brand-200 dark:border-brand-800/50">
              AI Intelligence Suite
            </span>
          </div>
        </div>
      )}

      {/* Right Area Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Working Notification Bell with Dropdown */}
        {isAuthenticated && (
          <div className="relative">
            <button
              onClick={() => {
                const next = !notificationsOpen;
                setNotificationsOpen(next);
                if (next) refreshNotifications();
              }}
              title="Notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 px-1 rounded-full bg-rose-500 text-[8px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadCount > 1 ? unreadCount : ''}
                </span>
              )}
            </button>

            {/* Notifications Center Popover */}
            {notificationsOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-40 text-xs animate-fade-in flex flex-col max-h-[500px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          {unreadCount} New
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Filter Pills: All | Unread | Alerts */}
                  <div className="flex items-center gap-1.5 py-2.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'unread', label: `Unread (${unreadCount})` },
                      { id: 'alerts', label: 'Alerts & Anomalies' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          notifFilter === tab.id
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification Items List */}
                  <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-1 flex-1">
                    {filteredNotifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-2.5 rounded-xl my-1 flex items-start gap-2.5 transition-colors cursor-pointer ${
                          !notif.read
                            ? 'bg-brand-50/50 dark:bg-brand-950/30 hover:bg-brand-50 dark:hover:bg-brand-950/50'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="text-base shrink-0 mt-0.5">{notif.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-slate-900 dark:text-white truncate text-xs">
                              {notif.title}
                            </p>
                            <span className="text-[9px] text-slate-400 shrink-0 font-medium">{notif.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                            {notif.description}
                          </p>
                          {notif.suggestedAction && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                              {notif.suggestedAction}
                            </p>
                          )}
                          {notif.impact && (
                            <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {notif.impact}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredNotifications.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-8">
                        {notificationsLoading
                          ? 'Checking models for alerts…'
                          : notifFilter === 'unread'
                          ? 'Nothing unread.'
                          : 'No notifications found.'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Theme Toggle (Light / Dark Mode) */}
        <ThemeToggle />

        {isAuthenticated ? (
          <>
            {/* Custom Quick Action Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setQuickDropdownOpen(!quickDropdownOpen)}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/25 transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Quick Create</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${quickDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick Actions Menu */}
              {quickDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setQuickDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 z-40 text-xs animate-fade-in divide-y divide-slate-100 dark:divide-slate-800/60">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Quick Operations
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setQuickDropdownOpen(false);
                          if (onQuickAction) onQuickAction('invoices');
                          else if (onOpenNewInvoice) onOpenNewInvoice();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">New Invoice (POS)</div>
                          <div className="text-[10px] text-slate-400">Point of Sale billing</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setQuickDropdownOpen(false);
                          if (onQuickAction) onQuickAction('products');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">New Product SKU</div>
                          <div className="text-[10px] text-slate-400">Add item with photo</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setQuickDropdownOpen(false);
                          if (onQuickAction) onQuickAction('customers');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">New Customer</div>
                          <div className="text-[10px] text-slate-400">Register customer</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setQuickDropdownOpen(false);
                          if (onQuickAction) onQuickAction('suppliers');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                          <Truck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">New Supplier</div>
                          <div className="text-[10px] text-slate-400">Register vendor</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setQuickDropdownOpen(false);
                          if (onQuickAction) onQuickAction('expenses');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold">Record Expense</div>
                          <div className="text-[10px] text-slate-400">Log store cost</div>
                        </div>
                      </button>

                      {(user?.role === 'Owner' || user?.role === 'Admin') && (
                        <button
                          onClick={() => {
                            setQuickDropdownOpen(false);
                            if (onQuickAction) onQuickAction('staff');
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                        >
                          <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                            <UserPlus className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold">Create Staff Login</div>
                            <div className="text-[10px] text-slate-400">Cashier / Manager account</div>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2.5 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs hover:opacity-85 transition-opacity"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    onError={(e) => { e.target.onerror = null; e.target.src = PROFILE_PRESET_AVATARS[0]; }}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                    {user?.name || 'Merchant User'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                    {user?.role || 'Staff'} • {user?.business_name || 'Store'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                  {/* Profile Card Header */}
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl mb-1 flex items-center gap-3">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-brand-500/40 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-sm shrink-0">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {user?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user?.email}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getRoleBadgeStyle(user?.role)}`}>
                          {user?.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-1 space-y-1">
                    <button
                      onClick={handleOpenEditProfile}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-brand-500" />
                      <span>Edit Profile & Photo</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Guest Actions */
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openAuth('login')}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => openAuth('register')}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-lg transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #06B6D4 100%)' }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Started</span>
            </button>
          </div>
        )}

      </div>

      {/* EDIT PROFILE MODAL (PORTALIZED) */}
      {isEditProfileOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in text-left">
          <div className="fixed inset-0" onClick={() => setIsEditProfileOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Edit Profile & Account</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Update merchant details and profile photo</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="profileModalForm" onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {/* Profile Avatar Direct Upload */}
              <ImageUploadPicker
                value={editAvatar}
                onChange={(img) => setEditAvatar(img)}
                label="Profile Photo / Avatar (Direct Upload)"
                presets={[
                  { label: 'Executive', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
                  { label: 'Merchant', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
                  { label: 'Manager', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
                  { label: 'Founder', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
                  { label: 'Cashier', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150' },
                  { label: 'Supervisor', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }
                ]}
                placeholderText="Upload your profile photo from computer (PNG, JPG, WebP)"
              />

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Your Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Store / Business Name</label>
                <input
                  type="text"
                  value={editBusinessName}
                  onChange={(e) => setEditBusinessName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="profileModalForm"
                type="submit"
                disabled={saveLoading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
