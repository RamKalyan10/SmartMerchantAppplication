import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  PieChart as PieIcon, 
  ArrowUpRight, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  X, 
  Layers, 
  Package, 
  Wallet, 
  Receipt,
  FileText,
  ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();

  // Period / Horizon Filter State
  const [period, setPeriod] = useState('30'); // '7' | '14' | '30' | '90' | 'all' | 'custom'
  const [customRange, setCustomRange] = useState({
    startDate: '2026-08-15',
    endDate: '2026-09-16'
  });
  const [showCustomRangePicker, setShowCustomRangePicker] = useState(false);

  // Data States
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Report Modal / Dropdown State
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');

  const printReportRef = useRef(null);

  const getQueryParams = () => {
    if (period === 'custom') {
      return `start_date=${customRange.startDate}&end_date=${customRange.endDate}`;
    }
    return `period=${period}`;
  };

  const getPeriodLabel = () => {
    if (period === '7') return 'Last 7 Days';
    if (period === '14') return 'Last 14 Days';
    if (period === '30') return 'Last 30 Days';
    if (period === '90') return 'Last 90 Days';
    if (period === 'all') return 'All Time / Overall';
    if (period === 'custom') return `${customRange.startDate} to ${customRange.endDate}`;
    return `Period (${period} Days)`;
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const q = getQueryParams();
      const [overRes, timeRes, prodRes, catRes] = await Promise.all([
        api.get(`/analytics/overview?${q}`),
        api.get(`/analytics/sales-timeline?${q}`),
        api.get(`/analytics/top-products?${q}`),
        api.get(`/analytics/categories?${q}`)
      ]);

      setOverview(overRes.data?.kpis || null);
      setTimeline(timeRes.data?.timeline || []);
      setTopProducts(prodRes.data?.topProducts || []);
      setCategories(catRes.data?.category_breakdown || []);
    } catch (err) {
      console.error('Error fetching analytics from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, customRange.startDate, customRange.endDate]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const periodRevenue = Number(overview?.period_revenue ?? timeline.reduce((s, t) => s + Number(t.revenue || 0), 0));
  const periodExpense = Number(overview?.period_expense ?? timeline.reduce((s, t) => s + Number(t.expense || 0), 0));
  const periodCogs = Number(overview?.period_cogs ?? timeline.reduce((s, t) => s + Number(t.cogs || 0), 0));
  const periodGrossProfit = Number(overview?.period_gross_profit ?? (periodRevenue - periodCogs));
  const periodNetProfit = Number(overview?.period_net_profit ?? (periodGrossProfit - periodExpense));
  const profitMargin = periodRevenue > 0 ? ((periodNetProfit / periodRevenue) * 100).toFixed(1) : 0;
  const invoiceCount = Number(overview?.period_invoices ?? timeline.reduce((s, t) => s + Number(t.orders || 0), 0));

  // CSV Report Generator
  const handleDownloadCSV = () => {
    setExportDropdownOpen(false);
    try {
      const periodLabel = getPeriodLabel();
      let csv = `SMART MERCHANT - SALES & PROFIT REPORT\n`;
      csv += `Store: ${user?.business_name || 'Smart Merchant Store'}\n`;
      csv += `Generated On: ${new Date().toLocaleString()}\n`;
      csv += `Reporting Horizon: ${periodLabel}\n\n`;

      csv += `EXECUTIVE SUMMARY\n`;
      csv += `Metric,Value\n`;
      csv += `Total Revenue,₹${periodRevenue.toFixed(2)}\n`;
      csv += `Cost of Goods Sold (COGS),₹${periodCogs.toFixed(2)}\n`;
      csv += `Gross Profit,₹${periodGrossProfit.toFixed(2)}\n`;
      csv += `Total Operating Expenses,₹${periodExpense.toFixed(2)}\n`;
      csv += `Net Business Profit,₹${periodNetProfit.toFixed(2)}\n`;
      csv += `Net Profit Margin,${profitMargin}%\n`;
      csv += `Total Invoices / Orders,${invoiceCount}\n\n`;

      csv += `DAILY TRANSACTION TIMELINE\n`;
      csv += `Date,Revenue (INR),COGS (INR),Expenses (INR),Net Profit (INR),Orders\n`;
      timeline.forEach(row => {
        csv += `${row.date},${Number(row.revenue || 0).toFixed(2)},${Number(row.cogs || 0).toFixed(2)},${Number(row.expense || 0).toFixed(2)},${Number(row.profit ?? row.net_profit ?? 0).toFixed(2)},${row.orders || 0}\n`;
      });
      csv += `\n`;

      csv += `TOP SELLING PRODUCTS (${periodLabel})\n`;
      csv += `Product Name,Category,Units Sold,Revenue Generated (INR)\n`;
      topProducts.forEach(prod => {
        csv += `"${prod.product_name || 'Product'}","${prod.category_name || 'General'}",${prod.total_units || 0},${Number(prod.total_revenue || 0).toFixed(2)}\n`;
      });
      csv += `\n`;

      csv += `CATEGORY SALES DISTRIBUTION\n`;
      csv += `Category,Revenue (INR),Share (%)\n`;
      categories.forEach(cat => {
        csv += `"${cat.category}",${Number(cat.revenue || 0).toFixed(2)},${cat.share_pct || 0}%\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `SalesReport_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setReportSuccessMsg('CSV Report downloaded successfully!');
      setTimeout(() => setReportSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error generating CSV report:', err);
      alert('Failed to generate CSV report.');
    }
  };

  // Open Printable Executive Report View
  const handleOpenPrintReport = () => {
    setExportDropdownOpen(false);
    setShowPrintModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {reportSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-semibold shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{reportSuccessMsg}</span>
          </div>
          <button onClick={() => setReportSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span>Business Intelligence & Sales Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Database transaction metrics, real profit margins, category market shares, and executive reporting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Sync</span>
          </button>

          {/* Period Selector Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-semibold">
            {[
              { id: '7', label: '7D' },
              { id: '14', label: '14D' },
              { id: '30', label: '30D' },
              { id: '90', label: '90D' },
              { id: 'all', label: 'All' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setPeriod(tab.id);
                  setShowCustomRangePicker(false);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  period === tab.id
                    ? 'bg-brand-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={() => {
                setPeriod('custom');
                setShowCustomRangePicker(!showCustomRangePicker);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                period === 'custom'
                  ? 'bg-brand-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Dates</span>
            </button>
          </div>

          {/* Download Report Action Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-brand-600/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Report</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setExportDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-40 text-xs animate-fade-in space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Export for {getPeriodLabel()}
                  </div>
                  
                  <button
                    onClick={handleDownloadCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold">Export Excel / CSV</div>
                      <div className="text-[10px] text-slate-400">Raw daily metrics & products</div>
                    </div>
                  </button>

                  <button
                    onClick={handleOpenPrintReport}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 shrink-0">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold">Printable PDF Report</div>
                      <div className="text-[10px] text-slate-400">Executive formatted report summary</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker Dropdown */}
      {showCustomRangePicker && (
        <div className="p-4 rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/50 dark:bg-brand-950/30 flex flex-wrap items-center gap-4 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Start Date:</span>
            <input
              type="date"
              value={customRange.startDate}
              onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">End Date:</span>
            <input
              type="date"
              value={customRange.endDate}
              onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={() => {
              setPeriod('custom');
              fetchAnalytics();
            }}
            className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-xs hover:bg-brand-700 transition-colors cursor-pointer"
          >
            Apply Horizon
          </button>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Selected range: <strong className="text-brand-600 dark:text-brand-400">{customRange.startDate}</strong> to <strong className="text-brand-600 dark:text-brand-400">{customRange.endDate}</strong>
          </span>
        </div>
      )}

      {/* Summary KPI Cards (5 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Period Revenue */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Total Sales Revenue</p>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs">₹</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-2">
            {formatCurrency(periodRevenue)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{invoiceCount} invoices</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getPeriodLabel()}</span>
          </p>
        </div>

        {/* Card 2: Cost of Goods Sold */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Cost of Goods (COGS)</p>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold text-xs">📦</span>
          </div>
          <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-2">
            {formatCurrency(periodCogs)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Procurement cost of sold inventory
          </p>
        </div>

        {/* Card 3: Operating Expenses */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Operating Expenses</p>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-xs">💳</span>
          </div>
          <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-2">
            {formatCurrency(periodExpense)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Rent, electricity, salaries & logistics
          </p>
        </div>

        {/* Card 4: Gross Profit */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Gross Profit</p>
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs">📈</span>
          </div>
          <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono mt-2">
            {formatCurrency(periodGrossProfit)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Revenue minus direct product costs
          </p>
        </div>

        {/* Card 5: Net Profit */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900/90 dark:to-emerald-950/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 uppercase font-extrabold tracking-wider">Net Business Profit</p>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
              {profitMargin}% margin
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-2">
            {formatCurrency(periodNetProfit)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Take-home surplus</span>
            <span className="text-[10px] text-slate-400">Post-expenses</span>
          </p>
        </div>
      </div>

      {/* Main Revenue & Net Profit Timeline Chart */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Daily Revenue, Expenses & Net Profit Trend</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical ledger trend breakdown for {getPeriodLabel()}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Revenue
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span> Expenses
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Net Profit
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="anRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="anProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.4} />
              <XAxis dataKey="date" stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={10} tickFormatter={(v) => v ? v.slice(5) : ''} />
              <YAxis stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={10} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                  borderColor: isDark ? '#475569' : '#cbd5e1', 
                  color: isDark ? '#ffffff' : '#0f172a',
                  borderRadius: '12px', 
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                }}
                formatter={(val, name) => [
                  `₹${Number(val).toLocaleString('en-IN')}`, 
                  name === 'revenue' ? 'Sales Revenue' : name === 'expense' ? 'Expenses' : 'Net Profit'
                ]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#anRev)" name="revenue" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#anProfit)" name="profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dual Charts: Top Products Bar Chart + Category Share Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Selling Products */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-500" />
                <span>Top Revenue Generating Products</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sales volume per SKU for {getPeriodLabel()}</p>
            </div>
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Top {topProducts.length} SKUs</span>
          </div>

          <div className="h-64 w-full">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.4} />
                  <XAxis type="number" stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={10} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <YAxis type="category" dataKey="product_name" stroke={isDark ? "#cbd5e1" : "#475569"} fontSize={10} width={130} tickFormatter={(v) => v.length > 16 ? v.slice(0, 16) + '...' : v} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                      borderColor: isDark ? '#475569' : '#cbd5e1', 
                      color: isDark ? '#ffffff' : '#0f172a',
                      borderRadius: '10px', 
                      fontSize: '12px' 
                    }}
                    formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Bar dataKey="total_revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No product transactions found in this period.
              </div>
            )}
          </div>
        </div>

        {/* Category Share Distribution */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-500" />
                <span>Sales Share by Product Category</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Distribution of store turnover ({getPeriodLabel()})</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={48}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                      borderColor: isDark ? '#475569' : '#cbd5e1', 
                      color: isDark ? '#ffffff' : '#0f172a',
                      borderRadius: '10px', 
                      fontSize: '12px' 
                    }}
                    formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No category transactions found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT / PDF EXECUTIVE REPORT MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in text-left">
          <div className="fixed inset-0" onClick={() => setShowPrintModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Executive Sales & Profit Report</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Horizon: {getPeriodLabel()}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Content Body */}
            <div ref={printReportRef} className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 dark:text-slate-200 text-xs">
              {/* Report Header */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {user?.business_name || 'Smart Merchant Store'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official Business Intelligence & Performance Audit
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Store ID: {user?.store_id || 'store_dwdm_001'} • Generated by {user?.name || 'Administrator'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 font-bold text-[11px]">
                    {getPeriodLabel()}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Date: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              {/* KPI Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Sales Revenue</span>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">{formatCurrency(periodRevenue)}</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">COGS Cost</span>
                  <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">{formatCurrency(periodCogs)}</div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Operating Costs</span>
                  <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5">{formatCurrency(periodExpense)}</div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Net Profit</span>
                  <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{formatCurrency(periodNetProfit)}</div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">{profitMargin}% margin</span>
                </div>
              </div>

              {/* Top Products Table */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Top 5 Revenue Generating Products</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2.5">Product SKU / Name</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Units Sold</th>
                        <th className="p-2.5 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                      {topProducts.slice(0, 5).map((prod, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{prod.product_name}</td>
                          <td className="p-2.5 text-slate-500">{prod.category_name}</td>
                          <td className="p-2.5 text-right font-mono font-semibold">{prod.total_units}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-brand-600 dark:text-brand-400">{formatCurrency(prod.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Category Revenue Shares</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Revenue Share</th>
                        <th className="p-2.5 text-right">Turnover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                      {categories.map((cat, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{cat.category}</td>
                          <td className="p-2.5 text-right font-semibold text-slate-500">{cat.share_pct}%</td>
                          <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(cat.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-[10px] text-slate-400 text-center pt-3 border-t border-slate-200 dark:border-slate-800">
                Generated securely from Smart Merchant Database • Valid for business accounting audit
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Save CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
