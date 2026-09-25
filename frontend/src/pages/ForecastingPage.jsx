import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Boxes,
  Layers,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  Zap,
  Info,
  X
} from 'lucide-react';
import api from '../services/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

export default function ForecastingPage({ setActiveTab }) {
  const { isDark } = useTheme();

  // The AI settings on the Settings page were written to localStorage and then
  // read by nothing, so a merchant could set a 30-day default horizon and still
  // land on a 7-day view. These now seed the page.
  const savedSettings = (() => {
    try {
      return JSON.parse(localStorage.getItem('sm_merchant_settings') || '{}');
    } catch {
      return {};
    }
  })();

  const [forecastDays, setForecastDays] = useState(() => {
    const saved = parseInt(savedSettings.forecastHorizon, 10);
    return [7, 14, 30].includes(saved) ? saved : 7;
  });
  const [activeTab, setActiveForecastingTab] = useState('sales'); // 'sales' | 'demand' | 'catalog' | 'expenses'
  const [showRestockSuggestions] = useState(savedSettings.enableRestockSuggestions !== false);
  const [loading, setLoading] = useState(false);
  
  // ML States
  const [salesForecast, setSalesForecast] = useState(null);
  const [demandForecast, setDemandForecast] = useState(null);
  const [catalogClass, setCatalogClass] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [insights, setInsights] = useState(null);

  // Placing an order from a recommendation. The button that opens this used to
  // just call setActiveTab('inventory') — the recommendation disappeared and no
  // order existed anywhere, so the suggested quantity was never recorded.
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockResult, setRestockResult] = useState(null);

  const openRestock = (item) => {
    setRestockItem(item);
    setRestockQty(String(item.recommended_order_quantity || ''));
    setRestockResult(null);
  };

  const closeRestock = () => {
    if (restockSubmitting) return;
    setRestockItem(null);
    setRestockResult(null);
  };

  const submitRestock = async (e) => {
    e.preventDefault();
    if (!restockItem) return;

    const qty = Number(restockQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setRestockResult({ ok: false, message: 'Enter a whole number greater than zero.' });
      return;
    }

    setRestockSubmitting(true);
    setRestockResult(null);
    try {
      const res = await api.post('/inventory/purchase-orders', {
        product_id: restockItem.product_id,
        quantity: qty,
        trigger: 'forecast_recommendation'
      });
      const po = res.data.purchase_order;
      setRestockResult({
        ok: true,
        message: `${po.id} placed — ${po.quantity} × ${po.product_name}, expected ${po.expected_at}.`
      });
      // The recommendation is a function of stock and in-flight orders, so refresh
      // it rather than leaving a stale "Order N units" for an order already raised.
      fetchMLPredictions();
    } catch (err) {
      setRestockResult({
        ok: false,
        message:
          err.response?.data?.message ||
          err.message ||
          'Could not place the purchase order.'
      });
    } finally {
      setRestockSubmitting(false);
    }
  };

  const fetchMLPredictions = async () => {
    setLoading(true);
    // Settings the models actually consume. Previously these were written to
    // localStorage and read by nothing, so changing them had no visible effect.
    const tuning = new URLSearchParams();
    const floor = Number(savedSettings.lowStockThreshold);
    if (Number.isFinite(floor) && floor > 0) tuning.set('min_stock_floor', String(floor));
    if (savedSettings.anomalySensitivity) {
      tuning.set('sensitivity', savedSettings.anomalySensitivity);
    }
    const tuned = tuning.toString() ? `&${tuning.toString()}` : '';

    try {
      const [salesRes, demandRes, catalogRes, expRes, insightsRes] = await Promise.all([
        api.get(`/forecast/sales?days=${forecastDays}`),
        api.get(`/forecast/demand?days=${forecastDays}${tuned}`),
        api.get('/forecast/catalog'),
        api.get(`/forecast/expenses?days=${forecastDays}${tuned}`),
        api.get(`/forecast/insights?days=${forecastDays}${tuned}`)
      ]);

      setSalesForecast(salesRes.data);
      setDemandForecast(demandRes.data);
      setCatalogClass(catalogRes.data);
      setExpenseData(expRes.data);
      setInsights(insightsRes.data);
    } catch (err) {
      console.error('Error fetching ML predictions from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMLPredictions();
  }, [forecastDays]);

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Header & ML Engine Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              AI Forecasting & Merchant Decision Hub
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
              Scikit-learn · Quantile GBM · Croston/SBA · KMeans
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Transforming live database history into predictive foresight: Sales trends, product demand, stockout prevention, and expense anomaly detection.
          </p>
        </div>

        {/* Forecast Horizon Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setForecastDays(7)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                forecastDays === 7 ? 'bg-brand-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setForecastDays(14)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                forecastDays === 14 ? 'bg-brand-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setForecastDays(30)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                forecastDays === 30 ? 'bg-brand-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={fetchMLPredictions}
            disabled={loading}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Retrain / Refresh ML Pipeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Service state banner. When the Python service is unreachable the API
          returns a labelled seasonal-naive fallback; saying so on screen is the
          difference between a degraded number and a wrong one. */}
      {(salesForecast?.degraded || demandForecast?.degraded || expenseData?.degraded) && (
        <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-800 dark:text-amber-200">
              ML service unreachable — these are fallback estimates
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              The trained models did not run.{' '}
              {salesForecast?.degraded_reason ||
                salesForecast?.degraded_error ||
                'The forecasting service is not responding.'}{' '}
              Revenue figures shown are a seasonal-naive repeat of last week's actuals.
            </p>
          </div>
        </div>
      )}

      {(salesForecast?.status === 'insufficient_data' || demandForecast?.status === 'insufficient_data') && (
        <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-200">Not enough history to forecast yet</p>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {salesForecast?.message || demandForecast?.message}{' '}
              {salesForecast?.n_required
                ? `Needs ${salesForecast.n_required} ${salesForecast.unit || 'days'}, has ${salesForecast.n_available}.`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* EXECUTIVE ML PREDICTION SUMMARY */}
      {insights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Sales Forecast ({forecastDays}d)</span>
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-mono">
              {formatCurrency(salesForecast?.total_forecasted_sales || insights.expected_revenue_next_period)}
            </h3>
            {(() => {
              // The trend used to be rendered as a hardcoded "↑ +" prefix, so a
              // projected decline still showed a green up arrow.
              const trend = salesForecast?.trend_percentage;
              if (trend === undefined || trend === null) {
                return (
                  <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    Trend unavailable
                  </div>
                );
              }
              const rising = Number(trend) >= 0;
              return (
                <div className={`mt-2 text-xs font-bold flex items-center gap-1 ${
                  rising ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  <span>{rising ? '↑ +' : '↓ '}{Number(trend).toFixed(1)}%</span>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    vs previous {forecastDays} actual days
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/40 dark:bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Projected Expenses</span>
              <DollarSign className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-mono">
              {formatCurrency(insights.expected_expense_next_period)}
            </h3>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {expenseData?.expense_forecast?.model_info?.method === 'robust_level_with_shrunk_growth'
                ? `Robust per-category level, growth shrunk at n=${insights.model_info?.expense_basis_n ?? '—'}`
                : 'Per-category projection from recorded expenses'}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Gross Profit</span>
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
              {formatCurrency(insights.expected_gross_profit || insights.predicted_net_profit)}
            </h3>
            <div className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
              <span>Gross Margin: ~{
                insights.expected_revenue_next_period > 0
                  ? ((Number(insights.expected_gross_profit || 0) / Number(insights.expected_revenue_next_period)) * 100).toFixed(1)
                  : ((1 - (Number(insights.model_info?.cogs_ratio) || 0.801)) * 100).toFixed(1)
              }%</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (Revenue − COGS)
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              COGS basis: {insights.model_info?.cogs_basis === 'measured_from_invoice_cost_prices'
                ? `measured from invoice line items (${(Number(insights.model_info?.cogs_ratio || 0) * 100).toFixed(1)}% of revenue)`
                : 'assumed default — no line-item costs recorded'}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">ML Confidence Score</span>
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-1.5 font-mono">
              {/* 0.95 was shown whenever nothing supplied a value, which read as
                  "95% accurate" on a store the model had never scored. The
                  number below is the measured backtest fit, or nothing at all. */}
              {salesForecast?.confidence != null
                ? `${Math.round(salesForecast.confidence * 100)}%`
                : '—'}
            </h3>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {salesForecast?.confidence != null
                ? 'Walk-forward backtest fit (1 − MASE)'
                : 'Not yet scored — needs more history'}
            </div>
          </div>
        </div>
      )}

      {/* AI RECOMMENDATION & ACTION CARDS */}
      {insights?.top_recommended_actions && (
        <div className="glass-panel p-6 rounded-3xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/30 dark:bg-slate-900/70 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-500/20 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Merchant Decision Engine — "What Should I Do?"
              </h3>
            </div>
            <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider bg-brand-100 dark:bg-brand-500/20 px-2 py-0.5 rounded border border-brand-300 dark:border-brand-500/30">
              Proactive Business Actions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {insights.top_recommended_actions.map((act, i) => (
              <div key={i} className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl flex items-start space-x-3 shadow-sm">
                <div className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{act}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold space-x-6 overflow-x-auto">
        <button
          onClick={() => setActiveForecastingTab('sales')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'sales'
              ? 'border-brand-600 text-brand-600 dark:border-brand-500 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Sales Revenue Forecast</span>
        </button>

        <button
          onClick={() => setActiveForecastingTab('demand')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'demand'
              ? 'border-brand-600 text-brand-600 dark:border-brand-500 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Product Demand & Restock ({demandForecast?.total_shortage_items || 0} Alerts)</span>
        </button>

        <button
          onClick={() => setActiveForecastingTab('catalog')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'catalog'
              ? 'border-brand-600 text-brand-600 dark:border-brand-500 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Catalog Demand Classification</span>
        </button>

        <button
          onClick={() => setActiveForecastingTab('expenses')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'expenses'
              ? 'border-brand-600 text-brand-600 dark:border-brand-500 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Expense Anomaly Detection ({expenseData?.total_anomalies || 0} Flags)</span>
        </button>
      </div>

      {/* TAB 1: SALES FORECASTING */}
      {activeTab === 'sales' && salesForecast && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Next {forecastDays}-Day Revenue Forecast & Uncertainty Bounds
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct multi-horizon quantile gradient boosting over lags 1/7/14/28,
                shifted rolling means, weekly Fourier terms, payday and festival flags.
                The band is the model's own 2.5th–97.5th percentile, not a fixed percentage.
              </p>
            </div>
            <div className="text-xs text-right space-y-1">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total Projected Revenue:</span>{' '}
                <span className="font-extrabold text-brand-600 dark:text-brand-400 font-mono text-sm">
                  {formatCurrency(salesForecast.total_forecasted_sales)}
                </span>
              </div>
              {salesForecast.weekend_sales != null && salesForecast.workday_sales != null && (
                <div className="flex items-center gap-1.5 justify-end text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/40">
                    🌴 Weekends ({salesForecast.weekend_days}d): {formatCurrency(salesForecast.weekend_sales)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/40">
                    💼 Working Days ({salesForecast.workday_days}d): {formatCurrency(salesForecast.workday_sales)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesForecast.daily_forecasts} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.4} />
                <XAxis dataKey="date" stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={11} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke={isDark ? "#64748b" : "#94a3b8"} fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                    borderColor: isDark ? '#475569' : '#cbd5e1', 
                    color: isDark ? '#ffffff' : '#0f172a',
                    borderRadius: '10px', 
                    fontSize: '12px' 
                  }}
                  formatter={(val, name) => [`₹${Number(val).toLocaleString('en-IN')}`, name === 'predicted_sales' ? 'Predicted Sales' : name]}
                />
                <Area type="monotone" dataKey="upper_bound" stroke="#818cf8" strokeDasharray="4 4" fill="none" name="Upper Bound (97.5th pct)" />
                <Area type="monotone" dataKey="predicted_sales" stroke="#6366f1" strokeWidth={3} fill="url(#forecastGlow)" name="Predicted Sales" />
                <Area type="monotone" dataKey="lower_bound" stroke="#4338ca" strokeDasharray="4 4" fill="none" name="Lower Bound (2.5th pct)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Table Breakdown */}
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800 pt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Date & Day</th>
                  <th className="py-2.5 px-3 font-bold">Expected Revenue</th>
                  <th className="py-2.5 px-3 font-bold">Confidence Band (95%)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Day Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
                {salesForecast.daily_forecasts.map((pt, i) => {
                  const d = new Date(pt.date);
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayName = dayNames[d.getDay()] || '';
                  const dow = d.getDay();
                  const isWeekend = pt.is_weekend != null ? pt.is_weekend : (dow === 0 || dow === 6);
                  const dayTypeLabel = isWeekend ? '🌴 Weekend' : '💼 Working Day';

                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        <div className="font-bold">{pt.date}</div>
                        <div className="text-[10px] text-slate-400">{dayName}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-300">{formatCurrency(pt.predicted_sales)}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {formatCurrency(pt.lower_bound)} — {formatCurrency(pt.upper_bound)}
                        {pt.upper_bound > pt.lower_bound && (
                          <span className="block text-[10px] text-slate-400">
                            ±{formatCurrency((pt.upper_bound - pt.lower_bound) / 2)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2.5 py-1 rounded-lg font-semibold border text-[11px] ${
                          isWeekend
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        }`}>
                          {dayTypeLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT DEMAND & RESTOCK RECOMMENDATIONS */}
      {activeTab === 'demand' && demandForecast && (
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>
                Reorder Point = <strong>d̄·(L + R) + z·σ·√(L + R)</strong> — modelled daily demand
                d̄, its standard deviation σ, each product's real supplier lead time L,
                and a {Math.round((demandForecast.results?.[0]?.service_level ?? 0.95) * 100)}% service level.
              </span>
            </div>
            <div className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
              {demandForecast.total_shortage_items || 0} Products Require Imminent Reorder
            </div>
          </div>

          {!showRestockSuggestions && (
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-400">
              Reorder quantity suggestions are turned off in Settings → AI Forecasting. The
              demand, reorder point and cover figures below are unaffected.
            </div>
          )}

          {demandForecast.results?.length === 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 text-center">
              {demandForecast.message || 'No products to analyse.'}
            </div>
          )}

          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">Product Name</th>
                    <th className="px-5 py-3.5 font-bold">Category</th>
                    <th className="px-5 py-3.5 font-bold">Current Stock</th>
                    <th className="px-5 py-3.5 font-bold">Predicted Demand ({forecastDays}d)</th>
                    <th className="px-5 py-3.5 font-bold">Reorder Point</th>
                    <th className="px-5 py-3.5 font-bold">Days of Cover</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                    {showRestockSuggestions && (
                      <>
                        <th className="px-5 py-3.5 font-bold">AI Recommended Reorder</th>
                        <th className="px-5 py-3.5 text-right font-bold">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {demandForecast.results.map((item) => (
                    <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{item.product_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.demand_method}
                          {item.n_observations ? ` · ${item.n_observations} selling days` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.category}</td>
                      <td className="px-5 py-4 font-mono font-bold">{item.current_stock}</td>
                      <td className="px-5 py-4 font-mono text-indigo-600 dark:text-indigo-300 font-bold">
                        {item.predicted_demand_units} units
                        {item.daily_velocity > 0 && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {item.daily_velocity}/day ± {item.daily_demand_std}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono">
                        {item.reorder_point}
                        <span className="block text-[10px] text-slate-400">
                          lead {item.lead_time_days}d · safety {item.safety_stock}
                        </span>
                      </td>
                      {/* "0 (Sufficient)" used to stand in for any non-shortage,
                          including items holding six months of dead stock. */}
                      <td className="px-5 py-4 font-mono">
                        {item.days_of_cover == null ? (
                          <span className="text-slate-400">no demand</span>
                        ) : (
                          <span className={
                            item.days_of_cover < item.lead_time_days
                              ? 'text-rose-600 dark:text-rose-400 font-bold'
                              : item.days_of_cover > 90
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                          }>
                            {item.days_of_cover}d
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          item.status === 'Critical Shortage' || item.status === 'Out of Stock'
                            ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                            : item.status === 'Low Stock'
                            ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                            : item.status === 'Overstocked'
                            ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30'
                            : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {showRestockSuggestions && (
                        <>
                          <td className="px-5 py-4 font-mono font-bold text-brand-600 dark:text-brand-300">
                            {item.recommended_order_quantity > 0 ? (
                              <>
                                +{item.recommended_order_quantity} units
                                <span className="block text-[10px] font-normal text-slate-400">
                                  to {item.order_up_to_level} units
                                </span>
                              </>
                            ) : (
                              'None required'
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {item.recommended_order_quantity > 0 ? (
                              <button
                                onClick={() => openRestock(item)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow transition-all"
                              >
                                Order {item.recommended_order_quantity}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Stock OK</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATALOG REQUIREMENT CLASSIFICATION */}
      {activeTab === 'catalog' && catalogClass && (
        <div className="space-y-6">
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>
                {catalogClass.model_info?.method === 'kmeans_k5' || String(catalogClass.model_info?.method || '').startsWith('kmeans')
                  ? <>KMeans segmentation over <strong>{catalogClass.model_info?.features?.length || 6}</strong> time-normalised features, ranked by cluster centroid.</>
                  : <>Single-segment fallback — too few distinct products to cluster, so every SKU is labelled from its own measured velocity.</>}
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 shrink-0">
              Observed over {catalogClass.model_info?.observation_days || '—'} days of invoices
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(catalogClass.summary || {}).map(([catName, count]) => (
              <div key={catName} className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">{catName}</div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{count}</div>
              </div>
            ))}
          </div>

          {catalogClass.classifications?.length === 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 text-center">
              {catalogClass.message || 'No catalog products to classify.'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogClass.classifications.map((item) => {
              const badgeColors = {
                'HIGH DEMAND': 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
                'MEDIUM DEMAND': 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
                'LOW DEMAND': 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
                'SLOW MOVING': 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
                'DEAD STOCK': 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
              };

              return (
                <div key={item.product_id} className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3 shadow-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.product_name}</h4>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${badgeColors[item.classification] || 'bg-slate-100 text-slate-700'}`}>
                        {item.classification}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                      💡 <strong>ML Strategy:</strong> {item.recommendation}
                    </p>
                    {/* The evidence the cluster was formed on, so the label is
                        checkable rather than asserted. */}
                    {Array.isArray(item.reasons) && item.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {item.reasons.map((reason, ri) => (
                          <span key={ri} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      Priority: <strong className="text-slate-900 dark:text-white">{item.action_priority}</strong>
                      {item.features?.gross_margin_pct != null && (
                        <span className="ml-2">
                          · margin <strong className="text-slate-900 dark:text-white">
                            {(item.features.gross_margin_pct * 100).toFixed(0)}%
                          </strong>
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => setActiveTab('products')}
                      className="text-brand-600 dark:text-brand-400 hover:text-brand-500 font-semibold"
                    >
                      Manage Product →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: EXPENSE ANOMALY DETECTION */}
      {activeTab === 'expenses' && expenseData && (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Expense Anomaly Detection — leave-one-out robust z-score
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Each charge is scored against its own category's median and MAD, computed
                with that charge excluded. The flag rate is a consequence of the data, not a
                fixed percentage
                {expenseData.model_info?.threshold_z
                  ? `; the threshold is |z| > ${expenseData.model_info.threshold_z}.`
                  : '.'}
                {expenseData.model_info?.isolation_forest_used
                  ? ' Isolation Forest runs alongside as corroboration only.'
                  : ''}
              </p>
            </div>
            <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 shrink-0">
              {expenseData.total_anomalies} Irregular Charges Detected
            </div>
          </div>

          {/* The expense forecast was computed and returned on every request and
              then never rendered — the tab only ever showed the anomaly list. */}
          {expenseData.expense_forecast?.category_breakdown?.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Projected Spend by Category — next {expenseData.expense_forecast.forecast_months || 1} month
                </h3>
                <div className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400">
                  Total {formatCurrency(expenseData.expense_forecast.total_predicted_expense)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Category</th>
                      <th className="py-2.5 px-3 font-bold">Projected</th>
                      <th className="py-2.5 px-3 font-bold">Range</th>
                      <th className="py-2.5 px-3 font-bold">Share</th>
                      <th className="py-2.5 px-3 font-bold">Type</th>
                      <th className="py-2.5 px-3 text-right font-bold">Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {expenseData.expense_forecast.category_breakdown.map((cat) => (
                      <tr key={cat.category} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{cat.category}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(cat.predicted_amount)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {formatCurrency(cat.interval_low)} – {formatCurrency(cat.interval_high)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{cat.share_pct}%</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            cat.cost_type === 'fixed'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                          }`}>
                            {cat.cost_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[10px] text-slate-500 dark:text-slate-400">
                          {cat.method} · n={cat.n_observations}
                          {cat.monthly_growth_pct !== 0 && (
                            <span className="block">
                              trend {cat.monthly_growth_pct > 0 ? '+' : ''}{cat.monthly_growth_pct}%/mo
                            </span>
                          )}
                          {cat.baseline_strength === 'weak' && (
                            <span className="block text-amber-600 dark:text-amber-400 font-bold">
                              weak baseline
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {expenseData.expense_forecast.model_info?.note}
              </p>
            </div>
          )}

          {expenseData.anomalies.length === 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 text-center">
              {expenseData.message || 'No expenses recorded yet.'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expenseData.anomalies.map((anom, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  anom.is_anomaly
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/40 shadow-sm'
                    : 'glass-panel bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">{anom.category}</span>
                    <h4 className="text-lg font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                      {formatCurrency(anom.amount)}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Date: {anom.date || '—'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    anom.is_anomaly
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 badge-pulse'
                      : anom.method === 'insufficient_baseline'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                  }`}>
                    {anom.is_anomaly ? '⚠ Anomaly' : anom.method === 'insufficient_baseline' ? '— Not Scored' : '✓ Normal'}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Expected Range:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{anom.expected_range}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Robust z / Percentile:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {anom.robust_z} · {anom.percentile}th
                      {anom.iforest_flag !== undefined && ` · IForest ${anom.iforest_flag === -1 ? 'agree' : 'no'}`}
                    </span>
                  </div>
                  {/* The reason explains the baseline for every record, not only
                      the flagged ones — "within normal range for Electricity
                      (₹1,900–₹4,100), 64th percentile" is the useful answer to
                      "why wasn't this flagged?". */}
                  <div className={`text-xs pt-1 font-medium ${
                    anom.is_anomaly
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {anom.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* PLACE PURCHASE ORDER MODAL (PORTALIZED)                                  */}
      {/* ======================================================================= */}
      {restockItem && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={closeRestock} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Place Purchase Order</h3>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{restockItem.product_name}</p>
                </div>
              </div>
              <button
                onClick={closeRestock}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="placePurchaseOrderForm" onSubmit={submitRestock} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-y-2">
                {[
                  ['Current stock', `${restockItem.current_stock}`],
                  ['Days of cover', restockItem.days_of_cover == null ? 'no demand' : `${restockItem.days_of_cover}d`],
                  ['Lead time', `${restockItem.lead_time_days}d`],
                  ['Reorder point', restockItem.reorder_point],
                  ['Order-up-to level', restockItem.order_up_to_level],
                  ['Supplier cost / unit', `₹${restockItem.unit_cost}`]
                ].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white text-right">{value}</span>
                  </React.Fragment>
                ))}
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Quantity to order *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  The model recommended {restockItem.recommended_order_quantity} units. Expected
                  arrival is {restockItem.lead_time_days} days from today; receiving the order is a
                  separate step on the Inventory page.
                </p>
              </div>

              {restockResult && (
                <div className={`p-3 rounded-xl border text-[11px] font-medium ${
                  restockResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                }`}>
                  {restockResult.message}
                </div>
              )}
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={closeRestock}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                {restockResult?.ok ? 'Close' : 'Cancel'}
              </button>
              <button
                form="placePurchaseOrderForm"
                type="submit"
                disabled={restockSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {restockSubmitting ? 'Placing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
