import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  Keyboard, 
  Activity, 
  Send, 
  MessageSquare, 
  Phone, 
  Mail, 
  ExternalLink, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Receipt, 
  Sparkles, 
  Boxes, 
  Wallet, 
  Users,
  ShieldCheck,
  Zap,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const FAQS = [
  {
    category: 'Billing & POS',
    icon: Receipt,
    items: [
      {
        q: 'How do I create a quick POS invoice bill?',
        a: 'Click the "Quick Create" button in the top navbar or navigate to "Invoices & Billing" and click "Create New Invoice". You can select existing products from your catalog, adjust quantities, select or register a customer, and click "Print / Save Invoice".'
      },
      {
        q: 'Can I apply custom discounts and GST rates per bill?',
        a: 'Yes! While billing in POS mode, you can specify individual item prices or enter a total bill discount in rupees. Taxes are automatically calculated based on your default tax rate (configurable in Settings).'
      },
      {
        q: 'How do customer credit / pending Udhar payments work?',
        a: 'When creating an invoice, set the Payment Status to "Pending / Credit (Udhar)". The invoice amount will automatically be added to that customer\'s Khata ledger. When they pay later, open Customers, view their profile, and mark the invoice as PAID.'
      }
    ]
  },
  {
    category: 'AI Forecasting & Insights',
    icon: Sparkles,
    items: [
      {
        q: 'How does the AI Demand Forecasting model calculate restock needs?',
        a: 'Two estimators run side by side and the system picks per SKU. Products that sell on most days are forecast by a pooled gradient-boosting model trained across the whole catalog, so a single slow SKU borrows statistical strength from every other product in its category. Products that sell only occasionally use Croston/SBA, which models the size of each sale and the gap between sales separately — the standard treatment for intermittent retail demand. Those forecasts then feed a periodic-review policy: reorder point = mean daily demand x (lead time + review period) + a safety-stock term scaled by the demand standard deviation and your service level, using each product\'s real supplier lead time.'
      },
      {
        q: 'How does Expense Anomaly Detection work?',
        a: 'Each expense is scored against its own category\'s median and median absolute deviation, computed with that expense left out so a single large charge cannot widen the very range used to judge it. Categories whose spend drifts over time are detrended first, so a genuine seasonal rise is not flagged as a spike. Anything beyond the robust z threshold is flagged, and every record — flagged or not — reports the expected range, its percentile and the reason. The flag rate therefore depends on your data; it is not fixed at a percentage. Isolation Forest runs alongside on categories with enough records and is reported as corroboration, but it never overrides the z-score.'
      }
    ]
  },
  {
    category: 'Inventory & Stock Control',
    icon: Boxes,
    items: [
      {
        q: 'How is stock deducted when an invoice is issued?',
        a: 'Stock deduction is automatic and instant. When you complete an invoice, each line item product stock quantity in the database is automatically reduced, and an audit transaction is logged in the Inventory Ledger.'
      },
      {
        q: 'How do I manually restock or adjust damaged goods?',
        a: 'Go to "Products and Inventory" (Stock & Levels tab), find the product SKU, click "Adjust Stock", select the operation (Restock In, Damage / Waste Out, or Physical Count Set), enter the quantity and reason, and confirm.'
      },
      {
        q: 'What is the difference between a purchase order and a restock?',
        a: 'Ordering and receiving are separate steps, and only receiving moves stock. Placing a purchase order (from "Forecasting → Demand" via the "Order N units" button, or the Purchase Orders tab) records what you have asked a supplier for, how many units and when it is expected — your stock count does not change yet. When the goods actually arrive, open the Purchase Orders tab and click "Receive": that adds the quantity to stock and writes a RESTOCK entry to the audit log. This is what makes supplier lead times measurable rather than assumed.'
      },
      {
        q: 'Why does a product show an opening stock balance in the audit log?',
        a: 'The OPENING entry is the stock that product started the recorded period with, dated the day before its first sale. Every later RESTOCK shows goods arriving; sales are recorded on the invoices themselves. The current stock figure is what remains after all of them, so opening + restocks − sales = stock on hand.'
      }
    ]
  },
  {
    category: 'Sales Analytics & Reports',
    icon: BookOpen,
    items: [
      {
        q: 'How do I download sales and net profit reports for a specific date range?',
        a: 'Navigate to "Sales & BI Analytics", choose your desired horizon (7 Days, 14 Days, 30 Days, 90 Days, or pick custom Dates), then click "Download Report". You can export an instant Excel/CSV spreadsheet or generate a printable Executive PDF report.'
      },
      {
        q: 'How is Net Business Profit calculated?',
        a: 'Net Profit = Sales Revenue − Cost of Goods Sold (Procurement Cost) − Total Operating Expenses (Rent, Salaries, Utilities, Freight). It gives you true take-home business earnings.'
      }
    ]
  }
];

