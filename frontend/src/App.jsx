import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
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

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [quickActionTrigger, setQuickActionTrigger] = useState(null);

  const handleQuickAction = (page) => {
    setActiveTab(page);
    setQuickActionTrigger({ page, timestamp: Date.now() });
  };

  const handleQuickActionConsumed = () => {
    setQuickActionTrigger(null);
  };

  const renderActivePage = () => {
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
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar onOpenNewInvoice={() => handleQuickAction('invoices')} onQuickAction={handleQuickAction} />

        {/* Page Body Viewport - full width with max-w-[1720px] */}
        <main className={`flex-1 overflow-y-auto ${isAuthenticated ? 'p-4 sm:p-6 lg:p-8 space-y-6' : ''}`}>
          <div className={isAuthenticated ? 'w-full max-w-[1720px] mx-auto' : 'w-full'}>
            {isAuthenticated ? (
              renderActivePage()
            ) : (
              <LandingHeroSection />
            )}
          </div>
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
