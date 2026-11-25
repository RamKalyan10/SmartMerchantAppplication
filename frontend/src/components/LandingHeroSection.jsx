import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  Receipt,
  Boxes,
  BarChart3,
  ShieldCheck,
  Zap,
  BrainCircuit,
  CheckCircle2,
  Lock,
  Layers,
  ChevronRight,
  TrendingUp,
  Activity,
  Users,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LandingHeroSection() {
  const { openAuth } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 88,
    totalInvoices: 6646,
    totalCustomers: 6,
    totalSales: 2572836,
    totalSuppliers: 5,
    databaseConnected: true,
  });
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    // Trigger stagger entrance
    const t = setTimeout(() => setAnimIn(true), 50);
    api.get('/system/public-highlights')
      .then(res => { if (res.data) setStats(res.data); })
      .catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const features = [
    {
      icon: BrainCircuit,
      title: 'AI & ML Demand Forecasting',
      desc: 'Scikit-learn regression models predict daily product demand and prevent costly stockouts before they happen.',
      accent: 'feature-card-violet',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
    },
    {
      icon: Receipt,
      title: 'High-Speed POS Invoicing',
      desc: 'Generate GST-compliant digital invoices instantly with automatic inventory sync and full audit tracking.',
      accent: 'feature-card-cyan',
      iconBg: 'bg-cyan-500/15',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Boxes,
      title: 'Smart Stock & Reorder Alerts',
      desc: 'Real-time stock level monitoring with supplier lead-time tracking and automated reorder recommendations.',
      accent: 'feature-card-emerald',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
    },
    {
      icon: BarChart3,
      title: 'Executive BI & Margin Analytics',
      desc: 'Deep financial metrics, revenue vs expense trends, customer segmentation, and real-time profit insights.',
      accent: 'feature-card-amber',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
    },
    {
      icon: ShieldCheck,
      title: 'Granular Multi-Role RBAC',
      desc: 'Enterprise security for Owners, Store Admins, Inventory Managers, and Cashiers with audit logs.',
      accent: 'feature-card-rose',
      iconBg: 'bg-rose-500/15',
      iconColor: 'text-rose-400',
    },
    {
      icon: Layers,
      title: 'Automated Expense & Cashflow',
      desc: 'Categorize operational expenses, track vendor payments, and maximize merchant profitability automatically.',
      accent: 'feature-card-indigo',
      iconBg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-400',
    },
  ];

  const trustBadges = [
    { icon: CheckCircle2, label: 'Real-Time POS Billing' },
    { icon: CheckCircle2, label: 'Scikit-learn Forecasting' },
    { icon: CheckCircle2, label: 'Role-Based Access (RBAC)' },
  ];

  const statItems = [
    {
      label: 'Live Database Sales',
      value: `₹${Number(stats.totalSales || 0).toLocaleString('en-IN')}`,
      sub: `↑ ${(stats.totalInvoices || 0).toLocaleString()} Orders in DB`,
      subColor: 'text-emerald-400',
      icon: TrendingUp,
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Active Catalog SKUs',
      value: `${stats.totalProducts} Products`,
      sub: `Synced with ${stats.totalSuppliers || 5} suppliers`,
      subColor: 'text-violet-400',
      icon: Package,
      iconColor: 'text-violet-400',
    },
    {
      label: 'Customer Directory',
      value: `${stats.totalCustomers} Accounts`,
      sub: 'Enterprise database active',
      subColor: 'text-cyan-400',
      icon: Users,
      iconColor: 'text-cyan-400',
    },
  ];

  return (
    <div className="hero-bg hero-mesh min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-16">

      {/* ── AMBIENT ORB LIGHTS ── */}
      <div className="hero-orb-violet w-[600px] h-[500px] -top-32 -left-24 animate-pulse-slow" />
      <div className="hero-orb-cyan w-[500px] h-[400px] top-24 -right-16 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      <div className="hero-orb-indigo w-[400px] h-[300px] bottom-0 left-1/3 animate-pulse-slow" style={{ animationDelay: '3s' }} />

      <div className="relative z-10 max-w-6xl mx-auto space-y-16 py-10 sm:py-14">

        {/* ════════════════════════════════════════
            HERO HEADER
        ════════════════════════════════════════ */}
        <div className="text-center space-y-7">

          {/* AI Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-300 transition-all duration-500 animate-badge-pulse ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <BrainCircuit className="w-4 h-4 text-violet-400 animate-pulse-glow" />
            <span>Next-Generation AI Merchant Management Platform</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Main Headline */}
          <div className={`space-y-1 transition-all duration-700 delay-100 ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] xl:text-[4.25rem] font-black tracking-tight text-white leading-[1.08]">
              Empower Your Retail Business
            </h1>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] xl:text-[4.25rem] font-black tracking-tight leading-[1.08] text-gradient-hero">
              with Predictive AI Intelligence
            </h1>
          </div>

          {/* Subtitle */}
          <p className={`text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed transition-all duration-700 delay-200 ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            From lightning-fast point-of-sale checkout to machine learning demand forecasting,
            inventory alerts, and financial intelligence — all in one unified platform.
          </p>

          {/* CTA Buttons */}
          <div className={`flex flex-wrap items-center justify-center gap-4 pt-1 transition-all duration-700 delay-300 ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              id="hero-cta-register"
              onClick={() => openAuth('register')}
              className="group relative flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-sm text-white overflow-hidden btn-glow"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #06B6D4 100%)' }}
            >
              <span className="relative z-10">Create Merchant Account</span>
              <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              {/* Shimmer overlay */}
              <span className="absolute inset-0 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              id="hero-cta-signin"
              onClick={() => openAuth('login')}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
            >
              <Lock className="w-4 h-4 text-violet-400" />
              <span>Sign In to Console</span>
            </button>
          </div>

          {/* Trust Badges */}
          <div className={`flex flex-wrap items-center justify-center gap-5 pt-2 transition-all duration-700 delay-400 ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            {trustBadges.map((badge, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <badge.icon className="w-4 h-4 text-emerald-500" />
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════
            LIVE STATS MOCKUP CARD
        ════════════════════════════════════════ */}
        <div className={`hero-glass rounded-2xl overflow-hidden shadow-2xl shadow-black/40 transition-all duration-700 delay-500 animate-float ${animIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {/* Browser chrome bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-slate-500 ml-3">smart-merchant.ai/console</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Predictive Pipeline Active</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-5 sm:p-7 grid grid-cols-1 md:grid-cols-3 gap-4">
            {statItems.map((item, i) => (
              <div key={i} className="hero-stat-card rounded-xl p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>
                  <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div className="text-xl font-bold text-white">{item.value}</div>
                <div className={`text-[11px] font-semibold ${item.subColor}`}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Sparkle chart decorative bar */}
          <div className="px-5 sm:px-7 pb-5">
            <div className="flex items-center gap-1.5 h-10">
              {[4, 6, 5, 8, 7, 9, 6, 10, 8, 9, 7, 10, 8, 9, 10, 8, 7, 9, 10, 8, 9, 7, 10, 9].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm opacity-70"
                  style={{
                    height: `${v * 10}%`,
                    background: i % 3 === 0
                      ? 'rgba(124, 58, 237, 0.7)'
                      : i % 3 === 1
                        ? 'rgba(6, 182, 212, 0.6)'
                        : 'rgba(99, 102, 241, 0.55)',
                    animationDelay: `${i * 0.05}s`
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-500 font-medium">Revenue trend — Last 30 Days</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-violet-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-violet-400" /> Revenue
                </span>
                <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Forecast
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            FEATURE GRID
        ════════════════════════════════════════ */}
        <div className="space-y-8">
          <div className={`text-center space-y-2.5 transition-all duration-700 delay-200 ${animIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Complete Operations Suite for Modern Merchants
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Everything your store requires to streamline billing, manage suppliers, eliminate dead stock, and expand profit margins.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              const delays = ['delay-100', 'delay-200', 'delay-300', 'delay-400', 'delay-500', 'delay-600'];
              return (
                <div
                  key={idx}
                  className={`hero-glass-card rounded-2xl p-5 space-y-3.5 group cursor-default ${feat.accent} animate-fade-in-up ${delays[idx]}`}
                >
                  <div className={`w-11 h-11 rounded-xl ${feat.iconBg} ${feat.iconColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════
            BOTTOM CTA BANNER
        ════════════════════════════════════════ */}
        <div className="relative rounded-3xl overflow-hidden p-10 text-center space-y-5 border border-violet-500/25"
          style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(99, 102, 241, 0.15) 50%, rgba(6, 182, 212, 0.12) 100%)' }}>
          {/* Blur orb inside */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[400px] h-[200px] rounded-full bg-violet-600/20 blur-3xl" />
          </div>
          <div className="relative z-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs text-violet-300 font-semibold border border-violet-400/20">
              <Sparkles className="w-3.5 h-3.5" />
              Ready to go live
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              Ready to Supercharge Your Merchant Operations?
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Sign in or create an account to start managing stock, issuing invoices, and predicting revenue with ML.
            </p>
            <button
              id="hero-cta-bottom"
              onClick={() => openAuth('register')}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white btn-glow"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' }}
            >
              <span>Get Started Now</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

