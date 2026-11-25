import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, subtitle, trend, trendValue, icon: Icon, color = 'indigo' }) {
  const colorMap = {
    indigo: {
      border: 'border-indigo-500/20 hover:border-indigo-500/40 dark:border-indigo-500/20 dark:hover:border-indigo-500/40',
      iconBg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      gradient: 'from-indigo-500/5 to-transparent'
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/40 dark:border-emerald-500/20 dark:hover:border-emerald-500/40',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      gradient: 'from-emerald-500/5 to-transparent'
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/40 dark:border-amber-500/20 dark:hover:border-amber-500/40',
      iconBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-500/5 to-transparent'
    },
    rose: {
      border: 'border-rose-500/20 hover:border-rose-500/40 dark:border-rose-500/20 dark:hover:border-rose-500/40',
      iconBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
      gradient: 'from-rose-500/5 to-transparent'
    }
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`glass-card p-5 rounded-2xl bg-white dark:bg-slate-900/60 bg-gradient-to-br ${scheme.gradient} border ${scheme.border} relative overflow-hidden group shadow-sm transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight font-sans">{value}</h3>
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl ${scheme.iconBg} flex items-center justify-center border border-slate-200/50 dark:border-white/5 shadow-inner`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtitle || trendValue) && (
        <div className="mt-3.5 flex items-center space-x-2 text-xs">
          {trendValue && (
            <span className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded ${
              trend === 'down' 
                ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300' 
                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
            }`}>
              {trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {trendValue}
            </span>
          )}
          {subtitle && <span className="text-slate-500 dark:text-slate-400 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
