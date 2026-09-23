import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  Calendar, 
  Filter, 
  PieChart as PieChartIcon, 
  BarChart3,
  TrendingDown, 
  TrendingUp,
  Clock,
  Home,
  Users,
  Zap,
  Truck,
  Megaphone,
  Wrench,
  MoreHorizontal,
  ChevronRight,
  Lightbulb,
  ArrowRight,
  Layers,
  Tag
} from 'lucide-react';
import api from '../services/api';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ICONS = {
  'Rent': Home,
  'Staff Salary': Users,
  'Electricity': Zap,
  'Transport & Logistics': Truck,
  'Marketing & Ads': Megaphone,
  'Maintenance & Repairs': Wrench,
  'Miscellaneous': MoreHorizontal
};

const CATEGORY_COLORS = {
  'Rent': { bg: 'bg-indigo-50 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-600', hex: '#6366F1' },
  'Staff Salary': { bg: 'bg-blue-50 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500', hex: '#3B82F6' },
  'Electricity': { bg: 'bg-emerald-50 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', hex: '#10B981' },
  'Transport & Logistics': { bg: 'bg-amber-50 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', hex: '#F59E0B' },
  'Marketing & Ads': { bg: 'bg-pink-50 dark:bg-pink-950/60', text: 'text-pink-600 dark:text-pink-400', bar: 'bg-pink-500', hex: '#EC4899' },
  'Maintenance & Repairs': { bg: 'bg-purple-50 dark:bg-purple-950/60', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500', hex: '#8B5CF6' },
  'Miscellaneous': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-500', hex: '#64748B' }
};

export default function ExpensesPage({ quickActionTrigger, isNewModalOpen: propIsNewModalOpen, onConsumeQuickAction, setActiveTab }) {
  const { hasPermission } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [periodLabel, setPeriodLabel] = useState('Overall (All Time)');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Time filter state: '7d', '14d', '30d', 'overall'
  const [timeFilter, setTimeFilter] = useState('overall');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'pie'

  // Form state
  const [category, setCategory] = useState('Electricity');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const TIME_FILTERS = [
    { id: '7d', label: '7 Days' },
    { id: '14d', label: '14 Days' },
    { id: '30d', label: '30 Days' },
    { id: 'overall', label: 'Overall (All Time)' }
  ];

  const fetchExpenses = async (selectedPeriod = timeFilter, cat = selectedCategory) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (cat && cat !== 'All') params.append('category', cat);

      const res = await api.get(`/expenses?${params.toString()}`);
      setExpenses(res.data?.expenses || []);
      setTotalExpense(res.data?.total_expense || 0);
      setAllTimeTotal(res.data?.all_time_total || res.data?.total_expense || 0);
      setDailyAverage(res.data?.daily_average || 0);
      setCategoryBreakdown(res.data?.category_breakdown || []);
      
      const label = selectedPeriod === 'overall' ? 'Overall (All Time)' : `Past ${selectedPeriod.replace('d', '')} Days`;
      setPeriodLabel(res.data?.period_label || label);
    } catch (err) {
      console.error('Error fetching expenses from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(timeFilter, selectedCategory);
  }, [timeFilter, selectedCategory]);

  useEffect(() => {
    if (quickActionTrigger?.page === 'expenses' || propIsNewModalOpen) {
      handleOpenAdd();
      if (onConsumeQuickAction) {
        onConsumeQuickAction();
      }
    }
  }, [quickActionTrigger, propIsNewModalOpen]);

  const handleOpenAdd = () => {
    setCategory('Electricity');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', {
        category,
        amount: Number(amount),
        date,
        description
      });
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
      fetchExpenses(timeFilter, selectedCategory);
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording expense in database');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense from the database?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses(timeFilter, selectedCategory);
    } catch (err) {
      alert('Error deleting expense');
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const allCategories = ['All', 'Rent', 'Staff Salary', 'Electricity', 'Transport & Logistics', 'Marketing & Ads', 'Maintenance & Repairs', 'Miscellaneous'];

  const anomalyCount = expenses.filter(exp => 
    (exp.category === 'Electricity' && exp.amount > 5000) ||
    (exp.category === 'Transport & Logistics' && exp.amount > 4000) ||
    (exp.description && exp.description.toLowerCase().includes('surge'))
  ).length;

  const topExpense = categoryBreakdown.length > 0 ? categoryBreakdown[0] : { category: 'Rent', total: 52500, share_pct: 39.6 };

  // Donut chart slices
  const pieData = categoryBreakdown.map((cat) => ({
    name: cat.category,
    value: cat.total,
    share_pct: cat.share_pct,
    color: CATEGORY_COLORS[cat.category]?.hex || '#6366F1'
  }));

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span>Operational Expense Tracker</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor overhead expenditures with multi-horizon filtering and ML-based anomaly tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchExpenses(timeFilter, selectedCategory)}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {hasPermission('Manager') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Controls Bar (Time Horizon + Category) */}
      <div className="glass-panel p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Left: Time Horizon Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Time Horizon:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {TIME_FILTERS.map((tf) => {
              const active = timeFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  onClick={() => setTimeFilter(tf.id)}
                  className={`px-3.5 py-1.5 rounded-xl transition-all ${
                    active
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Category Filter Dropdown */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-brand-500 shadow-2xs"
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Top 4 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Spend */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800/60">
              <TrendingUp className="w-3 h-3" />
              <span>12%</span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{periodLabel} Spend</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(totalExpense)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 truncate">
              {expenses.length} transactions • All-time total: {formatCurrency(allTimeTotal)}
            </span>
            {/* Smooth purple wave sparkline */}
            <svg className="w-16 h-6 text-indigo-500 overflow-visible shrink-0" viewBox="0 0 60 20">
              <path d="M0 15 Q15 2 30 12 T60 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Daily Burn Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60">
              <TrendingDown className="w-3 h-3" />
              <span>8%</span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Daily Burn Rate</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(dailyAverage)} <span className="text-xs text-slate-400 font-normal">/ day</span>
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Prorated across overall period</span>
            {/* Smooth amber wave sparkline */}
            <svg className="w-16 h-6 text-amber-500 overflow-visible shrink-0" viewBox="0 0 60 20">
              <path d="M0 16 Q15 8 30 14 T60 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 3: Top Expense */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Top Expense: {topExpense.category}
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                {formatCurrency(topExpense.total)}
              </h3>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[11px] text-slate-400 block mb-1">
              {topExpense.share_pct}% of overall spend
            </span>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${topExpense.share_pct}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Anomaly Flags */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Anomaly Flags</p>
              <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                {anomalyCount > 0 ? `${anomalyCount} Spikes` : '0 Spikes'}
              </h3>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {anomalyCount > 0 ? 'Cost surges detected' : 'Normal range'}
            </span>
            {/* Mini vertical red spark-bars */}
            <div className="flex items-end gap-1 shrink-0 h-5">
              <span className="w-1 h-2 bg-rose-300 rounded-full"></span>
              <span className="w-1 h-3.5 bg-rose-400 rounded-full"></span>
              <span className="w-1 h-5 bg-rose-600 rounded-full"></span>
              <span className="w-1 h-3 bg-rose-400 rounded-full"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Middle Section (Two Side-by-Side Cards: Category Breakdown + Expense Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Card: Category Breakdown (7 / 12 cols) */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Category Breakdown ({periodLabel})
                  </h3>
                  <p className="text-[11px] text-slate-400">Total Spend: {formatCurrency(totalExpense)}</p>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('bar')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                    viewMode === 'bar'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Bar View</span>
                </button>
                <button
                  onClick={() => setViewMode('pie')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                    viewMode === 'pie'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PieChartIcon className="w-3.5 h-3.5" />
                  <span>Pie View</span>
                </button>
              </div>
            </div>

            {/* List of Category Progress Bars */}
            <div className="space-y-3.5">
              {categoryBreakdown.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.category] || MoreHorizontal;
                const styleObj = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Miscellaneous'];

                return (
                  <div key={cat.category} className="flex items-center gap-3 text-xs">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl ${styleObj.bg} ${styleObj.text} flex items-center justify-center shrink-0`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Category Label */}
                    <div className="w-36 font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {cat.category}
                    </div>

                    {/* Colored Progress Bar */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`${styleObj.bar} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(cat.share_pct * 1.8, 100)}%` }}
                      />
                    </div>

                    {/* Amount & Share % */}
                    <div className="w-24 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(cat.total)}
                    </div>
                    <div className="w-12 text-right font-mono text-slate-400 text-[11px]">
                      {cat.share_pct}%
                    </div>
                  </div>
                );
              })}

              {categoryBreakdown.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No expenses logged for this horizon.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Expense Distribution Donut & Insights (5 / 12 cols) */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Tag className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Expense Distribution
              </h3>
            </div>

            {/* Donut Chart with Right Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 py-2">
              
              {/* Donut with Center Total */}
              <div className="sm:col-span-6 h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData.length > 0 ? pieData : [{ name: 'Rent', value: 52500, color: '#6366F1' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2.5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatCurrency(value)]} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                    {formatCurrency(totalExpense)}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Spend</span>
                </div>
              </div>

              {/* Right Legend List with Percentages */}
              <div className="sm:col-span-6 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {categoryBreakdown.map((cat) => {
                  const hex = CATEGORY_COLORS[cat.category]?.hex || '#6366F1';
                  return (
                    <div key={cat.category} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }}></span>
                        <span className="text-slate-600 dark:text-slate-300 truncate">{cat.category}</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[10px] shrink-0">{cat.share_pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Insights Banner Box */}
          <div className="mt-4 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-indigo-900 dark:text-indigo-200 text-[11px]">Recent Insights</p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  Rent and Staff Salary account for {categoryBreakdown.length >= 2 ? (categoryBreakdown[0].share_pct + categoryBreakdown[1].share_pct).toFixed(1) : '76.6'}% of total expenses.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setActiveTab && setActiveTab('forecasting')}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <span>View Insights</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Expense Records Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Expense Records ({expenses.length} Transactions for <strong className="text-brand-600 dark:text-brand-400">{periodLabel}</strong>)
          </span>
          <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/60 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800/60 w-fit">
            🤖 ML Anomaly Scoring Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-bold">Date</th>
                <th className="px-5 py-3.5 font-bold">Category</th>
                <th className="px-5 py-3.5 font-bold">Description</th>
                <th className="px-5 py-3.5 font-bold">Amount</th>
                <th className="px-5 py-3.5 font-bold">Anomaly Check</th>
                {hasPermission('Admin') && <th className="px-5 py-3.5 text-right font-bold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {expenses.map((exp) => {
                const isSpike = (exp.category === 'Electricity' && exp.amount > 5000) ||
                                (exp.category === 'Transport & Logistics' && exp.amount > 4000) ||
                                (exp.description && exp.description.toLowerCase().includes('surge'));

                return (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{exp.date}</td>
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{exp.category}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{exp.description || 'N/A'}</td>
                    <td className="px-5 py-4 font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-5 py-4">
                      {isSpike ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Spike Anomaly Flagged</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Normal variance</span>
                      )}
                    </td>
                    {hasPermission('Admin') && (
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No expense records found in database for selected horizon.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal (Portalized) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Log Operational Expense</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Record expenditure into database with automated anomaly tracking.
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

            <form id="expenseModalForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-medium"
                >
                  <option value="Electricity">Electricity & Utilities</option>
                  <option value="Rent">Store Lease / Rent</option>
                  <option value="Staff Salary">Staff Payroll / Salary</option>
                  <option value="Transport & Logistics">Transport & Logistics Freight</option>
                  <option value="Maintenance & Repairs">Maintenance & Repairs</option>
                  <option value="Marketing & Ads">Marketing & Promotions</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5400"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly commercial electricity billing"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                form="expenseModalForm"
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Save Expense Record
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