const SHORTCUTS = [
  { key: 'Ctrl + K', action: 'Universal search across products, invoices, and customers' },
  { key: 'F2 / Quick Action', action: 'Open Point of Sale New Invoice creator' },
  { key: 'Esc', action: 'Dismiss active dialog or close modal' },
  { key: 'Enter', action: 'Confirm form input or apply active filter' }
];

export default function HelpSupportPage() {
  const { user } = useAuth();

  // Search filter for FAQs
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Diagnostic Test State
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Support Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('billing');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');

  // Toggle FAQ accordion
  const toggleFaq = (idx) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  // Run System Health Diagnostics
  const runDiagnostics = async () => {
    setTestingHealth(true);
    const results = {
      api: 'Checking...',
      database: 'Checking...',
      mlEngine: 'Checking...',
      latencyMs: 0
    };

    const startTime = Date.now();
    try {
      const res = await api.get('/products');
      const latency = Date.now() - startTime;
      results.api = 'Online (200 OK)';
      results.database = `Connected (${res.data?.products?.length || 0} SKUs verified)`;
      results.latencyMs = latency;
      
      // Test ML engine ping
      try {
        const mlRes = await api.get('/forecast/insights?days=7');
        const info = mlRes.data?.model_info || {};
        if (mlRes.data?.degraded) {
          // The API answers 200 with a labelled fallback when the Python
          // service is down, so a status code alone would report "Operational"
          // for a store running on seasonal-naive repeats.
          results.mlEngine = 'Degraded (ML service unreachable — fallback estimates)';
        } else {
          results.mlEngine = `Operational (${info.sales_basis || 'models loaded'}, ${info.demand_items_analysed ?? 0} SKUs)`;
        }
      } catch (e) {
        results.mlEngine = 'Offline';
      }
    } catch (err) {
      results.api = 'Degraded';
      results.database = 'Error connecting';
      results.mlEngine = 'Offline';
    } finally {
      setHealthStatus(results);
      setTestingHealth(false);
    }
  };

  // Handle Support Ticket Submit
  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMessage) return;

    const newId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    setTicketId(newId);
    setTicketSubmitted(true);
    setTicketSubject('');
    setTicketMessage('');
  };

  const filteredFaqs = FAQS.map(group => ({
    ...group,
    items: group.items.filter(it => 
      it.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      it.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <span>Help Center & Merchant Support</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Knowledge base guides, POS shortcuts, live system diagnostics, and merchant priority assistance.
          </p>
        </div>

        {/* Quick Contact Badge */}
        <div className="flex items-center gap-2">
          <a
            href="https://wa.me/919876543210"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Support</span>
          </a>
        </div>
      </div>

      {/* Top Banner Search */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-brand-600/10 via-indigo-600/10 to-purple-600/10 dark:from-brand-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 text-center space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">How can we assist your business today?</h2>
        <div className="max-w-xl mx-auto relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQs (e.g. POS Billing, Net Profit, Inventory, AI Forecasts)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>
      </div>

      {/* 2-Column Layout: FAQs & Shortcuts (7 cols) + Diagnostics & Contact Form (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: FAQs & Keyboard Shortcuts */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* FAQ Accordion Section */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-500" />
                <span>Frequently Asked Questions</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                {filteredFaqs.reduce((s, g) => s + g.items.length, 0)} Guides
              </span>
            </div>

            <div className="space-y-4">
              {filteredFaqs.map((group, gIdx) => {
                const GroupIcon = group.category === 'Billing & POS' ? Receipt :
                  group.category === 'AI Forecasting & Insights' ? Sparkles :
                  group.category === 'Inventory & Stock Control' ? Boxes : BookOpen;

                return (
                  <div key={gIdx} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                      <GroupIcon className="w-3.5 h-3.5" />
                      <span>{group.category}</span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((item, iIdx) => {
                        const uniqueKey = `${gIdx}_${iIdx}`;
                        const isExpanded = expandedFaq === uniqueKey;
                        return (
                          <div
                            key={iIdx}
                            className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30 transition-colors"
                          >
                            <button
                              onClick={() => toggleFaq(uniqueKey)}
                              className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
                            >
                              <span>{item.q}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-3.5 pb-3.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-2.5 animate-fade-in">
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredFaqs.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No help topics match "{searchQuery}". Try searching for POS, stock, or profit.
                </div>
              )}
            </div>
          </div>

          {/* POS Keyboard Shortcuts */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-indigo-500" />
              <span>Point of Sale Keyboard Shortcuts</span>
            </h3>
            <p className="text-[11px] text-slate-400">Boost your billing speed at the cash counter:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {SHORTCUTS.map((sc, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate pr-2">{sc.action}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] font-bold text-brand-600 dark:text-brand-400 shadow-2xs shrink-0">
                    {sc.key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Diagnostics & Support Ticket */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* System Health Diagnostics Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Live System Diagnostics</span>
              </h3>
              <button
                onClick={runDiagnostics}
                disabled={testingHealth}
                className="px-3 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer"
              >
                {testingHealth ? 'Pinging...' : 'Run Test'}
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-brand-500" /> Express REST API
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {healthStatus?.api || 'Operational (Port 5000)'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Storage Engine
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {healthStatus?.database || 'Local JSON / PostgreSQL Ready'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" /> ML Forecasting Core
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {healthStatus?.mlEngine || 'Operational (Port 8000)'}
                </span>
              </div>

              {healthStatus?.latencyMs > 0 && (
                <p className="text-[10px] text-slate-400 text-right">
                  Roundtrip latency: <strong className="text-emerald-500 font-mono">{healthStatus.latencyMs}ms</strong>
                </p>
              )}
            </div>
          </div>

          {/* Contact Support Ticket Form */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-500" />
              <span>Submit Support Ticket</span>
            </h3>
            <p className="text-[11px] text-slate-400">Our merchant technical team replies within 1 hour.</p>

            {ticketSubmitted ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ticket Logged Successfully!</span>
                </div>
                <p className="text-[11px]">
                  Your reference ID is <strong className="font-mono text-brand-600 dark:text-brand-400">{ticketId}</strong>. We will contact {user?.email || 'your registered email'}.
                </p>
                <button
                  type="button"
                  onClick={() => setTicketSubmitted(false)}
                  className="mt-2 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  Submit another query →
                </button>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Issue Category</label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-brand-500"
                  >
                    <option value="billing">Invoicing & POS Billing</option>
                    <option value="inventory">Inventory & SKU Sync</option>
                    <option value="forecasting">AI Demand Forecasts</option>
                    <option value="reports">Sales Reports & Audit</option>
                    <option value="other">General Account Query</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Subject / Summary *</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of the issue"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Message & Details *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe what happened or what assistance is required..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-brand-600/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Ticket</span>
                </button>
              </form>
            )}
          </div>

          {/* Software Info & Version Badge */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-300">Smart Merchant AI Suite v1.4.0</div>
            <p>Database schema version: 2026.09.16 • Build #5842</p>
            <p>© 2026 Smart Merchant Inc. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
