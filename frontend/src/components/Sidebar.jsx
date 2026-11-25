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
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Store,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isCollapsed = false, 
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen 
}) {
  const { user, logout, hasPermission } = useAuth();
  const isCashier = user?.role === 'Staff';

  // Grouped Navigation Architecture
  const operationsGroup = [
    { id: 'invoices', label: isCashier ? 'POS Billing Register' : 'POS & Invoices', icon: Receipt, badge: 'POS', minRole: 'Staff' },
    { id: 'products', label: 'Products & Inventory', icon: Package, badge: 'Stock', minRole: 'Staff' },
    { id: 'customers', label: 'Customers & Khata', icon: Users, badge: 'Ledger', minRole: 'Staff' },
  ].filter(item => (hasPermission ? hasPermission(item.minRole) : true));

  const insightsGroup = isCashier ? [] : [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, minRole: 'Manager' },
    { id: 'analytics', label: 'Sales & BI Analytics', icon: BarChart3, minRole: 'Admin' },
    { id: 'forecasting', label: 'AI Demand Forecast', icon: Sparkles, badge: 'ML', minRole: 'Admin' },
    { id: 'expenses', label: 'Expense Tracker', icon: Wallet, minRole: 'Manager' },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Truck, minRole: 'Manager' },
  ].filter(item => (hasPermission ? hasPermission(item.minRole) : true));

  const managementGroup = [
    ...(!isCashier ? [{ id: 'staff', label: 'Staff & Roles (RBAC)', icon: ShieldCheck, minRole: 'Admin' }] : []),
    ...(!isCashier ? [{ id: 'settings', label: 'Store Settings', icon: Settings, minRole: 'Admin' }] : []),
    { id: 'help', label: 'Help & Shortcuts', icon: HelpCircle, minRole: 'Staff' },
  ].filter(item => (hasPermission ? hasPermission(item.minRole) : true));

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  const renderNavGroup = (title, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-1">
        {!isCollapsed && (
          <div className="px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {title}
          </div>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'products' && activeTab === 'inventory');
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3.5 py-2.5'
              } rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer relative group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md shadow-indigo-600/30 font-bold scale-[1.01]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} min-w-0`}>
                <div className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </div>

              {!isCollapsed && item.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                }`}>
                  {item.badge}
                </span>
              )}

              {/* Collapsed Tooltip */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {item.badge && <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500 font-bold">{item.badge}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const sidebarContent = (
    <aside className={`${
      isCollapsed ? 'w-20' : 'w-64'
    } bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none transition-all duration-300 h-screen overflow-y-auto overflow-x-hidden relative`}>
      
      {/* Brand Header */}
      <div>
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/25 text-white shrink-0">
              <BrainCircuit className="w-6 h-6" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white truncate">
                  Smart Merchant
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                    {user?.business_name || 'My Store'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          {setIsMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Role Quick Status Banner */}
        {!isCollapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full ${isCashier ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                {isCashier ? 'Cashier Register' : 'Owner Portal'}
              </span>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
              isCashier
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
            }`}>
              {user?.role || 'Staff'}
            </span>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="p-3 space-y-2">
          {renderNavGroup(isCashier ? 'BILLING & STORE' : 'OPERATIONS', operationsGroup)}
          {!isCashier && renderNavGroup('INSIGHTS & FINANCE', insightsGroup)}
          {renderNavGroup('SYSTEM', managementGroup)}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="p-3 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
        
        {/* Desktop Collapse / Expand Toggle Button */}
        {setIsCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </div>
            )}
          </button>
        )}

        {/* Quick Log Out Action */}
        <button
          onClick={logout}
          title={isCollapsed ? 'Log Out' : undefined}
          className={`w-full flex items-center justify-center ${
            isCollapsed ? 'p-2.5' : 'space-x-2 py-2 px-3'
          } rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30 transition-colors cursor-pointer`}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-fade-in">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Slide Drawer */}
          <div className="relative z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
