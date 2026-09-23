import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Sparkles, 
  ArrowRight, 
  Receipt, 
  Package,
  Users,
  Truck,
  Wallet,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  RefreshCw,
  FileText,
  UserPlus,
  Layers,
  ChevronDown,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const EXPENSE_COLORS = {
  'Rent': '#6366F1',
  'Staff Salary': '#3B82F6',
  'Electricity': '#10B981',
  'Transport & Logistics': '#F59E0B',
  'Marketing & Ads': '#EC4899',
  'Maintenance & Repairs': '#8B5CF6',
  'Miscellaneous': '#64748B'
};

const DEFAULT_COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#64748B'];

/**
 * Period-over-period change badge. Renders nothing when the backend could not
 * measure a change — no preceding window, or an empty one — rather than
 * inventing a percentage. `invert` marks metrics where a rise is bad (expenses).
 */
function ChangeBadge({ value, invert = false }) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div
      title="Change vs. the preceding period of equal length"
      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
        good
          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
      }`}
    >
      <Icon className="w-3 h-3" />
      <span>
        {up ? '+' : ''}
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function DashboardPage({ setActiveTab, onOpenNewInvoice }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  
  // Horizon Filter State
  const [filterMode, setFilterMode] = useState('preset'); // 'preset' | 'custom_days' | 'custom_range'
  const [dashboardPeriod, setDashboardPeriod] = useState('30'); // '7' | '14' | '30' | 'all'
  const [customDaysInput, setCustomDaysInput] = useState('14');
  const [customRange, setCustomRange] = useState({
    startDate: '2026-09-01',
    endDate: '2026-09-12'
  });
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
  const [activeTabInModal, setActiveTabInModal] = useState('preset'); // 'preset' | 'days' | 'calendar'
  
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [expensesData, setExpensesData] = useState({ expenses: [], category_breakdown: [], total_expense: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [insights, setInsights] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let queryParam = '';
      if (filterMode === 'preset') {
        queryParam = `period=${dashboardPeriod}`;
      } else if (filterMode === 'custom_days') {
        queryParam = `period=${customDaysInput}&days=${customDaysInput}`;
      } else if (filterMode === 'custom_range') {
        queryParam = `start_date=${customRange.startDate}&end_date=${customRange.endDate}`;
      }

      // `/forecast/insights` reads `days`, not `period`, so the preset filter was
      // silently ignored and the AI insight always covered 7 days whatever the
      // user had selected.
      const insightDays = Number(dashboardPeriod);
      const insightQuery = Number.isFinite(insightDays)
        ? `days=${insightDays}`
        : 'days=30';

      const [overviewRes, timelineRes, expensesRes, invoicesRes, topProdRes, prodRes, insightsRes] = await Promise.all([
        api.get(`/analytics/overview?${queryParam}`),
        api.get(`/analytics/sales-timeline?${queryParam}`),
        api.get(`/expenses?${queryParam}`),
        api.get('/invoices'),
        api.get(`/analytics/top-products?${queryParam}`),
        api.get('/products'),
        // The ML service being down must not blank the whole dashboard. This is
        // the only request that leaves the Node backend, so it fails alone.
        api.get(`/forecast/insights?${insightQuery}`).catch(() => ({ data: null }))
      ]);

      setOverview(overviewRes.data?.kpis || {});
      setTimeline(timelineRes.data?.timeline || []);
      setExpensesData(expensesRes.data || { expenses: [], category_breakdown: [], total_expense: 0 });
      setRecentInvoices((invoicesRes.data?.invoices || []).slice(0, 5));
      setTopProducts((topProdRes.data?.topProducts || []).slice(0, 5));
      
      const allProds = prodRes.data?.products || [];
      // Products with no recorded minimum stock level cannot be judged against
      // a threshold. The previous `min_stock_level || 15` invented one, so a
      // product with no threshold set silently inherited 15 units.
      const lowStock = allProds
        .filter((p) => p.min_stock_level != null)
        .filter((p) => Number(p.stock_quantity || 0) <= Number(p.min_stock_level))
        .slice(0, 5);
      setLowStockProducts(lowStock);
      
      setInsights(insightsRes.data || null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filterMode, dashboardPeriod, customRange.startDate, customRange.endDate]);

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // No invented name: an unnamed account is greeted without one.
  const userName = user?.name ? user.name.split(' ')[0] : null;

  // Calculate timeline summary highlights
  const highestRevenueDay = timeline.length > 0 ? [...timeline].sort((a, b) => b.revenue - a.revenue)[0] : null;
  const highestExpenseDay = timeline.length > 0 ? [...timeline].sort((a, b) => b.expense - a.expense)[0] : null;
  const avgDailyRevenue = timeline.length > 0 ? Math.round(timeline.reduce((s, d) => s + (d.revenue || 0), 0) / timeline.length) : 0;
  const avgDailyExpense = timeline.length > 0 ? Math.round(timeline.reduce((s, d) => s + (d.expense || 0), 0) / timeline.length) : 0;

  // Donut chart data
  const pieData = (expensesData.category_breakdown || []).map((cat, idx) => ({
    name: cat.category,
    value: cat.total,
    share_pct: cat.share_pct,
    color: EXPENSE_COLORS[cat.category] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }));

  // Named from the store's actual categories. The copy used to hardcode "Rent
  // and Staff Salary" with a `76.6` fallback, so a store with neither category
  // still read that sentence.
  const topTwoExpenseShare = (() => {
    const [first, second] = pieData;
    if (!first || !second) return null;
    const pct = Number(first.share_pct) + Number(second.share_pct);
    if (!Number.isFinite(pct)) return null;
    return { names: `${first.name} and ${second.name}`, pct };
  })();

  // Null when the overview has not loaded, so the profitability badge states a
  // fact rather than defaulting to "Profitable".
  const netProfitValue = (() => {
    const raw = overview?.period_net_profit ?? overview?.net_profit;
    return raw == null ? null : Number(raw);
  })();

  const getActiveFilterLabel = () => {
    if (filterMode === 'preset') {
      if (dashboardPeriod === '7') return 'Last 7 Days';
      if (dashboardPeriod === '14') return 'Last 14 Days';
      if (dashboardPeriod === '30') return 'Last 30 Days';
      if (dashboardPeriod === 'all') return 'All Time / Overall';
      return `Last ${dashboardPeriod} Days`;
    }
    if (filterMode === 'custom_days') {
      return `Custom ${customDaysInput} Days`;
    }
    if (filterMode === 'custom_range') {
      return `${customRange.startDate} → ${customRange.endDate}`;
    }
    return 'Last 30 Days';
  };

  const periodLabelText = getActiveFilterLabel();

  const handleSelectPreset = (preset) => {
    setDashboardPeriod(preset);
    setFilterMode('preset');
    setCalendarDropdownOpen(false);
  };

  const handleApplyCustomDays = (days) => {
    const d = days || customDaysInput;
    if (d && Number(d) > 0) {
      setCustomDaysInput(String(d));
      setFilterMode('custom_days');
      setCalendarDropdownOpen(false);
      fetchDashboardData();
    }
  };

  const handleApplyDateRange = () => {
    if (customRange.startDate && customRange.endDate) {
      setFilterMode('custom_range');
      setCalendarDropdownOpen(false);
      fetchDashboardData();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      
      {/* 1. Greeting & Interactive Date Horizon Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-500/25 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{getGreeting()}{userName ? `, ${userName}` : ''}!</span>
              <span>👋</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Here's what's happening with your business today.
            </p>
          </div>
        </div>

        {/* Top-Right Calendar Horizon Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setCalendarDropdownOpen(!calendarDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-brand-500" />
              <span>Today: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-brand-600 dark:text-brand-400 font-bold">{getActiveFilterLabel()}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${calendarDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Interactive Calendar & Custom Horizon Popover Modal */}
            {calendarDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setCalendarDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-88 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-40 text-xs animate-fade-in flex flex-col space-y-3.5">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-600" />
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Filter Time Horizon</h3>
                    </div>
                    <button 
                      onClick={() => setCalendarDropdownOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Filter Sub-Tabs */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTabInModal('preset')}
                      className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTabInModal === 'preset' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                      Presets
                    </button>
                    <button
                      onClick={() => setActiveTabInModal('days')}
                      className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTabInModal === 'days' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                      Custom Days
                    </button>
                    <button
                      onClick={() => setActiveTabInModal('calendar')}
                      className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTabInModal === 'calendar' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                      Date Range
                    </button>
                  </div>

                  {/* Tab 1: Presets (7d, 14d, 30d, Overall) */}
                  {activeTabInModal === 'preset' && (
                    <div className="space-y-2 py-1">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose a standard business reporting period:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: '7', label: '7 Days (7d)', desc: 'Weekly cadence' },
                          { id: '14', label: '14 Days (14d)', desc: 'Bi-weekly cycle' },
                          { id: '30', label: '30 Days (30d)', desc: 'Monthly overview' },
                          { id: 'all', label: 'Overall (All Time)', desc: 'Full business history' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => handleSelectPreset(opt.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${filterMode === 'preset' && dashboardPeriod === opt.id ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-bold' : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-brand-300'}`}
                          >
                            <span className="font-bold text-xs block">{opt.label}</span>
                            <span className="text-[10px] text-slate-400">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Custom Number of Days */}
                  {activeTabInModal === 'days' && (
                    <div className="space-y-3 py-1">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Enter required number of days:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={customDaysInput}
                            onChange={(e) => setCustomDaysInput(e.target.value)}
                            placeholder="e.g. 10, 21, 45, 60..."
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                          />
                          <button
                            onClick={() => handleApplyCustomDays()}
                            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block mb-1.5">Quick selections:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {['3', '5', '10', '15', '21', '45', '60', '90'].map(d => (
                            <button
                              key={d}
                              onClick={() => handleApplyCustomDays(d)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/50 border border-slate-200 dark:border-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              {d} Days
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Custom Date Range (Calendar) */}
                  {activeTabInModal === 'calendar' && (
                    <div className="space-y-3 py-1">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Select start and end dates:</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Start Date</label>
                          <input
                            type="date"
                            value={customRange.startDate}
                            onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">End Date</label>
                          <input
                            type="date"
                            value={customRange.endDate}
                            onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setCustomRange({ startDate: '2026-09-01', endDate: '2026-09-12' });
                            }}
                            className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                          >
                            Sep 1-12
                          </button>
                          <span className="text-slate-400 text-[10px]">•</span>
                          <button
                            onClick={() => {
                              setCustomRange({ startDate: '2026-08-01', endDate: '2026-08-31' });
                            }}
                            className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                          >
                            August
                          </button>
                        </div>

                        <button
                          onClick={handleApplyDateRange}
                          className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Apply Range
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            title="Refresh Metrics"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
              ₹
            </div>
            <ChangeBadge value={overview?.revenue_change_pct} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Revenue</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(overview?.period_revenue ?? overview?.total_revenue ?? 0)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {overview?.period_invoices ?? overview?.total_invoices ?? 0} invoices in {periodLabelText.toLowerCase()}
            </span>
            {/* Mini purple sparkline */}
            <svg className="w-16 h-6 text-indigo-500 overflow-visible shrink-0" viewBox="0 0 60 20">
              <path d="M0 15 Q15 2 30 12 T60 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <ChangeBadge value={overview?.expense_change_pct} invert />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Expenses</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(overview?.period_expense ?? overview?.total_expense ?? 0)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Operating costs</span>
            {/* Mini pink sparkline */}
            <svg className="w-16 h-6 text-rose-400 overflow-visible shrink-0" viewBox="0 0 60 20">
              <path d="M0 16 Q15 14 30 8 T60 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <ChangeBadge value={overview?.profit_change_pct} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Net Profit</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(overview?.period_net_profit ?? overview?.net_profit ?? 0)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {netProfitValue == null ? null : netProfitValue >= 0 ? (
                <>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Profitable
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">Revenue exceeds expenses</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    At a Loss
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">Expenses exceed revenue</span>
                </>
              )}
            </div>
            {/* Mini green sparkline */}
            <svg className="w-16 h-6 text-emerald-500 overflow-visible shrink-0" viewBox="0 0 60 20">
              <path d="M0 16 Q15 14 30 6 T60 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 4: Stockout Risk Items */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            {Number.isFinite(Number(overview?.low_stock_alerts)) ? (
              Number(overview.low_stock_alerts) > 0 ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800/60">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Needs Attention</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Optimal</span>
                </div>
              )
            ) : null}
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Stockout Risk Items</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {Number.isFinite(Number(overview?.low_stock_alerts)) ? overview.low_stock_alerts : '—'}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {lowStockProducts.length > 0 ? `${lowStockProducts.length} products low in stock` : 'Optimal catalog inventory'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Middle Row: 3 Columns (Chart 50% | Donut 28% | Recent Invoices 22%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Col 1: Revenue vs Expenses Timeline (6 / 12 cols) */}
        <div className="lg:col-span-6 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Revenue vs Expenses</h3>
                <p className="text-[11px] text-slate-400">Daily business transaction timeline ({periodLabelText})</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Revenue
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Expenses
                  </span>
                </div>

                <select
                  value={filterMode === 'preset' ? dashboardPeriod : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCalendarDropdownOpen(true);
                    } else {
                      handleSelectPreset(e.target.value);
                    }
                  }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="14">Last 14 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="all">All Time</option>
                  {filterMode !== 'preset' && <option value="custom">{getActiveFilterLabel()}</option>}
                </select>
              </div>
            </div>

            {/* Area Chart */}
            <div className="h-56 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#F1F5F9'} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0F172A' : '#FFFFFF', 
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }} 
                    formatter={(value) => [formatCurrency(value)]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4 Bottom Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-medium">Highest Revenue</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                  {highestRevenueDay ? formatCurrency(highestRevenueDay.revenue) : '—'}
                </span>
                <span className="text-emerald-500 text-[10px]">📈</span>
              </div>
              <span className="text-[9px] text-slate-400">
                {highestRevenueDay ? `on ${highestRevenueDay.date.slice(5)}` : 'no sales in period'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-medium">Highest Expense</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                  {highestExpenseDay ? formatCurrency(highestExpenseDay.expense) : '—'}
                </span>
                <span className="text-rose-500 text-[10px]">📉</span>
              </div>
              <span className="text-[9px] text-slate-400">
                {highestExpenseDay ? `on ${highestExpenseDay.date.slice(5)}` : 'no expenses in period'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-medium">Avg. Daily Revenue</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                  {timeline.length > 0 ? formatCurrency(avgDailyRevenue) : '—'}
                </span>
                <Clock className="w-3 h-3 text-blue-500" />
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block font-medium">Avg. Daily Expense</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-extrabold text-slate-900 dark:text-white font-mono text-xs">
                  {timeline.length > 0 ? formatCurrency(avgDailyExpense) : '—'}
                </span>
                <Clock className="w-3 h-3 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Col 2: Expense Distribution Donut (3.5 / 12 cols) */}
        <div className="lg:col-span-3 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Expense Distribution</h3>
              <span className="text-[10px] font-bold text-slate-400">{periodLabelText}</span>
            </div>

            {/* Donut Chart with Centered Total */}
            <div className="h-44 w-full relative flex items-center justify-center">
              {pieData.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center px-4">
                  No expenses recorded in this period.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatCurrency(value)]} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {pieData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {formatCurrency(expensesData.total_expense || 0)}
                  </span>
                  <span className="text-[9px] text-slate-400">Total Expenses</span>
                </div>
              )}
            </div>

            {/* Legend List */}
            <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
              {pieData.slice(0, 5).map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                    <span className="text-slate-600 dark:text-slate-300 truncate">{entry.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[10px]">
                    {entry.share_pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Alert insight */}
          {topTwoExpenseShare != null && (
            <div className="mt-3 p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/40 text-[10px] text-brand-700 dark:text-brand-300 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" />
              <span>
                {topTwoExpenseShare.names} account for {topTwoExpenseShare.pct.toFixed(1)}% of total expenses.
              </span>
            </div>
          )}
        </div>

        {/* Col 3: Recent Transactions (2.5 / 12 cols) */}
        <div className="lg:col-span-3 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Recent Transactions</h3>
              <button
                onClick={() => setActiveTab('invoices')}
                className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {inv.customer_name || 'Counter Customer'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {inv.invoice_number || inv.id} • {inv.payment_method || 'UPI'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                      {formatCurrency(inv.total_amount)}
                    </p>
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
                      PAID
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('invoices')}
            className="w-full mt-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors text-center"
          >
            Open POS Terminal
          </button>
        </div>
      </div>

      {/* 4. Bottom Row: 3 Columns (Top Products 35% | Low Stock Alerts 30% | Quick Actions + AI Insights 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Col 1: Top Selling Products (4 / 12 cols) */}
        <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Top Selling Products</h3>
            <span className="text-[10px] font-bold text-slate-400">{periodLabelText}</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {topProducts.map((prod, idx) => (
              <div key={prod.product_id || idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-[11px] font-bold text-slate-400 w-4">{idx + 1}</span>
                  <img 
                    src={prod.image_url} 
                    alt={prod.product_name}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                  />
                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{prod.product_name}</p>
                    <p className="text-[10px] text-slate-400">{prod.total_units} sold</p>
                  </div>
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                  {formatCurrency(prod.total_revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2: Low Stock Alerts (4 / 12 cols) */}
        <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Low Stock Alerts</h3>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {lowStockProducts.map((prod) => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    <img 
                      src={prod.image_url} 
                      alt={prod.name}
                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                    />
                    <div className="truncate">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{prod.name}</p>
                      <p className="text-[10px] text-rose-500 font-semibold">Only {prod.stock_quantity} left</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[10px] font-bold transition-colors"
                  >
                    <span>🛒 Reorder</span>
                  </button>
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-6">All catalog items have healthy stock levels.</p>
              )}
            </div>
          </div>
        </div>

        {/* Col 3: Quick Actions & AI Insights (4 / 12 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Quick Actions 2x3 Grid */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-3">Quick Actions</h3>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={onOpenNewInvoice}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <Receipt className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Create Invoice</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Add Product</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Add Customer</span>
              </button>

              <button
                onClick={() => setActiveTab('suppliers')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Add Supplier</span>
              </button>

              <button
                onClick={() => setActiveTab('expenses')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <Wallet className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Log Expense</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1.5 transition-all text-center group"
              >
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-[11px]">Generate Report</span>
              </button>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-700 p-4 text-white shadow-md shadow-brand-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-extrabold text-white">AI Insights</span>
                <span className="text-[9px] font-bold uppercase bg-white/20 px-1.5 py-0.2 rounded">New</span>
              </div>
              <button 
                onClick={() => setActiveTab('forecasting')}
                className="text-[11px] font-bold text-brand-200 hover:text-white flex items-center gap-0.5"
              >
                <span>View Insights</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            
            <p className="text-xs text-white/90 leading-relaxed font-medium">
              {insights?.summary
                ? insights.summary
                : loading
                  ? 'Loading forecast insights…'
                  : 'Forecast insights are unavailable — the ML service did not respond.'}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Footer */}
      <footer className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div>
          <span>Smart Merchant v1.0.0</span> • <span>Empowering Smarter Businesses</span>
        </div>
        <div>
          <span>Built with ❤️ for Small Businesses</span>
        </div>
      </footer>
    </div>
  );
}
