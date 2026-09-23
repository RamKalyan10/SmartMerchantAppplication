import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Receipt, 
  Plus, 
  Search, 
  Printer, 
  Eye, 
  Trash2, 
  X, 
  CheckCircle, 
  User, 
  Phone, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Building, 
  Calendar, 
  RefreshCw, 
  ShoppingCart, 
  PlusCircle, 
  MinusCircle, 
  Sparkles, 
  Check, 
  FileText, 
  DollarSign, 
  Percent, 
  Clock, 
  ArrowRight,
  Package,
  Layers,
  Mail,
  DownloadCloud,
  ToggleLeft,
  ToggleRight,
  Filter,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import VoicePOSButton from '../components/VoicePOSButton';

export default function InvoicesPage({ isNewModalOpen, setIsNewModalOpen, quickActionTrigger, onConsumeQuickAction }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'history'
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Invoice History Filters
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'today' | '7d' | '30d' | 'custom'
  const [filterDayPattern, setFilterDayPattern] = useState('all'); // 'all' | 'sundays' | 'festivals' | 'workdays' | 'saturdays'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterAmountRange, setFilterAmountRange] = useState('all'); // 'all' | '0-1000' | '1000-5000' | '5000-15000' | '15000+' | 'custom'
  const [customMinAmount, setCustomMinAmount] = useState('');
  const [customMaxAmount, setCustomMaxAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'PAID' | 'PENDING'
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all'); // 'all' | 'UPI' | 'Cash' | 'Card' | 'NetBanking'
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Selected Invoice for view/print modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const getInvoiceDayMeta = (inv) => {
    const dStr = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '');
    if (!dStr) return { dayName: '', isSunday: false, isSaturday: false, isWorkday: false, isFestive: false, badge: null };
    
    const d = new Date(dStr);
    const dow = d.getDay(); // 0 = Sunday, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dow] || '';

    const note = inv.notes || '';
    const isFestive = note.includes('🎉') || note.toLowerCase().includes('festiv') || note.toLowerCase().includes('pooja') || note.toLowerCase().includes('holiday') || note.toLowerCase().includes('sale');
    const isSunday = dow === 0;
    const isSaturday = dow === 6;
    const isWorkday = dow === 2 || dow === 3 || dow === 4; // Tue, Wed, Thu

    let badge = null;
    if (isFestive) {
      badge = { text: '🎉 Festival Surge', bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40' };
    } else if (isSunday) {
      badge = { text: '🌟 Sunday Peak', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40' };
    } else if (isSaturday) {
      badge = { text: '🛒 Saturday Rush', bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40' };
    } else if (isWorkday) {
      badge = { text: '🏢 Workday Lull', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    } else {
      badge = { text: `📅 ${dayName}`, bg: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    }

    return { dayName, isSunday, isSaturday, isWorkday, isFestive, badge };
  };

  // Cart & POS Terminal State
  const [cart, setCart] = useState([]); // [{ product_id, name, unit_price, quantity, image_url, sku, unit, maxStock }]
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'Cash' | 'Card' | 'NetBanking'
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0.05); // 5% GST
  const [saving, setSaving] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [checkoutStatus, setCheckoutStatus] = useState('PAID'); // 'PAID' | 'PENDING'

  const updateInvoiceStatus = async (inv, newStatus) => {
    setUpdatingStatus(inv.id);
    try {
      await api.patch(`/invoices/${inv.id}/status`, { payment_status: newStatus });
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, payment_status: newStatus } : i));
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, prodRes, catRes, custRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/products'),
        api.get('/products/categories'),
        api.get('/customers')
      ]);
      setInvoices(invRes.data?.invoices || []);
      setProducts(prodRes.data?.products || []);
      setCategories(catRes.data?.categories || []);
      setCustomers(custRes.data?.customers || []);
    } catch (err) {
      console.error('Error fetching invoices from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (quickActionTrigger?.page === 'invoices' || isNewModalOpen) {
      setActiveTab('pos');
      if (onConsumeQuickAction) {
        onConsumeQuickAction();
      }
    }
  }, [quickActionTrigger, isNewModalOpen]);

  // Handle Customer Selection
  const handleCustomerChange = (custId) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      return;
    }
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone || '');
      setCustomerEmail(cust.email || '');
    }
  };

  // Cart Actions
  const addToCart = (product) => {
    const existingIndex = cart.findIndex(it => it.product_id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit_price: Number(product.selling_price) || 0,
          quantity: 1,
          image_url: product.image_url,
          unit: product.unit || 'Units',
          maxStock: product.stock_quantity
        }
      ]);
    }
  };

  const updateQuantity = (productId, delta) => {
    const updated = cart.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setCart(updated);
  };

  const setExactQuantity = (productId, qty) => {
    const parsed = Math.max(1, parseInt(qty, 10) || 1);
    const updated = cart.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity: parsed };
      }
      return item;
    });
    setCart(updated);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Voice: remove by spoken name (fuzzy match)
  const removeFromCartByName = (nameQuery) => {
    const q = nameQuery.toLowerCase();
    const matched = cart.find(item =>
      item.name.toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q)
    );
    if (matched) removeFromCart(matched.product_id);
  };

  // Voice: add with explicit quantity
  const addToCartWithQty = (product, qty = 1) => {
    const existingIndex = cart.findIndex(it => it.product_id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity = Math.min(
        updated[existingIndex].quantity + qty,
        product.stock_quantity
      );
      setCart(updated);
    } else {
      setCart(prev => [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit_price: Number(product.selling_price) || 0,
          quantity: Math.min(qty, product.stock_quantity),
          image_url: product.image_url,
          unit: product.unit || 'Units',
          maxStock: product.stock_quantity
        }
      ]);
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discountAmt = discountType === 'percent' 
    ? Math.round((subtotal * (Number(discountValue) || 0)) / 100)
    : Number(discountValue) || 0;
  
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmt = Math.round(taxable * taxRate);
  const grandTotal = taxable + taxAmt;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Complete Checkout / Sale
  const handleCheckout = async (e) => {
    e?.preventDefault();
    if (cart.length === 0) {
      alert('Cart is empty. Please add items from the catalog first.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        })),
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        tax_rate: taxRate,
        total_amount: grandTotal,
        payment_method: paymentMethod,
        payment_status: checkoutStatus,
        cashier_id: user?.id,
        cashier_name: user?.name || 'Staff'
      };

      const res = await api.post('/invoices', payload);
      const created = res.data?.invoice || {
        ...payload,
        id: `inv_${Date.now()}`,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        created_at: new Date().toISOString()
      };

      setSaleSuccess(created);
      clearCart();
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      fetchData();
    } catch (err) {
      console.error('Invoice creation error:', err);
      alert(err.response?.data?.message || 'Error processing sale in database');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // Filter Catalog
  const filteredCatalog = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          p.sku?.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

  // Filter Past Invoices
  const filteredInvoices = invoices.filter(inv => {
    // 1. Text Search Filter
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      (inv.customer_phone && inv.customer_phone.includes(q)) ||
      (inv.items || []).some(it => it.product_name?.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // 2. Time / Date Filter
    const invDateStr = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '');
    const invDate = invDateStr ? new Date(invDateStr) : null;
    const now = new Date();

    if (filterPeriod === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      if (invDateStr !== todayStr) return false;
    } else if (filterPeriod === '7d') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      if (invDate && invDate < sevenDaysAgo) return false;
    } else if (filterPeriod === '30d') {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      if (invDate && invDate < thirtyDaysAgo) return false;
    } else if (filterPeriod === 'custom') {
      if (filterStartDate && invDateStr < filterStartDate) return false;
      if (filterEndDate && invDateStr > filterEndDate) return false;
    }

    // 3. Amount Range Filter
    const amt = Number(inv.total_amount || 0);
    if (filterAmountRange === '0-1000' && amt > 1000) return false;
    if (filterAmountRange === '1000-5000' && (amt < 1000 || amt > 5000)) return false;
    if (filterAmountRange === '5000-15000' && (amt < 5000 || amt > 15000)) return false;
    if (filterAmountRange === '15000+' && amt < 15000) return false;
    if (filterAmountRange === 'custom') {
      if (customMinAmount !== '' && amt < Number(customMinAmount)) return false;
      if (customMaxAmount !== '' && amt > Number(customMaxAmount)) return false;
    }

    // 4. Day Pattern Filter (Sundays, Festivals, Workdays, Saturdays)
    if (filterDayPattern !== 'all') {
      const meta = getInvoiceDayMeta(inv);
      if (filterDayPattern === 'sundays' && !meta.isSunday) return false;
      if (filterDayPattern === 'festivals' && !meta.isFestive) return false;
      if (filterDayPattern === 'workdays' && !meta.isWorkday) return false;
      if (filterDayPattern === 'saturdays' && !meta.isSaturday) return false;
    }

    // 5. Status Filter
    const status = (inv.payment_status || 'PAID').toUpperCase();
    if (filterStatus === 'PAID' && status !== 'PAID') return false;
    if (filterStatus === 'PENDING' && status !== 'PENDING') return false;

    // 6. Payment Method Filter
    if (filterPaymentMethod !== 'all' && inv.payment_method !== filterPaymentMethod) return false;

    return true;
  });

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterPeriod('all');
    setFilterDayPattern('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterAmountRange('all');
    setCustomMinAmount('');
    setCustomMaxAmount('');
    setFilterStatus('all');
    setFilterPaymentMethod('all');
  };

  const isFilterActive = 
    searchTerm !== '' ||
    filterPeriod !== 'all' ||
    filterDayPattern !== 'all' ||
    filterAmountRange !== 'all' ||
    filterStatus !== 'all' ||
    filterPaymentMethod !== 'all' ||
    customMinAmount !== '' ||
    customMaxAmount !== '' ||
    filterStartDate !== '' ||
    filterEndDate !== '';

  const filteredTotalRevenue = filteredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const filteredPaidCount = filteredInvoices.filter(i => (i.payment_status || '').toUpperCase() === 'PAID').length;
  const filteredPendingCount = filteredInvoices.filter(i => (i.payment_status || '').toUpperCase() === 'PENDING').length;
  const filteredPendingAmt = filteredInvoices.filter(i => (i.payment_status || '').toUpperCase() === 'PENDING').reduce((s, i) => s + Number(i.total_amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            POS Terminal & Invoice Billing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lightning-fast POS point-of-sale checkout with live inventory deduction and thermal receipt generation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Main Navigation Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'pos'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>POS Terminal</span>
              {totalItemsCount > 0 && (
                <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {totalItemsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Invoice History</span>
              <span className="text-[10px] text-slate-400 font-mono">({invoices.length})</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. DUAL-PANEL POS BILLING TERMINAL & LIVE CART */}
      {/* ======================================================== */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Visual Product Catalog (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Category Pills */}
            <div className="glass-panel p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Quick scan or search product name, SKU, barcode..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-all font-medium"
                  />
                </div>
                {/* Voice POS Button */}
                <VoicePOSButton
                  products={products}
                  onAddProduct={addToCartWithQty}
                  onRemoveProduct={removeFromCartByName}
                  onClearCart={clearCart}
                  onSetSearch={setCatalogSearch}
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                    selectedCategory === ''
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  All ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter(p => p.category_id === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Voice Command Hints */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-[10px] text-slate-400 dark:text-slate-500 pb-0.5">
                <span className="shrink-0 font-bold text-violet-500 dark:text-violet-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H2c0 4.97 3.67 9.1 8.5 9.83V22h3v-3.17c4.83-.73 8.5-4.86 8.5-9.83h-2c0 4.08-3.06 7.44-7 7.93z"/></svg>
                  Say:
                </span>
                {['"add 3 rice"', '"add milk"', '"remove sugar"', '"clear cart"', '"search basmati"'].map(cmd => (
                  <span key={cmd} className="shrink-0 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-mono border border-slate-200 dark:border-slate-700">{cmd}</span>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredCatalog.map((prod) => {
                const cartItem = cart.find(it => it.product_id === prod.id);
                const isOutOfStock = prod.stock_quantity === 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && addToCart(prod)}
                    className={`group relative glass-panel rounded-2xl border p-3 bg-white dark:bg-slate-900/60 flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                      cartItem
                        ? 'border-brand-500 shadow-md shadow-brand-500/10 ring-2 ring-brand-500/20'
                        : isOutOfStock
                        ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-800'
                        : 'border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Active In-Cart Indicator */}
                    {cartItem && (
                      <div className="absolute top-2 right-2 z-10 bg-brand-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
                        <Check className="w-3 h-3" />
                        <span>x{cartItem.quantity}</span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
                        <img
                          src={prod.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300';
                          }}
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-rose-300 text-xs font-bold uppercase">
                            Out of Stock
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] font-mono text-slate-400">{prod.sku}</div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {prod.name}
                        </h4>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono">
                          {formatCurrency(prod.selling_price)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Stock: {prod.stock_quantity}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOutOfStock) addToCart(prod);
                        }}
                        className={`p-1.5 rounded-xl transition-all ${
                          cartItem
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 hover:bg-brand-600 hover:text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL: Live Interactive Cart & Checkout (5 Cols) */}
          <div className="lg:col-span-5 glass-panel rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xl overflow-hidden flex flex-col justify-between sticky top-6">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Active POS Cart
                </h3>
                <span className="bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalItemsCount} items
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Cart</span>
                </button>
              )}
            </div>

            {/* Customer Details Form */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer Information
                </label>
                {customers.length > 0 && (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Quick Select Registered Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Customer Name (or Walk-in)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Mobile / WhatsApp"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-4 flex-1 max-h-[300px] overflow-y-auto space-y-2.5">
              {cart.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Your Cart is Empty</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Click on any product in the left catalog to start billing.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div 
                    key={item.product_id} 
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={item.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100'}
                        alt={item.name}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatCurrency(item.unit_price)} / {item.unit}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-0.5">
                      <button
                        onClick={() => updateQuantity(item.product_id, -1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Item Total & Remove */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-[10px] text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary & Payment Section */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-3">
                {/* Discount & Tax Row */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] font-semibold text-slate-500">Discount:</span>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                      className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setDiscountType(discountType === 'flat' ? 'percent' : 'flat')}
                      className="px-1.5 py-1 bg-slate-200 dark:bg-slate-800 rounded-md font-mono text-[10px] font-bold"
                    >
                      {discountType === 'flat' ? '₹' : '%'}
                    </button>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    GST (5%): <strong className="text-slate-900 dark:text-white">{formatCurrency(taxAmt)}</strong>
                  </div>
                </div>

                {/* Subtotal & Total Display */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white space-y-2 shadow-lg">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatCurrency(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between pt-2 border-t border-white/10">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-200">Grand Total:</span>
                    <span className="text-2xl font-black font-mono text-white tracking-tight text-emerald-400">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                      { id: 'Cash', label: 'Cash', icon: Banknote },
                      { id: 'Card', label: 'Card', icon: CreditCard },
                      { id: 'NetBanking', label: 'NetBank', icon: Building }
                    ].map(pm => {
                      const Icon = pm.icon;
                      const isSelected = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all ${
                            isSelected
                              ? 'bg-brand-600 text-white border-brand-500 shadow-sm ring-2 ring-brand-500/20'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 mb-0.5" />
                          <span>{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>


                {/* Payment Status Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Payment Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCheckoutStatus('PAID')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                        checkoutStatus === 'PAID'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Paid Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutStatus('PENDING')}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                        checkoutStatus === 'PENDING'
                          ? 'bg-amber-500 text-white border-amber-400 shadow-sm ring-2 ring-amber-500/20'
                          : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 hover:bg-amber-50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Pending / Credit
                    </button>
                  </div>
                </div>

                {/* Submit / Checkout Button */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCheckout}
                  className={`w-full py-3 rounded-2xl text-white text-xs font-extrabold uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] ${
                    checkoutStatus === 'PAID'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30'
                  }`}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>{checkoutStatus === 'PAID' ? 'Complete Sale' : 'Save as Pending'} ({formatCurrency(grandTotal)})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 2. INVOICE HISTORY & AUDIT TAB */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Main Filter & Search Toolbar */}
          <div className="glass-panel p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            {/* Row 1: Search Bar + Payment Status + Payment Method + Reset */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice number, customer name, phone, item name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-medium transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold shrink-0">
                {[
                  { id: 'all', label: 'All Status' },
                  { id: 'PAID', label: '✓ Paid' },
                  { id: 'PENDING', label: '⏳ Pending' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setFilterStatus(st.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      filterStatus === st.id
                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Payment Method Filter */}
              <div className="shrink-0">
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Methods</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="NetBanking">Net Banking</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {isFilterActive && (
                <button
                  onClick={resetAllFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 text-xs font-bold hover:bg-rose-100 transition-colors shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Row 2: Time Filter Pills & Amount Range Selector */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              {/* Time Period Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  <span>Time:</span>
                </span>
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                  { id: 'custom', label: 'Custom Date' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFilterPeriod(p.id)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                      filterPeriod === p.id
                        ? 'bg-brand-600 text-white shadow-sm font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Amount Range Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Amount:</span>
                </span>
                {[
                  { id: 'all', label: 'All' },
                  { id: '0-1000', label: '< ₹1k' },
                  { id: '1000-5000', label: '₹1k - ₹5k' },
                  { id: '5000-15000', label: '₹5k - ₹15k' },
                  { id: '15000+', label: '> ₹15k' },
                  { id: 'custom', label: 'Custom' }
                ].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setFilterAmountRange(a.id)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                      filterAmountRange === a.id
                        ? 'bg-emerald-600 text-white shadow-sm font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 3: Footfall Pattern Filter Pills (Sundays, Festivals, Workdays) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Store Footfall Pattern:</span>
              </span>
              {[
                { id: 'all', label: 'All Days' },
                { id: 'sundays', label: '🌟 Sundays (Peak Restock)' },
                { id: 'festivals', label: '🎉 Festivals & Holidays' },
                { id: 'saturdays', label: '🛒 Saturdays (Weekend)' },
                { id: 'workdays', label: '🏢 Workdays (Tue-Thu Lulls)' }
              ].map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => setFilterDayPattern(pat.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                    filterDayPattern === pat.id
                      ? 'bg-amber-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pat.label}
                </button>
              ))}
            </div>

            {/* Row 3: Custom Date / Amount Inputs (Conditionally Rendered) */}
            {(filterPeriod === 'custom' || filterAmountRange === 'custom') && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-fade-in">
                {filterPeriod === 'custom' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {filterAmountRange === 'custom' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={customMinAmount}
                        onChange={(e) => setCustomMinAmount(e.target.value)}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="50000"
                        value={customMaxAmount}
                        onChange={(e) => setCustomMaxAmount(e.target.value)}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Filter Result KPI Stat Badges */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <span>
                  Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredInvoices.length}</strong> of {invoices.length} Invoices
                </span>
                <span>•</span>
                <span>
                  Total Filtered Revenue: <strong className="text-brand-600 dark:text-brand-400 font-bold font-mono">{formatCurrency(filteredTotalRevenue)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 font-semibold">
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[11px]">
                  ✓ {filteredPaidCount} Paid
                </span>
                {filteredPendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[11px]">
                    ⏳ {filteredPendingCount} Pending ({formatCurrency(filteredPendingAmt)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Invoice</th>
                    <th className="py-3 px-4 font-bold">Customer</th>
                    <th className="py-3 px-4 font-bold">Date</th>
                    <th className="py-3 px-4 font-bold">Payment</th>
                    <th className="py-3 px-4 text-center font-bold">Status</th>
                    <th className="py-3 px-4 text-right font-bold">Amount</th>
                    <th className="py-3 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                    {filteredInvoices.map((inv) => {
                      const isPaid = (inv.payment_status || '').toUpperCase() === 'PAID';
                      const isUpdating = updatingStatus === inv.id;
                      const custEmail = inv.customer_email || customers.find(c => c.id === inv.customer_id)?.email || '';
                      const dayMeta = getInvoiceDayMeta(inv);
                      const mailSubject = encodeURIComponent(`Invoice ${inv.invoice_number} from DWDM Store`);
                      const mailBody = encodeURIComponent(`Dear ${inv.customer_name},\n\nPlease find your invoice details below:\nInvoice: ${inv.invoice_number}\nDate: ${inv.date}\nAmount: ₹${inv.total_amount}\nPayment: ${inv.payment_method}\nStatus: ${inv.payment_status || 'Paid'}\n\nThank you for shopping with DWDM Merchant Store!`);
                      return (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400 text-[11px]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white text-[12px]">{inv.customer_name}</div>
                          {inv.customer_phone && <div className="text-[10px] text-slate-400 font-mono">{inv.customer_phone}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                              {inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '')}
                            </span>
                            {dayMeta.badge && (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${dayMeta.badge.bg}`} title={inv.notes || dayMeta.dayName}>
                                {dayMeta.badge.text}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {dayMeta.dayName} {inv.time ? `• ${inv.time}` : ''}
                          </div>
                        </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        {inv.payment_method || 'Cash'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => updateInvoiceStatus(inv, isPaid ? 'PENDING' : 'PAID')}
                          disabled={isUpdating}
                          title={`Click to mark as ${isPaid ? 'Unpaid' : 'Paid'}`}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all hover:scale-105 active:scale-95 ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100'
                              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          {isUpdating ? '...' : (isPaid ? '✓ PAID' : '⏳ PENDING')}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <button onClick={() => setSelectedInvoice(inv)}
                            title="View / Print Bill"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-slate-600 dark:text-slate-400 hover:text-brand-600 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Print */}
                          <button onClick={() => { setSelectedInvoice(inv); setTimeout(() => window.print(), 400); }}
                            title="Download / Print"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-colors">
                            <DownloadCloud className="w-3.5 h-3.5" />
                          </button>
                          {/* Mail */}
                          {custEmail ? (
                            <a href={`mailto:${custEmail}?subject=${mailSubject}&body=${mailBody}`}
                              title="Email invoice to customer"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/50 text-slate-600 dark:text-slate-400 hover:text-violet-600 transition-colors">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span title="No email for customer" className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                              <Mail className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. THERMAL / TAX INVOICE MODAL PREVIEW (PORTALIZED) */}
      {/* ======================================================== */}
      {(selectedInvoice || saleSuccess) && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => { setSelectedInvoice(null); setSaleSuccess(null); }} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Tax Invoice Receipt</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{(selectedInvoice || saleSuccess)?.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedInvoice(null); setSaleSuccess(null); }}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-3">
                <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 space-y-0.5">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                    Smart Merchant Enterprise
                  </h4>
                  <p className="text-[10px] text-slate-500">Retail & Wholesale POS Bill</p>
                  <p className="text-[10px] text-slate-400">
                    Date: {new Date((selectedInvoice || saleSuccess)?.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <div>Customer: <strong>{(selectedInvoice || saleSuccess)?.customer_name}</strong></div>
                  {(selectedInvoice || saleSuccess)?.customer_phone && (
                    <div>Phone: {(selectedInvoice || saleSuccess)?.customer_phone}</div>
                  )}
                  <div>Payment: {(selectedInvoice || saleSuccess)?.payment_method || 'UPI'} • Paid</div>
                </div>

                <div className="border-t border-b border-dashed border-slate-300 dark:border-slate-700 py-2 space-y-1.5">
                  <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500">
                    <span>Item</span>
                    <span>Amount</span>
                  </div>
                  {((selectedInvoice || saleSuccess)?.items || []).map((itm, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="truncate pr-2">{itm.product_name || 'Item'} x {itm.quantity}</span>
                      <span className="font-bold">{formatCurrency(itm.total_price || (itm.quantity * itm.unit_price))}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{formatCurrency((selectedInvoice || saleSuccess)?.subtotal || (selectedInvoice || saleSuccess)?.total_amount)}</span>
                  </div>
                  {(selectedInvoice || saleSuccess)?.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-{formatCurrency((selectedInvoice || saleSuccess)?.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>GST (5%):</span>
                    <span>{formatCurrency((selectedInvoice || saleSuccess)?.tax || 0)}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-1 border-t border-slate-300 dark:border-slate-700">
                    <span>Total Paid:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency((selectedInvoice || saleSuccess)?.total_amount)}
                    </span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-dashed border-slate-300 dark:border-slate-700">
                  *** Thank You for Shopping With Us! ***
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill Receipt</span>
              </button>
              <button
                onClick={() => { setSelectedInvoice(null); setSaleSuccess(null); }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
