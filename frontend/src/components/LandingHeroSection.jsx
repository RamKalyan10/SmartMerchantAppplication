import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Receipt, 
  Boxes, 
  BarChart3, 
  ShieldCheck, 
  TrendingUp, 
  Zap, 
  BrainCircuit, 
  CheckCircle2, 
  Lock,
  Layers,
  ChevronRight,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LandingHeroSection() {
  const { openAuth } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 8,
    totalInvoices: 120,
    totalCustomers: 4,
    totalSales: 285400,
    databaseConnected: true
  });

  useEffect(() => {
    api.get('/system/public-highlights')
      .then(res => {
        if (res.data) setStats(res.data);
      })
      .catch(() => {});
  }, []);

  const features = [
    {
      icon: Sparkles,
      title: 'AI & Machine Learning Forecasting',
      desc: 'Anticipate daily product demand with advanced regression algorithms and prevent costly stockouts.',
      color: 'indigo'
    },
    {
      icon: Receipt,
      title: 'High-Speed POS Invoicing',
      desc: 'Generate GST-compliant digital invoices instantly with automatic inventory sync and audit tracking.',
      color: 'emerald'
    },
    {
      icon: Boxes,
      title: 'Smart Stock & Reorder Alerts',
      desc: 'Real-time stock level monitoring with lead-time tracking and supplier integration.',
      color: 'amber'
    },
    {
      icon: BarChart3,
      title: 'Executive BI & Margin Analytics',
      desc: 'Deep financial metrics, revenue vs expense trends, customer segmentation, and profit insights.',
      color: 'cyan'
    },
    {
      icon: ShieldCheck,
      title: 'Granular Multi-Role RBAC',
      desc: 'Enterprise security governance for Owners, Store Admins, Inventory Managers, and Cashiers.',
      color: 'purple'
    },
    {
      icon: Layers,
      title: 'Automated Expense & Cashflow Tracking',
      desc: 'Categorize operational expenses, track vendor payments, and maximize merchant profitability.',
      color: 'rose'
    }
  ];

  return (
    <div className="space-y-16 py-6 sm:py-10 max-w-6xl mx-auto">
      
      {/* Main Hero Header */}
      <div className="relative text-center space-y-6 overflow-hidden pt-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-brand-600/20 via-indigo-500/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 shadow-sm text-xs font-semibold text-brand-700 dark:text-brand-300 animate-fade-in">
          <BrainCircuit className="w-4 h-4 text-brand-500" />
          <span>Next-Generation AI Merchant Management Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          Empower Your Retail Business with{' '}
          <span className="bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Predictive AI Intelligence
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          From lightning-fast point-of-sale checkout to machine learning demand forecasting, inventory alerts, and financial intelligence — all in one unified platform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <button
            onClick={() => openAuth('register')}
            className="flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all"
          >
            <span>Create Merchant Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => openAuth('login')}
            className="flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 font-semibold text-sm shadow-sm transition-all"
          >
            <Lock className="w-4 h-4 text-brand-500" />
            <span>Sign In to Console</span>
          </button>
        </div>

        {/* Quick Highlights Strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Real-Time POS Billing
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Scikit-learn Demand Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Role-Based Access (RBAC)
          </span>
        </div>
      </div>

      {/* Interactive Platform Preview Mockup */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            <span className="text-xs font-mono text-slate-400 ml-2">smart-merchant.ai/console</span>
          </div>
          <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>AI Predictive Pipeline Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Live Database Sales</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">₹{Number(stats.totalSales || 0).toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">↑ {stats.totalInvoices} Orders in DB</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Active Catalog SKUs</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalProducts} Products</div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Synced with {stats.totalSuppliers} suppliers</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer Directory</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalCustomers} Accounts</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Enterprise database active</div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Complete Operations Suite for Modern Merchants
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Everything your store requires to streamline billing, manage suppliers, eliminate dead stock, and expand profit margins.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 hover:shadow-lg transition-all space-y-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Final Call to Action */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-brand-900/90 via-indigo-950/80 to-slate-900 border border-brand-500/30 text-white text-center space-y-4 shadow-xl">
        <h3 className="text-2xl font-bold">Ready to Supercharge Your Merchant Operations?</h3>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          Sign in or create an account to start managing stock, issuing invoices, and predicting revenue with ML.
        </p>
        <button
          onClick={() => openAuth('register')}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-500/30 transition-all"
        >
          <span>Get Started Now</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
