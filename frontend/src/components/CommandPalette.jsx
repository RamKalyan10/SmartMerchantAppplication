import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Receipt,
  Package,
  Users,
  LayoutDashboard,
  BarChart3,
  Sparkles,
  Wallet,
  Truck,
  ShieldCheck,
  Settings,
  HelpCircle,
  PlusCircle,
  ArrowRight,
  Command,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CommandPalette({ isOpen, onClose, onNavigate, onQuickAction }) {
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const navigationItems = [
    { id: 'invoices', label: 'Invoices & POS Billing', category: 'Pages', icon: Receipt, badge: 'POS', minRole: 'Staff', keywords: 'bill billing sell checkout cash invoice pos' },
    { id: 'products', label: 'Products & Inventory', category: 'Pages', icon: Package, badge: 'Stock', minRole: 'Staff', keywords: 'items catalog stock barcode sku price' },
    { id: 'customers', label: 'Customers & Khata', category: 'Pages', icon: Users, badge: 'Khata', minRole: 'Staff', keywords: 'client due debt balance contact phone ledger' },
    { id: 'dashboard', label: 'Executive Dashboard', category: 'Pages', icon: LayoutDashboard, minRole: 'Manager', keywords: 'home overview kpi metrics summary' },
    { id: 'analytics', label: 'Sales & BI Analytics', category: 'Pages', icon: BarChart3, minRole: 'Admin', keywords: 'reports charts revenue profit margins' },
    { id: 'forecasting', label: 'AI Demand Forecast & ML', category: 'Pages', icon: Sparkles, badge: 'AI', minRole: 'Admin', keywords: 'predict prediction machine learning stockout trends' },
    { id: 'expenses', label: 'Expense Tracker', category: 'Pages', icon: Wallet, minRole: 'Manager', keywords: 'spend cost rent electricity bills outflow' },
    { id: 'suppliers', label: 'Suppliers Directory', category: 'Pages', icon: Truck, minRole: 'Manager', keywords: 'vendor vendor purchase orders distributor' },
    { id: 'staff', label: 'Staff & Roles (RBAC)', category: 'Pages', icon: ShieldCheck, minRole: 'Admin', keywords: 'cashier manager permissions access employee' },
    { id: 'settings', label: 'Store Settings', category: 'Pages', icon: Settings, minRole: 'Admin', keywords: 'profile password 2-step dark mode store name' },
    { id: 'help', label: 'Help & Shortcuts', category: 'Pages', icon: HelpCircle, minRole: 'Staff', keywords: 'faq support guide hotkeys manual' },
  ].filter(item => (hasPermission ? hasPermission(item.minRole) : true));

  const actionItems = [
    { id: 'act_invoice', label: 'Create New Invoice (POS)', category: 'Actions', icon: PlusCircle, page: 'invoices', isAction: true, minRole: 'Staff', keywords: 'new bill sale order checkout' },
    { id: 'act_product', label: 'Add New Product SKU', category: 'Actions', icon: PlusCircle, page: 'products', isAction: true, minRole: 'Admin', keywords: 'new item create barcode add' },
    { id: 'act_customer', label: 'Add New Customer Profile', category: 'Actions', icon: PlusCircle, page: 'customers', isAction: true, minRole: 'Staff', keywords: 'new customer client khata add' },
    { id: 'act_expense', label: 'Log Business Expense', category: 'Actions', icon: PlusCircle, page: 'expenses', isAction: true, minRole: 'Manager', keywords: 'record spend add cost payment' },
  ].filter(item => (hasPermission ? hasPermission(item.minRole) : true));

  const allItems = [...actionItems, ...navigationItems];

  const filtered = allItems.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onNavigate?.(null, true); // Signal open
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  const handleSelect = (item) => {
    onClose();
    if (item.isAction) {
      onQuickAction?.(item.page);
    } else {
      onNavigate?.(item.id);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 pt-[12vh] animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[70vh]">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-indigo-500 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a page name, action (e.g. 'pos', 'customer', 'stock', 'bill')..."
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold shrink-0">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1 text-xs">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No matches found for "{query}"</p>
              <p className="text-[11px] mt-1">Try searching for POS, stock, invoice, customer, or expenses.</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : item.isAction
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="truncate text-xs font-semibold">{item.label}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.category} • {item.isAction ? 'Instant Action' : 'Switch Tab'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400 opacity-60'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↓</kbd> to navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Enter</kbd> to select</span>
          </div>
          <span className="hidden sm:inline font-mono text-[10px]">Smart Search</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
