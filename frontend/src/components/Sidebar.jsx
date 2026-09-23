import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  Truck, 
  Wallet, 
  BarChart3, 
  Sparkles, 
  ShieldCheck, 
  BrainCircuit,
  LogOut,
  Settings,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices & Billing', icon: Receipt, badge: 'POS' },
    { id: 'products', label: 'Products & Inventory', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'expenses', label: 'Expense Tracker', icon: Wallet },
    { id: 'staff', label: 'Staff & RBAC', icon: ShieldCheck },
  ];

  const aiNavItems = [
    { id: 'forecasting', label: 'AI Forecast & Insights', icon: Sparkles, badge: 'ML' },
    { id: 'analytics', label: 'Sales & BI Analytics', icon: BarChart3 },
  ];

  const toolsNavItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
  ];

  const renderNavGroup = (title, items) => (
    <div className="space-y-1">
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id || (item.id === 'products' && activeTab === 'inventory');
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/60'
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none transition-colors h-screen overflow-y-auto">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/25 text-white">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Smart Merchant
            </h1>
            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-200 dark:border-brand-800/50">
              AI Intelligence Suite
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-2">
          {renderNavGroup('MAIN', mainNavItems)}
          {renderNavGroup('AI & ANALYTICS', aiNavItems)}
          {renderNavGroup('TOOLS', toolsNavItems)}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 space-y-3">
        {/* Quick Log Out Action */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}

