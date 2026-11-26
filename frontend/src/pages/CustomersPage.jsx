import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Search, Phone, Mail, MapPin, Eye, X, RefreshCw, Image, Sparkles, Send, TrendingUp, ShoppingBag, ShoppingCart, Copy, Check, FileText, Clock, User, Wallet, CreditCard, Receipt, CheckCircle2, Calendar, ArrowRight, Share2, History, Banknote } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
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
  const toast = useToast();
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

  // Installment Repayment State
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [installmentCustomer, setInstallmentCustomer] = useState(null);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [installmentMethod, setInstallmentMethod] = useState('Cash');
  const [installmentNotes, setInstallmentNotes] = useState('');
  const [installmentReference, setInstallmentReference] = useState('');
  const [installmentInvoiceId, setInstallmentInvoiceId] = useState('');
  const [submittingInstallment, setSubmittingInstallment] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [modalTab, setModalTab] = useState('invoices'); // 'invoices' | 'receipts'

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
      toast.success('New customer profile saved successfully!');
      fetchCustomers();
    } catch (err) {
      toast.error('Error creating customer in database');
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
      toast.success('Invoice marked as Paid! Ledger updated.');
    } catch (err) {
      toast.error('Failed to update invoice payment status: ' + (err.response?.data?.message || err.message));
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleOpenInstallment = (customer, invoice = null) => {
    setInstallmentCustomer(customer);
    setInstallmentInvoiceId(invoice ? invoice.id : '');
    const pendingDue = Number(customer.pending_amount || 0);
    const invoiceDue = invoice 
      ? (invoice.balance_due !== undefined ? Number(invoice.balance_due) : Number(invoice.total_amount || 0))
      : 0;

    let defaultAmt = '';
    if (invoice && invoiceDue > 0) {
      defaultAmt = String(invoiceDue);
    } else if (pendingDue > 0) {
      // Pre-fill full pending due or comfortable chunk
      defaultAmt = String(pendingDue);
    }

    setInstallmentAmount(defaultAmt);
    setInstallmentMethod('Cash');
    setInstallmentNotes('');
    setInstallmentReference('');
    setCompletedReceipt(null);
    setIsInstallmentModalOpen(true);
  };

  const handleRecordInstallment = async (e) => {
    e.preventDefault();
    if (!installmentCustomer) return;
    const numAmt = Number(installmentAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error('Please enter a valid installment amount greater than 0.');
      return;
    }

    setSubmittingInstallment(true);
    try {
      const payload = {
        amount: numAmt,
        payment_method: installmentMethod,
        notes: installmentNotes,
        reference_id: installmentReference,
        invoice_id: installmentInvoiceId || undefined
      };

      const res = await api.post(`/customers/${installmentCustomer.id}/installment`, payload);
      const { receipt, customer: updatedCust, allocated_invoices } = res.data;

      setCompletedReceipt(receipt);
      toast.success(`Installment payment of ₹${numAmt.toLocaleString('en-IN')} recorded successfully!`);

      // Refresh customer list in background
      fetchCustomers();

      // If customer modal is currently open, refresh data
      if (selectedCustomer && (selectedCustomer.customer?.id === installmentCustomer.id)) {
        try {
          const detailRes = await api.get(`/customers/${installmentCustomer.id}`);
          setSelectedCustomer(detailRes.data);
        } catch (_) {}
      }
    } catch (err) {
      toast.error('Failed to record installment payment: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingInstallment(false);
    }
  };

  const formatCurrency = (val, decimals = 0) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    })}`;
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((cust) => {
          const lifetimeSpend = cust.total_spent || cust.total_purchases || 0;
          const pendingAmount = cust.pending_amount || 0;
          const ordersCount = cust.orders_count || 0;
          const isCopied = copiedId === cust.id;

          const copyCustomerId = (id) => {
            navigator.clipboard?.writeText(id);
            setCopiedId(id);
            toast.success(`Copied customer ID: ${id}`);
            setTimeout(() => setCopiedId(null), 2000);
          };

          return (
            <div
              key={cust.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col space-y-3 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600/40 transition-all duration-300 shadow-sm overflow-hidden"
            >
              {/* TOP ROW: Avatar, Name + Copyable ID, Orders Badge */}
              <div className="flex items-start justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar Circle with Online Dot */}
                  <div className="relative shrink-0">
                    {cust.avatar ? (
                      <img
                        src={cust.avatar}
                        alt={cust.name}
                        onError={(e) => { e.target.onerror = null; e.target.src = CUSTOMER_PRESET_AVATARS[0]; }}
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700/60 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-700/60 flex items-center justify-center font-black text-lg shadow-inner">
                        {cust.name?.charAt(0) || 'C'}
                      </div>
                    )}
                    {/* Green online indicator dot */}
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                  </div>

                  {/* Name & ID */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight truncate leading-tight" title={cust.name}>
                      {cust.name}
                    </h3>
                    <div
                      onClick={() => copyCustomerId(cust.id)}
                      title="Click to copy ID"
                      className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-mono text-[10px] cursor-pointer transition-colors max-w-full truncate"
                    >
                      <span className="truncate">ID: {cust.id}</span>
                      {isCopied ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <Copy className="w-3 h-3 text-slate-400 shrink-0" />}
                    </div>
                  </div>
                </div>

                {/* Orders Badge */}
                <div className="shrink-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-xl font-bold text-[10px] sm:text-[11px] flex items-center gap-1 border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
                  <ShoppingCart className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>{ordersCount} Orders</span>
                </div>
              </div>

              {/* MIDDLE ROW: Clean Structured Contact Card */}
              <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 text-slate-600 dark:text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-mono font-semibold truncate" title={cust.phone}>{cust.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end text-slate-600 dark:text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate" title={cust.email}>{cust.email || '—'}</span>
                  </div>
                </div>
                {cust.address && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate" title={cust.address}>{cust.address}</span>
                  </div>
                )}
              </div>

              {/* DUAL KPI STATS BOXES (Clean non-overlapping vertical layout) */}
              {/* DUAL KPI STATS BOXES & BUTTONS (Grouped with NO gap) */}
              <div className="mt-auto space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  {/* Box 1: Lifetime Spend */}
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden shadow-xs min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
                        Lifetime Spend
                      </span>
                      <div className="w-4 h-4 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <div className="mt-1 min-w-0">
                      <div
                        className="text-sm sm:text-base font-black text-emerald-900 dark:text-emerald-300 font-mono tracking-tight truncate leading-tight"
                        title={formatCurrency(lifetimeSpend, 2)}
                      >
                        {formatCurrency(lifetimeSpend, 0)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                        {ordersCount} orders
                      </div>
                    </div>
                  </div>

                  {/* Box 2: Pending Amount */}
                  <div className={`rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden shadow-xs border min-w-0 ${
                    pendingAmount > 0
                      ? 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/40'
                      : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                        pendingAmount > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        Pending Dues
                      </span>
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                        pendingAmount > 0
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <div className="mt-1 min-w-0">
                      <div
                        className={`text-sm sm:text-base font-black font-mono tracking-tight truncate leading-tight ${
                          pendingAmount > 0 ? 'text-amber-900 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                        }`}
                        title={formatCurrency(pendingAmount, 2)}
                      >
                        {formatCurrency(pendingAmount, 0)}
                      </div>
                      <div className={`text-[10px] font-medium truncate mt-0.5 ${
                        pendingAmount > 0 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {pendingAmount > 0 ? 'Unpaid' : 'Cleared ✓'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM ROW: The 3 Action Buttons (No Active badge, zero extra gap) */}
                <div className="flex items-center gap-2 pt-1 w-full min-w-0">
                  {/* 1. Pay Installment (Always available; dimmed/less visible when pendingAmount <= 0) */}
                  <button
                    onClick={() => handleOpenInstallment(cust)}
                    className={`flex-1 min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pendingAmount > 0
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-slate-100/90 dark:bg-slate-800/60 hover:bg-slate-200/90 dark:hover:bg-slate-700/80 text-slate-400 dark:text-slate-500 border border-slate-200/80 dark:border-slate-700/80 opacity-50 hover:opacity-90'
                    }`}
                    title={
                      pendingAmount > 0
                        ? `Record repayment of pending due (${formatCurrency(pendingAmount)})`
                        : 'Due is ₹0 (No outstanding dues to repay)'
                    }
                  >
                    <Wallet className={`w-3.5 h-3.5 shrink-0 ${pendingAmount > 0 ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">Pay Installment</span>
                  </button>

                  {/* 2. Mail Button (If email available) */}
                  {cust.email && (
                    <a
                      href={`mailto:${cust.email}?subject=Your Purchase Summary - Smart Merchant Store&body=Dear ${cust.name},%0A%0AThank you for being our valued customer! Your lifetime spend is ${formatCurrency(lifetimeSpend, 2)} across ${ordersCount} orders.%0A%0ARegards,%0ASmart Merchant Store`}
                      className="shrink-0 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
                      title="Send Email"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>Mail</span>
                    </a>
                  )}

                  {/* 3. View History Button */}
                  <button
                    onClick={() => handleViewCustomer(cust)}
                    className="flex-1 min-w-0 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">View History</span>
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

                <div className={`${(selectedCustomer.customer?.pending_amount || 0) > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-400/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'} rounded-2xl p-3 border text-center transition-all flex flex-col justify-between`}>
                  <div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase flex items-center justify-center gap-1">
                      {(selectedCustomer.customer?.pending_amount || 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                      <span>Pending Dues</span>
                    </div>
                    <div className="font-mono font-extrabold text-sm sm:text-base text-amber-700 dark:text-amber-400 mt-0.5">
                      {formatCurrency(selectedCustomer.customer?.pending_amount || 0)}
                    </div>
                  </div>
                  {(selectedCustomer.customer?.pending_amount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenInstallment(selectedCustomer.customer)}
                      className="mt-2 w-full py-1 px-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Wallet className="w-3 h-3" />
                      <span>Pay Installment</span>
                    </button>
                  )}
                </div>

                <div className="bg-brand-50 dark:bg-brand-950/30 rounded-2xl p-3 border border-brand-200 dark:border-brand-800/40 text-center flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase">Invoices</div>
                    <div className="font-mono font-extrabold text-sm sm:text-base text-brand-700 dark:text-brand-300 mt-0.5">
                      {selectedCustomer.invoices?.length || selectedCustomer.customer?.orders_count || 0}
                    </div>
                  </div>
                  <div className="text-[10px] text-brand-600 dark:text-brand-400 font-medium mt-1">
                    {selectedCustomer.payments?.length || 0} repayments
                  </div>
                </div>
              </div>

              {/* TABS: Invoices vs Repayment Receipts */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 pt-1 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModalTab('invoices')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      modalTab === 'invoices'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Invoices ({selectedCustomer.invoices?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('receipts')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      modalTab === 'receipts'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Repayments ({selectedCustomer.payments?.length || 0})</span>
                  </button>
                </div>

                {(selectedCustomer.customer?.pending_amount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenInstallment(selectedCustomer.customer)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-[11px] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>+ Pay Installment</span>
                  </button>
                )}
              </div>

              {/* TAB 1: INVOICES & OUTSTANDING DUES */}
              {modalTab === 'invoices' && (
                <div className="space-y-2.5">
                  {(selectedCustomer.invoices || []).map((inv) => {
                    const statusUpper = (inv.payment_status || 'PAID').toUpperCase();
                    const isPending = statusUpper === 'PENDING' || statusUpper === 'UNPAID' || statusUpper === 'DUE';
                    const isPartial = statusUpper === 'PARTIAL';
                    const isUnsettled = isPending || isPartial;
                    const totalAmt = Number(inv.total_amount || 0);
                    const paidAmt = inv.paid_amount !== undefined ? Number(inv.paid_amount) : (isUnsettled ? 0 : totalAmt);
                    const balanceDue = inv.balance_due !== undefined ? Number(inv.balance_due) : (isUnsettled ? totalAmt : 0);
                    const isUpdating = markingPaidId === inv.id;

                    const mailSubject = encodeURIComponent(`Invoice ${inv.invoice_number} - Payment Notice`);
                    const mailBody = encodeURIComponent(`Dear ${selectedCustomer.customer?.name},\n\nSummary for Invoice ${inv.invoice_number} dated ${inv.date}.\nTotal: ${formatCurrency(totalAmt, 2)}\nBalance Due: ${formatCurrency(balanceDue, 2)}\nStatus: ${statusUpper}\n\nSmart Merchant Store.`);
                    const waText = encodeURIComponent(`Hi ${selectedCustomer.customer?.name}, reminder for Invoice ${inv.invoice_number}. Total: ${formatCurrency(totalAmt, 2)}, Balance Due: ${formatCurrency(balanceDue, 2)} (${statusUpper}). Please clear via installment at your convenience.`);

                    return (
                      <div 
                        key={inv.id} 
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isUnsettled 
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-sm' 
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xs">{inv.invoice_number}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                isPartial
                                  ? 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                                  : isPending
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
                              {formatCurrency(totalAmt)}
                            </div>
                            {isPartial && (
                              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                                Due: {formatCurrency(balanceDue)}
                              </div>
                            )}
                            {inv.items && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {inv.items.length} line {inv.items.length === 1 ? 'item' : 'items'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons for Unsettled / Paid invoices */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                          {isUnsettled && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenInstallment(selectedCustomer.customer, inv)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Pay Installment</span>
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleMarkInvoicePaid(inv.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Check className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                                <span>{isUpdating ? 'Updating...' : '⚡ Clear Full Due'}</span>
                              </button>
                            </>
                          )}

                          {selectedCustomer.customer?.phone && isUnsettled && (
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
              )}

              {/* TAB 2: REPAYMENT RECEIPTS LEDGER */}
              {modalTab === 'receipts' && (
                <div className="space-y-2.5">
                  {(selectedCustomer.payments && selectedCustomer.payments.length > 0) ? (
                    selectedCustomer.payments.map((p) => {
                      const waReceiptMsg = encodeURIComponent(
                        `*Smart Merchant Payment Receipt*\nReceipt: ${p.receipt_number}\nCustomer: ${p.customer_name}\nAmount Repaid: ${formatCurrency(p.amount, 2)}\nPayment Mode: ${p.payment_method}\nDate: ${p.payment_date}\n${p.reference_id ? `Reference: ${p.reference_id}\n` : ''}Thank you for your payment!`
                      );

                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs">
                                  {p.receipt_number || p.id}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                  Repayment ✓
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                <span>📅 {p.payment_date || (p.created_at ? p.created_at.slice(0, 10) : '—')}</span>
                                <span>•</span>
                                <span>💳 {p.payment_method || 'Cash'}</span>
                              </p>
                              {p.reference_id && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                  Ref: {p.reference_id}
                                </p>
                              )}
                              {p.notes && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">
                                  "{p.notes}"
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <div className="font-mono font-extrabold text-base text-emerald-700 dark:text-emerald-300">
                                +{formatCurrency(p.amount)}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                                Received
                              </div>
                            </div>
                          </div>

                          {/* Allocation tags if present */}
                          {p.allocated_invoices && p.allocated_invoices.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">Allocated to:</span>
                              {p.allocated_invoices.map((alloc, idx) => (
                                <span key={idx} className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-300">
                                  {alloc.invoice_number}: {formatCurrency(alloc.amount_allocated)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* WhatsApp receipt button */}
                          {selectedCustomer.customer?.phone && (
                            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-end">
                              <a
                                href={`https://wa.me/${selectedCustomer.customer.phone.replace(/[^0-9]/g, '')}?text=${waReceiptMsg}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-xs transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>WhatsApp Receipt</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                      <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p>No installment repayments recorded yet for this customer.</p>
                      {(selectedCustomer.customer?.pending_amount || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenInstallment(selectedCustomer.customer)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Record First Installment</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
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

      {/* INSTALLMENT REPAYMENT MODAL */}
      {isInstallmentModalOpen && installmentCustomer && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => !submittingInstallment && setIsInstallmentModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Customer Installment Repayment
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Record money repaid by customer to settle pending dues and issue receipt.
                  </p>
                </div>
              </div>
              <button
                disabled={submittingInstallment}
                onClick={() => setIsInstallmentModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {completedReceipt ? (
              /* RECEIPT SUCCESS CELEBRATION VIEW */
              <div className="p-6 space-y-4 text-xs overflow-y-auto">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-emerald-900 dark:text-emerald-200">
                      Installment Repaid Successfully!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      Receipt <span className="font-mono font-bold">{completedReceipt.receipt_number}</span> has been generated and ledger updated.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/80 max-w-sm mx-auto text-left space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{installmentCustomer.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Amount Repaid:</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(completedReceipt.amount, 2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{completedReceipt.payment_method}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Date:</span>
                      <span className="text-slate-800 dark:text-slate-200">{completedReceipt.payment_date}</span>
                    </div>
                    {installmentCustomer.pending_amount !== undefined && (
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Remaining Due:</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(Math.max(0, Number(installmentCustomer.pending_amount || 0) - Number(completedReceipt.amount || 0)), 2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Share Button */}
                  {installmentCustomer.phone && (
                    <a
                      href={`https://wa.me/${installmentCustomer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `*Smart Merchant Payment Receipt*\nReceipt: ${completedReceipt.receipt_number}\nCustomer: ${installmentCustomer.name}\nAmount Repaid: ${formatCurrency(completedReceipt.amount, 2)}\nPayment Mode: ${completedReceipt.payment_method}\nDate: ${completedReceipt.payment_date}\nRemaining Balance Due: ${formatCurrency(Math.max(0, Number(installmentCustomer.pending_amount || 0) - Number(completedReceipt.amount || 0)), 2)}\nThank you for choosing Smart Merchant Store!`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share Receipt on WhatsApp</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedReceipt(null);
                      setInstallmentAmount('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Record Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInstallmentModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* INSTALLMENT INPUT FORM */
              <form onSubmit={handleRecordInstallment} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Customer Info Card */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                      {installmentCustomer.name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{installmentCustomer.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{installmentCustomer.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Total Pending</span>
                    <div className="font-mono font-black text-amber-700 dark:text-amber-400 text-base">
                      {formatCurrency(installmentCustomer.pending_amount || 0)}
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider flex items-center justify-between">
                    <span>Installment Amount to Repay (₹) *</span>
                    <span className="text-slate-400 font-normal">Enter amount</span>
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="0.00"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-slate-900 dark:text-white font-mono font-bold text-base placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Quick Preset Amount Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setInstallmentAmount(String(amt))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-300 hover:text-amber-700 font-mono text-[11px] font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        +₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                    {(installmentCustomer.pending_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setInstallmentAmount(String(installmentCustomer.pending_amount))}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-mono text-[11px] font-bold shadow-xs transition-colors"
                      >
                        Clear Full ({formatCurrency(installmentCustomer.pending_amount)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Balance Calculation Box */}
                {installmentAmount && Number(installmentAmount) > 0 && (
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Due</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                        {formatCurrency(installmentCustomer.pending_amount || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Paying Now</div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                        -{formatCurrency(installmentAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Balance After</div>
                      <div className="font-mono font-black text-amber-800 dark:text-amber-300 text-xs mt-0.5">
                        {formatCurrency(Math.max(0, Number(installmentCustomer.pending_amount || 0) - Number(installmentAmount)))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {['Cash', 'UPI / GPay / PhonePe', 'Card', 'Bank Transfer', 'Cheque'].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setInstallmentMethod(method)}
                        className={`py-2 px-2.5 rounded-xl text-center text-xs font-semibold border transition-all ${
                          installmentMethod === method
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference ID (UPI / Cheque / Bank Transfer ID) */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    Reference / UPI Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-1234567890 or Cheque #88210"
                    value={installmentReference}
                    onChange={(e) => setInstallmentReference(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Partial repayment for wedding groceries"
                    value={installmentNotes}
                    onChange={(e) => setInstallmentNotes(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={submittingInstallment}
                    onClick={() => setIsInstallmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInstallment}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white shadow-md shadow-amber-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {submittingInstallment ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Installment & Issue Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
