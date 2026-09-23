import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Search, Phone, Mail, MapPin, Eye, X, RefreshCw, Image, Sparkles, Send, TrendingUp, ShoppingBag, ShoppingCart, Copy, Check, FileText, Clock, User } from 'lucide-react';
import api from '../services/api';
import ImageUploadPicker from '../components/ImageUploadPicker';

const CUSTOMER_PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'
];

export default function CustomersPage({ quickActionTrigger, isNewModalOpen: propIsNewModalOpen, onConsumeQuickAction }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState('');

  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending' | 'top'
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setCustomers(res.data?.customers || []);
    } catch (err) {
      console.error('Error fetching customers from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (quickActionTrigger?.page === 'customers' || propIsNewModalOpen) {
      handleOpenAdd();
      if (onConsumeQuickAction) {
        onConsumeQuickAction();
      }
    }
  }, [quickActionTrigger, propIsNewModalOpen]);

  const handleOpenAdd = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setAvatar('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', { name, phone, email, address, avatar });
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setAvatar('');
      fetchCustomers();
    } catch (err) {
      alert('Error creating customer in database');
    }
  };

  const handleViewCustomer = async (cust) => {
    try {
      const res = await api.get(`/customers/${cust.id}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      setSelectedCustomer({ customer: cust, invoices: [] });
    }
  };

  const handleMarkInvoicePaid = async (invoiceId) => {
    setMarkingPaidId(invoiceId);
    try {
      await api.patch(`/invoices/${invoiceId}/status`, { payment_status: 'PAID' });
      // Update selectedCustomer modal state
      if (selectedCustomer) {
        const updatedInvoices = (selectedCustomer.invoices || []).map(inv =>
          inv.id === invoiceId ? { ...inv, payment_status: 'PAID' } : inv
        );
        const invToPaid = (selectedCustomer.invoices || []).find(inv => inv.id === invoiceId);
        const paidAmount = Number(invToPaid?.total_amount || 0);
        const prevSpent = Number(selectedCustomer.customer?.total_spent || 0);
        const prevPending = Number(selectedCustomer.customer?.pending_amount || 0);

        setSelectedCustomer({
          ...selectedCustomer,
          customer: {
            ...selectedCustomer.customer,
            total_spent: Math.round((prevSpent + paidAmount) * 100) / 100,
            pending_amount: Math.max(0, Math.round((prevPending - paidAmount) * 100) / 100),
            pending_count: Math.max(0, (selectedCustomer.customer?.pending_count || 1) - 1)
          },
          invoices: updatedInvoices
        });
      }
      // Refresh customer list in background
      fetchCustomers();
    } catch (err) {
      alert('Failed to update invoice payment status: ' + (err.response?.data?.message || err.message));
    } finally {
      setMarkingPaidId(null);
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const totalPendingInDirectory = customers.reduce((sum, c) => sum + Number(c.pending_amount || 0), 0);
  const customersWithPendingCount = customers.filter(c => (c.pending_amount || 0) > 0).length;

  const filtered = customers
    .filter(c => {
      if (filterMode === 'pending') return (c.pending_amount || 0) > 0;
      if (filterMode === 'top') return (c.total_spent || 0) > 5000;
      return true;
    })
    .filter(c =>
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Customer Relationship Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track customer profiles, lifetime purchase histories, order frequencies, and real-time pending invoice dues from database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              filterMode === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterMode === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Dues ({customersWithPendingCount})</span>
            {totalPendingInDirectory > 0 && (
              <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {formatCurrency(totalPendingInDirectory)}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterMode('top')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              filterMode === 'top'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
            }`}
          >
            Top Spenders
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          Showing <span className="text-slate-900 dark:text-white font-bold">{filtered.length}</span> Customers
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
        {filtered.map((cust) => {
          const lifetimeSpend = cust.total_spent || cust.total_purchases || 0;
          const pendingAmount = cust.pending_amount || 0;
          const ordersCount = cust.orders_count || 0;
          const isCopied = copiedId === cust.id;

          const copyCustomerId = (id) => {
            navigator.clipboard?.writeText(id);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
          };

          return (
            <div
              key={cust.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600/40 transition-all duration-300 shadow-sm"
            >
              {/* TOP ROW: Avatar with online indicator, Name + Copyable ID, Orders Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar Circle with Online Dot */}
                  <div className="relative shrink-0">
                    {cust.avatar ? (
                      <img
                        src={cust.avatar}
                        alt={cust.name}
                        onError={(e) => { e.target.onerror = null; e.target.src = CUSTOMER_PRESET_AVATARS[0]; }}
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700/60 shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-700/60 flex items-center justify-center font-black text-xl shadow-inner">
                        {cust.name?.charAt(0) || 'C'}
                      </div>
                    )}
                    {/* Green online indicator dot */}
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                  </div>

                  {/* Name & ID */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight truncate leading-tight">
                      {cust.name}
                    </h3>
                    <div
                      onClick={() => copyCustomerId(cust.id)}
                      title="Click to copy ID"
                      className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-mono text-[11px] cursor-pointer transition-colors"
                    >
                      <span>ID: {cust.id}</span>
                      {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Orders Badge */}
                <div className="shrink-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-2xl font-bold text-xs flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
                  <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{ordersCount} Orders</span>
                </div>
              </div>

              {/* MIDDLE ROW: 3-Column Contact Strip with Dividers */}
              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 dark:border-slate-800/80 text-xs">
                {/* Phone */}
                <div className="flex items-center gap-2 min-w-0 pr-2 border-r border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Phone className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-medium leading-none">Phone</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px] truncate mt-0.5" title={cust.phone}>
                      {cust.phone || '—'}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 min-w-0 px-2 border-r border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Mail className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-medium leading-none">Email</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate mt-0.5" title={cust.email}>
                      {cust.email || '—'}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 min-w-0 pl-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-medium leading-none">Location</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate mt-0.5" title={cust.address}>
                      {cust.address || 'Chennai, IN'}
                    </div>
                  </div>
                </div>
              </div>

              {/* DUAL KPI STATS BOXES */}
              <div className="grid grid-cols-2 gap-3">
                {/* Box 1: Lifetime Spend */}
                <div className="bg-[#edfbf4] dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#d1fae5] dark:bg-emerald-900/50 text-[#059669] dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 dark:text-emerald-400">Lifetime Spend</div>
                      <div className="text-lg sm:text-xl font-black text-[#065f46] dark:text-emerald-300 font-mono tracking-tight leading-tight">
                        {formatCurrency(lifetimeSpend)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {ordersCount} orders
                      </div>
                    </div>
                  </div>
                  <div className="text-emerald-500/70 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>

                {/* Box 2: Pending Amount */}
                <div className="bg-[#fef8ed] dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#fef3c7] dark:bg-amber-900/50 text-[#d97706] dark:text-amber-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70 dark:text-amber-400">Pending Amount</div>
                      <div className="text-lg sm:text-xl font-black text-[#b45309] dark:text-amber-400 font-mono tracking-tight leading-tight">
                        {formatCurrency(pendingAmount)}
                      </div>
                      <div className="text-[10px] text-[#d97706] dark:text-amber-400 font-bold">
                        unpaid
                      </div>
                    </div>
                  </div>
                  <div className="text-amber-500/70 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: Active Customer badge on left, Mail + View History buttons on right */}
              <div className="flex items-center justify-between pt-1">
                {/* Active Customer badge */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active Customer</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {cust.email ? (
                    <a
                      href={`mailto:${cust.email}?subject=Your Purchase Summary - DWDM Store&body=Dear ${cust.name},%0A%0AThank you for being our valued customer! Your lifetime spend is ${formatCurrency(lifetimeSpend)} across ${ordersCount} orders.%0A%0ARegards,%0ADWDM Merchant Store`}
                      className="border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Send Email"
                    >
                      <Send className="w-3 h-3" />
                      <span>Mail</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      title="No email recorded"
                      className="border border-slate-200 dark:border-slate-800 text-slate-400 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                    >
                      <Send className="w-3 h-3" />
                      <span>Mail</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleViewCustomer(cust)}
                    className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View History</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD CUSTOMER MODAL */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Add New Customer</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      ✨ NEW
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Save customer profile with direct photo upload to database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="customerModalForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Direct Avatar Upload */}
              <ImageUploadPicker
                value={avatar}
                onChange={(img) => setAvatar(img)}
                label="Customer Photo / Avatar (Direct Upload)"
                presets={[
                  { label: 'Portrait 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
                  { label: 'Portrait 2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
                  { label: 'Portrait 3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
                  { label: 'Portrait 4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
                  { label: 'Portrait 5', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' }
                ]}
                placeholderText="Upload customer photo from computer (PNG, JPG, WebP)"
              />

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Address</label>
                <input
                  type="text"
                  placeholder="Street / City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>
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
                form="customerModalForm"
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOMER TRANSACTION HISTORY MODAL */}
      {selectedCustomer && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setSelectedCustomer(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                {selectedCustomer.customer?.avatar ? (
                  <img
                    src={selectedCustomer.customer.avatar}
                    alt={selectedCustomer.customer.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-brand-500 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-600/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedCustomer.customer?.name?.charAt(0) || 'C'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{selectedCustomer.customer?.name}</h3>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">{selectedCustomer.customer?.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Lifetime & Pending Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-3 border border-emerald-200 dark:border-emerald-800/40 text-center">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Lifetime Paid</div>
                  <div className="font-mono font-extrabold text-sm sm:text-base text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {formatCurrency(selectedCustomer.customer?.total_spent || 0)}
                  </div>
                </div>

                <div className={`${(selectedCustomer.customer?.pending_amount || 0) > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-400/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'} rounded-2xl p-3 border text-center transition-all`}>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase flex items-center justify-center gap-1">
                    {(selectedCustomer.customer?.pending_amount || 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                    <span>Pending Dues</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm sm:text-base text-amber-700 dark:text-amber-400 mt-0.5">
                    {formatCurrency(selectedCustomer.customer?.pending_amount || 0)}
                  </div>
                </div>

                <div className="bg-brand-50 dark:bg-brand-950/30 rounded-2xl p-3 border border-brand-200 dark:border-brand-800/40 text-center">
                  <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase">Invoices</div>
                  <div className="font-mono font-extrabold text-sm sm:text-base text-brand-700 dark:text-brand-300 mt-0.5">
                    {selectedCustomer.invoices?.length || selectedCustomer.customer?.orders_count || 0}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Transaction & Invoice History
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedCustomer.invoices?.length || 0} records
                </span>
              </div>

              <div className="space-y-2.5">
                {(selectedCustomer.invoices || []).map((inv) => {
                  const isPending = (inv.payment_status || '').toUpperCase() === 'PENDING' || (inv.payment_status || '').toUpperCase() === 'UNPAID';
                  const isUpdating = markingPaidId === inv.id;
                  const mailSubject = encodeURIComponent(`Invoice ${inv.invoice_number} - Payment Notice`);
                  const mailBody = encodeURIComponent(`Dear ${selectedCustomer.customer?.name},\n\nThis is a summary for Invoice ${inv.invoice_number} dated ${inv.date} for an amount of ${formatCurrency(inv.total_amount)}.\n\nPayment Status: ${inv.payment_status || 'Paid'}\n\nThank you for choosing DWDM Merchant Store.`);
                  const waText = encodeURIComponent(`Hi ${selectedCustomer.customer?.name}, reminder regarding Invoice ${inv.invoice_number} of ${formatCurrency(inv.total_amount)} (${inv.payment_status || 'Pending'}). Please clear at your convenience.`);

                  return (
                    <div 
                      key={inv.id} 
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isPending 
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-sm' 
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xs">{inv.invoice_number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isPending
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            }`}>
                              {inv.payment_status || 'Paid'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span>📅 {inv.date}</span>
                            <span>•</span>
                            <span>💳 {inv.payment_method || 'Cash'}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                            {formatCurrency(inv.total_amount)}
                          </div>
                          {inv.items && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {inv.items.length} line {inv.items.length === 1 ? 'item' : 'items'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons for Pending / Paid invoices */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                        {isPending && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleMarkInvoicePaid(inv.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Check className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                            <span>{isUpdating ? 'Updating...' : '⚡ Mark as Paid'}</span>
                          </button>
                        )}

                        {selectedCustomer.customer?.phone && isPending && (
                          <a
                            href={`https://wa.me/${selectedCustomer.customer.phone.replace(/[^0-9]/g, '')}?text=${waText}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            <span>WhatsApp Notice</span>
                          </a>
                        )}

                        {selectedCustomer.customer?.email && (
                          <a
                            href={`mailto:${selectedCustomer.customer.email}?subject=${mailSubject}&body=${mailBody}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            <span>Email Copy</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!selectedCustomer.invoices || selectedCustomer.invoices.length === 0) && (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No past transaction invoices recorded for this customer.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
