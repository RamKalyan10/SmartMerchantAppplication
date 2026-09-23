import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Check, X, Shield, AlertCircle, RefreshCw, UserPlus, Trash2, Eye, EyeOff, Lock, Mail, User, Phone, Image } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUploadPicker from '../components/ImageUploadPicker';

export default function StaffPage({ quickActionTrigger, isNewModalOpen: propIsNewModalOpen, onConsumeQuickAction }) {
  const { user: currentUser, hasPermission } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create Staff Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    phone: '',
    avatar: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, capRes] = await Promise.all([
        api.get('/auth/staff'),
        api.get('/auth/capabilities')
      ]);
      setStaffList(staffRes.data?.staff || []);
      setCapabilities(capRes.data?.capabilities || []);
    } catch (err) {
      console.error('Error fetching staff and permissions from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if ((quickActionTrigger?.page === 'staff' || propIsNewModalOpen) && (currentUser?.role === 'Owner' || currentUser?.role === 'Admin')) {
      handleOpenCreateModal();
      if (onConsumeQuickAction) {
        onConsumeQuickAction();
      }
    }
  }, [quickActionTrigger, propIsNewModalOpen, currentUser]);

  const handleOpenCreateModal = () => {
    setFormError('');
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'Staff',
      phone: '',
      avatar: ''
    });
    setIsModalOpen(true);
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.email || !formData.password) {
      setFormError('Please provide name, email, and password for the staff login.');
      return;
    }
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setCreating(true);
    try {
      await api.post('/auth/staff', formData);
      setIsModalOpen(false);
      fetchData();
      alert(`Staff login for ${formData.name} created successfully! They can now log in with these credentials.`);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error creating staff login');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!confirm(`Are you sure you want to revoke access for ${staffName}? They will no longer be able to log in.`)) return;
    try {
      await api.delete(`/auth/staff/${staffId}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove staff member');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/auth/staff/${userId}/role`, { role: newRole });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Owner': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'Admin': return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'Manager': return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default: return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Staff & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store Owners can create credentials for Cashiers, Inventory Managers, and Admins to operate the store securely.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {hasPermission('Admin') && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Staff Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900/60">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Security & Permission Capabilities Matrix
          </h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Enforced in Database & API Gateways
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-bold">System Capability</th>
                <th className="py-3 px-4 text-center font-bold">Staff / Cashier</th>
                <th className="py-3 px-4 text-center font-bold">Manager</th>
                <th className="py-3 px-4 text-center font-bold">Admin</th>
                <th className="py-3 px-4 text-center font-bold">Store Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {capabilities.map((cap) => (
                <tr key={cap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {cap.capability}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.staff ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 font-bold">✗</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.manager ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 font-bold">✗</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.admin ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 font-bold">✗</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cap.owner ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 font-bold">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Authorized Store Accounts ({staffList.length} Members in DB)</span>
          <span className="text-[10px] text-slate-500 font-normal">Active Credentials</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-bold">User / Photo</th>
                <th className="px-5 py-3.5 font-bold">Login Email</th>
                <th className="px-5 py-3.5 font-bold">Phone</th>
                <th className="px-5 py-3.5 font-bold">Assigned Role</th>
                <th className="px-5 py-3.5 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {staffList.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center space-x-3">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs border border-brand-300 dark:border-brand-500/30">
                          {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {member.id === currentUser?.id && (
                            <span className="text-[10px] font-normal text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/15 px-1.5 py-0.2 rounded">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {member.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-medium">
                    {member.email}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {member.phone || 'N/A'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRoleBadge(member.role)}`}>
                      {member.role === 'Staff' ? 'Staff (Cashier)' : member.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {currentUser?.role === 'Owner' && member.id !== currentUser.id ? (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                          >
                            <option value="Staff">Staff (Cashier)</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                            <option value="Owner">Owner</option>
                          </select>
                          <button
                            onClick={() => handleDeleteStaff(member.id, member.name)}
                            title="Revoke Staff Login"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          {member.id === currentUser?.id ? 'Active Session' : 'Protected'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {staffList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No team members found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL (PORTALIZED) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Create Staff Login Credentials
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Provision new cashier, manager, or admin account in database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="staffModalForm" onSubmit={handleCreateStaff} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {formError && (
                <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Cashier"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1">
                  Login Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. ramesh@store.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 6 chars"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Assigned Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="Staff">Staff (Cashier / POS Billing)</option>
                    <option value="Manager">Manager (Stock & Expenses)</option>
                    <option value="Admin">Admin (Full Management)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 98765 11111"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <ImageUploadPicker
                value={formData.avatar}
                onChange={(img) => setFormData({ ...formData, avatar: img })}
                label="Staff Member Photo / Avatar (Direct Upload)"
                presets={[
                  { label: 'Staff 1', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
                  { label: 'Staff 2', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100' },
                  { label: 'Staff 3', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
                  { label: 'Staff 4', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' }
                ]}
                placeholderText="Upload staff photo from computer (PNG, JPG, WebP)"
              />
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="staffModalForm"
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center space-x-1.5"
              >
                {creating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                <span>Save Staff Account</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
