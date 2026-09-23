import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Receipt, 
  Sparkles, 
  ShieldCheck, 
  Database, 
  Save, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  Moon, 
  Sun, 
  BellRing, 
  Sliders, 
  Info,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Active Settings Section Tab
  const [activeSection, setActiveSection] = useState('store'); // 'store' | 'billing' | 'ai' | 'display' | 'database'

  // Store Profile State
  const [storeName, setStoreName] = useState(user?.business_name || 'Smart Merchant Store');
  const [ownerName, setOwnerName] = useState(user?.name || 'Rajesh Sharma');
  const [storePhone, setStorePhone] = useState(user?.phone || '+91 98765 43210');
  const [storeEmail, setStoreEmail] = useState(user?.email || 'rajesh.sharma@example.com');
  const [gstin, setGstin] = useState('29ABCDE1234F1Z5');
  const [storeAddress, setStoreAddress] = useState('142 Commercial Street, Indiranagar, Bengaluru, KA - 560038');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Billing & POS Settings State
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [defaultTaxRate, setDefaultTaxRate] = useState('5');
  const [receiptFooterNote, setReceiptFooterNote] = useState('Thank you for shopping with us! Please visit again.');
  const [receiptWidth, setReceiptWidth] = useState('80mm');
  const [enableUpiQr, setEnableUpiQr] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

  // AI & Forecasting Settings
  const [forecastHorizon, setForecastHorizon] = useState('14');
  const [lowStockThreshold, setLowStockThreshold] = useState('15');
  const [anomalySensitivity, setAnomalySensitivity] = useState('balanced');
  const [enableRestockSuggestions, setEnableRestockSuggestions] = useState(true);

  // Display & Sound Preferences
  const [soundEffects, setSoundEffects] = useState(true);
  const [compactTable, setCompactTable] = useState(false);

  // Database Stats State
  const [dbStats, setDbStats] = useState({
    invoicesCount: 0,
    productsCount: 0,
    customersCount: 0,
    expensesCount: 0,
    suppliersCount: 0
  });
  const [dbLoading, setDbLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved preferences from localStorage if present
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('sm_merchant_settings');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.storeName) setStoreName(parsed.storeName);
        if (parsed.gstin) setGstin(parsed.gstin);
        if (parsed.storeAddress) setStoreAddress(parsed.storeAddress);
        if (parsed.invoicePrefix) setInvoicePrefix(parsed.invoicePrefix);
        if (parsed.defaultTaxRate) setDefaultTaxRate(parsed.defaultTaxRate);
        if (parsed.receiptFooterNote) setReceiptFooterNote(parsed.receiptFooterNote);
        if (parsed.receiptWidth) setReceiptWidth(parsed.receiptWidth);
        if (parsed.enableUpiQr !== undefined) setEnableUpiQr(parsed.enableUpiQr);
        if (parsed.autoPrintReceipt !== undefined) setAutoPrintReceipt(parsed.autoPrintReceipt);
        if (parsed.forecastHorizon) setForecastHorizon(parsed.forecastHorizon);
        if (parsed.lowStockThreshold) setLowStockThreshold(parsed.lowStockThreshold);
        if (parsed.anomalySensitivity) setAnomalySensitivity(parsed.anomalySensitivity);
        if (parsed.soundEffects !== undefined) setSoundEffects(parsed.soundEffects);
        if (parsed.compactTable !== undefined) setCompactTable(parsed.compactTable);
      }
    } catch (e) {
      console.warn('Error loading cached settings:', e);
    }
  }, []);

  // Fetch live counts for database section
  const fetchDbMetrics = async () => {
    setDbLoading(true);
    try {
      const [invRes, prodRes, custRes, expRes, supRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/products'),
        api.get('/customers'),
        api.get('/expenses'),
        api.get('/suppliers')
      ]);

      setDbStats({
        invoicesCount: invRes.data?.invoices?.length || 0,
        productsCount: prodRes.data?.products?.length || 0,
        customersCount: custRes.data?.customers?.length || 0,
        expensesCount: expRes.data?.expenses?.length || 0,
        suppliersCount: supRes.data?.suppliers?.length || 0
      });
    } catch (err) {
      console.error('Error fetching db stats:', err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchDbMetrics();
  }, []);

  const handleSaveAllSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const settingsPayload = {
        storeName,
        ownerName,
        storePhone,
        storeEmail,
        gstin,
        storeAddress,
        currencySymbol,
        invoicePrefix,
        defaultTaxRate,
        receiptFooterNote,
        receiptWidth,
        enableUpiQr,
        autoPrintReceipt,
        forecastHorizon,
        lowStockThreshold,
        anomalySensitivity,
        enableRestockSuggestions,
        soundEffects,
        compactTable
      };

      // Persist in localStorage
      localStorage.setItem('sm_merchant_settings', JSON.stringify(settingsPayload));

      // Also update Auth profile if name or business name changed
      if (updateProfile && (storeName !== user?.business_name || ownerName !== user?.name)) {
        await updateProfile({
          name: ownerName,
          phone: storePhone,
          business_name: storeName
        }).catch(() => {});
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export full JSON database backup
  const handleExportFullBackup = async () => {
    try {
      const [invRes, prodRes, custRes, expRes, supRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/products'),
        api.get('/customers'),
        api.get('/expenses'),
        api.get('/suppliers')
      ]);

      const backupData = {
        meta: {
          store_id: user?.store_id || 'store_dwdm_001',
          exported_at: new Date().toISOString(),
          version: '1.4.0',
          exported_by: user?.name || 'Admin'
        },
        invoices: invRes.data?.invoices || [],
        products: prodRes.data?.products || [],
        customers: custRes.data?.customers || [],
        expenses: expRes.data?.expenses || [],
        suppliers: supRes.data?.suppliers || []
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `SmartMerchant_DB_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Backup export failed:', err);
      alert('Failed to generate full database backup.');
    }
  };

  const navSections = [
    { id: 'store', label: 'Store & Profile', icon: Store, desc: 'Store identity, address & GSTIN' },
    { id: 'billing', label: 'Billing & POS', icon: Receipt, desc: 'Invoice format, taxes & receipt print' },
    { id: 'ai', label: 'AI & Forecasting', icon: Sparkles, desc: 'Predictions & stockout alert thresholds' },
    { id: 'display', label: 'Display & Theme', icon: isDark ? Moon : Sun, desc: 'Theme colors & interface density' },
    { id: 'database', label: 'Data & Backup', icon: Database, desc: 'Local database backup & records' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              <Settings className="w-6 h-6" />
            </div>
            <span>Store Configuration & Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your store business profile, billing POS parameters, AI engine sensitivities, and database backups.
          </p>
        </div>

        <button
          onClick={handleSaveAllSettings}
          disabled={isSaving}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
          <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-semibold shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Settings saved successfully! Preferences are updated across your point-of-sale terminal.</span>
        </div>
      )}

      {/* Main Settings Grid: Navigation Sidebar (4 cols) + Configuration Pane (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Settings Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <div className="glass-panel p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-1">
            {navSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-start space-x-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 shadow-xs font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{sec.label}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{sec.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Store Quick Info Badge */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              <span>Smart Merchant Enterprise</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Store Instance ID: <code className="font-mono text-brand-600 dark:text-brand-400">{user?.store_id || 'store_dwdm_001'}</code>
            </p>
            <p className="text-[11px] text-slate-400">
              Role: <strong className="text-slate-700 dark:text-slate-200">{user?.role || 'Administrator'}</strong>
            </p>
          </div>
        </div>

        {/* Configuration Pane */}
        <div className="lg:col-span-8">
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            
            {/* 1. STORE & PROFILE TAB */}
            {activeSection === 'store' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Store Identity & Business Profile</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">These details appear on your customer receipts and tax invoices.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Store / Business Name *</label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Merchant / Owner Name</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Store Phone Number</label>
                    <input
                      type="text"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Store Email Address</label>
                    <input
                      type="email"
                      value={storeEmail}
                      onChange={(e) => setStoreEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">GSTIN / Tax Registration Number</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Currency Symbol</label>
                    <select
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    >
                      <option value="₹">₹ (Indian Rupee - INR)</option>
                      <option value="$">$ (US Dollar - USD)</option>
                      <option value="€">€ (Euro - EUR)</option>
                      <option value="£">£ (British Pound - GBP)</option>
                      <option value="AED">AED (UAE Dirham)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Physical Store Address</label>
                  <textarea
                    rows={2}
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* 2. BILLING & POS TAB */}
            {activeSection === 'billing' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Point of Sale & Billing Parameters</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Configure thermal receipt layouts, automated tax rates, and bill numbering.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Invoice Number Prefix</label>
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Example: {invoicePrefix}202609-001</span>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Default GST / Tax Rate (%)</label>
                    <select
                      value={defaultTaxRate}
                      onChange={(e) => setDefaultTaxRate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    >
                      <option value="0">0% (Tax Exempt / Essential)</option>
                      <option value="5">5% (Standard Groceries GST)</option>
                      <option value="12">12% (Processed Goods GST)</option>
                      <option value="18">18% (Consumer Goods GST)</option>
                      <option value="28">28% (Luxury / Aerated GST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Thermal Receipt Print Width</label>
                    <div className="flex gap-3 mt-1">
                      {['58mm (Compact 2-inch)', '80mm (Standard 3-inch)'].map(w => {
                        const val = w.split(' ')[0];
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setReceiptWidth(val)}
                            className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              receiptWidth === val
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
                                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {w}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">UPI Payment QR Code on Bill</label>
                    <label className="flex items-center space-x-2.5 mt-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableUpiQr}
                        onChange={(e) => setEnableUpiQr(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Print Dynamic UPI QR on Receipts</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Receipt Footer Note / Greeting</label>
                  <input
                    type="text"
                    value={receiptFooterNote}
                    onChange={(e) => setReceiptFooterNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* 3. AI & FORECASTING TAB */}
            {activeSection === 'ai' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">AI Forecasting & Machine Learning Intelligence</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Choose the default forecast horizon and the stockout warning level used across the forecasting screens.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Default Demand Forecast Horizon</label>
                    <select
                      value={forecastHorizon}
                      onChange={(e) => setForecastHorizon(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    >
                      <option value="7">7 Days (Weekly Demand Forecast)</option>
                      <option value="14">14 Days (Bi-Weekly Horizon)</option>
                      <option value="30">30 Days (Monthly Outlook)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Minimum Stock Floor (Units)</label>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      No reorder point is allowed to fall below this many units, on top of
                      each product's own minimum stock level. A store-wide floor for lines
                      you never want to run out of.
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Expense Anomaly Detection Sensitivity</label>
                    <select
                      value={anomalySensitivity}
                      onChange={(e) => setAnomalySensitivity(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                    >
                      <option value="low">Low — flags beyond 4.5 robust deviations</option>
                      <option value="balanced">Balanced — flags beyond 3.5 (recommended)</option>
                      <option value="high">High — flags beyond 2.0 (strict)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      A charge is flagged when it sits further than this many robust
                      deviations from its own category median. Lower means more alerts.
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider block mb-1">Automatic Reorder Suggestions</label>
                    <label className="flex items-center space-x-2.5 mt-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableRestockSuggestions}
                        onChange={(e) => setEnableRestockSuggestions(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Auto-generate Purchase PO Quantities</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DISPLAY & THEME TAB */}
            {activeSection === 'display' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Interface & Display Preferences</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Customize theme, color palette, and audio feedback on your terminal.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                    <span className="font-bold text-slate-900 dark:text-white block">Theme Mode</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { if (isDark) toggleTheme(); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          !isDark ? 'bg-white border-brand-500 text-brand-600 shadow-xs' : 'border-slate-300 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Light Mode</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (!isDark) toggleTheme(); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          isDark ? 'bg-slate-800 border-brand-500 text-brand-400 shadow-xs' : 'border-slate-300 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Dark Mode</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                    <span className="font-bold text-slate-900 dark:text-white block">Audio & Sounds</span>
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEffects}
                        onChange={(e) => setSoundEffects(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Play Beep on POS barcode scan & invoice bill creation</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DATABASE & BACKUP TAB */}
            {activeSection === 'database' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Database Management & Local Backups</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Monitor local database storage health and export full JSON backups.</p>
                  </div>
                  <button
                    onClick={fetchDbMetrics}
                    disabled={dbLoading}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin text-brand-600' : ''}`} />
                  </button>
                </div>

                {/* DB Counts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Invoices Logged</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">{dbStats.invoicesCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Active Products (SKUs)</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">{dbStats.productsCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Customers</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">{dbStats.customersCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Expense Records</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">{dbStats.expensesCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Active Suppliers</span>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">{dbStats.suppliersCount}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Storage Engine</span>
                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mt-1">JSON / PostgreSQL</div>
                  </div>
                </div>

                {/* Direct Backup Action */}
                <div className="p-5 rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/40 dark:bg-brand-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Download Complete Database Snapshot</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Exports all products, invoices, customer khata balances, and expense records into a standard JSON file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/25 flex items-center gap-2 shrink-0 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Changes take effect immediately across all terminal tabs.</span>
              <button
                type="button"
                onClick={handleSaveAllSettings}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
