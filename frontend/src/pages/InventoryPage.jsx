import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, ArrowUpDown, History, Plus, AlertCircle, CheckCircle2, X, RefreshCw, LayoutGrid, List, Package } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeView, setActiveView] = useState('stock'); // 'stock' | 'logs'
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('RESTOCK');
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Supplier shipment received');
  const [saving, setSaving] = useState(false);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const [invRes, txRes] = await Promise.all([
        api.get('/inventory/status'),
        api.get('/inventory/transactions')
      ]);
      setSummary(invRes.data?.summary || null);
      setInventory(invRes.data?.inventory || []);
      setTransactions(txRes.data?.transactions || []);
    } catch (err) {
      console.error('Error fetching inventory from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const handleOpenAdjust = (prod) => {
    setSelectedProduct(prod);
    setAdjustType('RESTOCK');
    setAdjustQty('10');
    setAdjustReason('Direct warehouse restock');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await api.post('/inventory/adjust', {
        product_id: selectedProduct.id,
        adjustment_type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason
      });
      setIsAdjustModalOpen(false);
      fetchInventoryData();
      alert(`Stock for ${selectedProduct.name} updated successfully in database!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error adjusting stock in database');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Inventory & Warehouse Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time stock level tracking, automated depletion on sales, safety buffers, and audit logs from database.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInventoryData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveView('stock')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                activeView === 'stock' ? 'bg-brand-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Current Stock Levels
            </button>
            <button
              onClick={() => setActiveView('logs')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeView === 'logs' ? 'bg-brand-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit History</span>
            </button>
          </div>

          {activeView === 'stock' && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl text-xs">
              <button onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow text-brand-600' : 'text-slate-400 hover:text-slate-700'}`}
                title="Grid View">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow text-brand-600' : 'text-slate-400 hover:text-slate-700'}`}
                title="Table View">
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Catalog SKUs</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{summary.total_sku_count} Active Items</h3>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Inventory Valuation (Cost)</p>
            <h3 className="text-xl font-bold text-brand-600 dark:text-brand-400 font-mono mt-1">{formatCurrency(summary.total_inventory_value)}</h3>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Retail Potential Value</p>
            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(summary.total_retail_value)}</h3>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Low / Stockout Alerts</p>
            <h3 className={`text-xl font-bold mt-1 ${summary.low_stock_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {summary.low_stock_count} Items Low
            </h3>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeView === 'stock' ? (
        viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {inventory.map((item) => {
              const isOut = item.status === 'Out of Stock';
              const isLow = item.status === 'Low Stock';
              const stockPct = Math.min(100, Math.round((item.stock_quantity / Math.max(item.min_stock_level * 3, 1)) * 100));
              return (
                <div key={item.id} className="group glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col overflow-hidden hover:border-brand-500/40 hover:shadow-lg transition-all">
                  {/* Image */}
                  <div className="relative h-24 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'} alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOut ? 'bg-rose-500 text-white' : isLow ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-500 text-white'
                    }`}>{isOut ? 'Out' : isLow ? 'Low' : 'OK'}</span>
                  </div>
                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                    <div className="font-bold text-[11px] text-slate-900 dark:text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{item.category_name}</div>
                    {/* Stock bar */}
                    <div className="mt-1">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className={`font-bold ${isOut ? 'text-rose-500' : isLow ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>{item.stock_quantity} {item.unit}</span>
                        <span className="text-slate-400">min:{item.min_stock_level}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} style={{width: `${stockPct}%`}} />
                      </div>
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(item.stock_value)}</div>
                    {hasPermission('Manager') && (
                      <button onClick={() => handleOpenAdjust(item)}
                        className="mt-1 w-full py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 text-[10px] font-bold transition-all">
                        Restock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Product SKU</th>
                  <th className="px-5 py-3.5 font-bold">Product Name</th>
                  <th className="px-5 py-3.5 font-bold">Category</th>
                  <th className="px-5 py-3.5 font-bold">Current Stock</th>
                  <th className="px-5 py-3.5 font-bold">Min Buffer</th>
                  <th className="px-5 py-3.5 font-bold">Holding Value</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  {hasPermission('Manager') && (
                    <th className="px-5 py-3.5 text-right font-bold">Quick Restock</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-brand-600 dark:text-brand-400">{item.sku}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.category_name}</td>
                    <td className="px-5 py-4 font-mono font-bold text-sm">
                      <span className={item.stock_quantity <= item.min_stock_level ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}>
                        {item.stock_quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.min_stock_level} {item.unit}</td>
                    <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-300">{formatCurrency(item.stock_value)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        item.status === 'Out of Stock' ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                        : item.status === 'Low Stock' ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                        : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                      }`}>{item.status}</span>
                    </td>
                    {hasPermission('Manager') && (
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleOpenAdjust(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/30 text-xs font-semibold transition-all">
                          Adjust / Restock
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      ) : (
        /* Audit History Logs Table */
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            Inventory Movement & Stock Adjustment Audit Log
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-bold">Timestamp</th>
                  <th className="px-5 py-3 font-bold">Product</th>
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold">Delta Qty</th>
                  <th className="px-5 py-3 font-bold">Stock Before → After</th>
                  <th className="px-5 py-3 font-bold">Reason / Reference</th>
                  <th className="px-5 py-3 font-bold">Adjusted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                      {tx.product_name}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        tx.adjustment_type === 'RESTOCK' || tx.adjustment_type === 'IN'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-transparent'
                          : tx.adjustment_type === 'SALE'
                          ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-transparent'
                          : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-transparent'
                      }`}>
                        {tx.adjustment_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono font-bold">
                      {tx.adjustment_type === 'RESTOCK' ? `+${tx.quantity}` : `-${tx.quantity}`}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-400">
                      {tx.previous_stock} → <span className="text-slate-900 dark:text-white font-bold">{tx.new_stock}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {tx.reason}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {tx.adjusted_by}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No audit transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL (PORTALIZED) */}
      {isAdjustModalOpen && selectedProduct && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsAdjustModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Adjust Stock Level</h3>
                <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{selectedProduct.name}</p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="inventoryAdjustForm" onSubmit={handleAdjustSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Adjustment Action</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="RESTOCK">Supplier Restock (Add Stock)</option>
                  <option value="DAMAGE">Damaged / Expired / Written Off (Deduct Stock)</option>
                  <option value="SET">Physical Count Reconciliation (Set Exact)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Reason / Note</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received PO-8902 from Agro Staples"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="inventoryAdjustForm"
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Confirm Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
