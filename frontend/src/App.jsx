import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CommandPalette from './components/CommandPalette';
import LandingHeroSection from './components/LandingHeroSection';

import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import ProductsInventoryPage from './pages/ProductsInventoryPage';
import ForecastingPage from './pages/ForecastingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExpensesPage from './pages/ExpensesPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import StaffPage from './pages/StaffPage';
import SettingsPage from './pages/SettingsPage';
import HelpSupportPage from './pages/HelpSupportPage';

import { 
  Receipt, 
  Package, 
  Users, 
  LayoutDashboard, 
  Menu 
} from 'lucide-react';

function AppContent() {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState(() => (user?.role === 'Staff' ? 'invoices' : 'dashboard'));
  const [quickActionTrigger, setQuickActionTrigger] = useState(null);

  // Navigation UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sm_sidebar_collapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sm_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Auto-route Staff to invoices if they attempt to load restricted tabs
  useEffect(() => {
    if (user?.role === 'Staff' && ['dashboard', 'expenses', 'suppliers', 'staff', 'forecasting', 'analytics', 'settings'].includes(activeTab)) {
      setActiveTab('invoices');
    }
  }, [user?.role, activeTab]);

  const handleQuickAction = (page) => {
    setActiveTab(page);
    setQuickActionTrigger({ page, timestamp: Date.now() });
  };

  const handleQuickActionConsumed = () => {
    setQuickActionTrigger(null);
  };

  const renderActivePage = () => {
    if (user?.role === 'Staff' && ['dashboard', 'expenses', 'suppliers', 'staff', 'forecasting', 'analytics', 'settings'].includes(activeTab)) {
      return <InvoicesPage quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'invoices'} onConsumeQuickAction={handleQuickActionConsumed} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} onOpenNewInvoice={() => handleQuickAction('invoices')} />;
      case 'invoices':
        return <InvoicesPage quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'invoices'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'products':
        return <ProductsInventoryPage initialSubTab="catalog" quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'products'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'inventory':
        return <ProductsInventoryPage initialSubTab="inventory" quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'products'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'forecasting':
        return <ForecastingPage setActiveTab={setActiveTab} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'expenses':
        return <ExpensesPage setActiveTab={setActiveTab} quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'expenses'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'customers':
        return <CustomersPage quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'customers'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'suppliers':
        return <SuppliersPage quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'suppliers'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'staff':
        return <StaffPage quickActionTrigger={quickActionTrigger} isNewModalOpen={quickActionTrigger?.page === 'staff'} onConsumeQuickAction={handleQuickActionConsumed} />;
      case 'settings':
        return <SettingsPage />;
      case 'help':
        return <HelpSupportPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} onOpenNewInvoice={() => handleQuickAction('invoices')} />;
    }
  };

  return (
    <div className={`flex h-screen text-slate-900 dark:text-slate-100 overflow-hidden transition-colors ${
      isAuthenticated
        ? 'bg-slate-50 dark:bg-[#0B0F19]'
        : 'bg-[#070B14]'
    }`}>
      
      {/* Show Sidebar only when authenticated */}
      {isAuthenticated && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={toggleSidebarCollapse}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar 
          activeTab={activeTab}
          onOpenNewInvoice={() => handleQuickAction('invoices')} 
          onQuickAction={handleQuickAction}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* Page Body Viewport - with bottom padding on mobile for bottom bar */}
        <main className={`flex-1 overflow-y-auto ${isAuthenticated ? 'p-3 sm:p-5 lg:p-7 space-y-6 pb-20 md:pb-6' : ''}`}>
          <div className={isAuthenticated ? 'w-full max-w-[1720px] mx-auto' : 'w-full'}>
            {isAuthenticated ? (
              renderActivePage()
            ) : (
              <LandingHeroSection />
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Screens < md) */}
        {isAuthenticated && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-30 shadow-lg">
            <button
              onClick={() => setActiveTab(user?.role === 'Staff' ? 'invoices' : 'dashboard')}
              className={`flex flex-col items-center justify-center w-16 py-1 cursor-pointer transition-colors ${
                (activeTab === 'dashboard' || (user?.role === 'Staff' && activeTab === 'invoices'))
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{user?.role === 'Staff' ? 'POS' : 'Home'}</span>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex flex-col items-center justify-center w-16 py-1 cursor-pointer transition-colors ${
                activeTab === 'invoices'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Receipt className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Billing</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`flex flex-col items-center justify-center w-16 py-1 cursor-pointer transition-colors ${
                (activeTab === 'products' || activeTab === 'inventory')
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Package className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Stock</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`flex flex-col items-center justify-center w-16 py-1 cursor-pointer transition-colors ${
                activeTab === 'customers'
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Khata</span>
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center w-16 py-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 cursor-pointer"
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">More</span>
            </button>
          </nav>
        )}
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tabId, forceOpen) => {
          if (forceOpen) setIsCommandPaletteOpen(true);
          else if (tabId) setActiveTab(tabId);
        }}
        onQuickAction={handleQuickAction}
      />

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
