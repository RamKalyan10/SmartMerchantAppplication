import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Truck, Plus, Phone, Mail, Clock, MapPin, X, RefreshCw, Building2, Package, ShoppingCart, Send, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import api from '../services/api';
import ImageUploadPicker from '../components/ImageUploadPicker';
import { useAuth } from '../context/AuthContext';

const SUPPLIER_PRESET_LOGOS = [
  { label: 'Warehouse & FMCG', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=150&auto=format&fit=crop&q=80' },
  { label: 'Beverage & Foods', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=150&auto=format&fit=crop&q=80' },
  { label: 'Tech & Hardware', url: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=150&auto=format&fit=crop&q=80' },
  { label: 'Corporate & Agro', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=80' }
];

export default function SuppliersPage({ quickActionTrigger, isNewModalOpen: propIsNewModalOpen, onConsumeQuickAction }) {
  const { hasPermission } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSup, setExpandedSup] = useState(null);

  // Purchase Order modal state
  const [poSupplier, setPoSupplier] = useState(null);
  const [poItems, setPoItems] = useState({});
  const [poNote, setPoNote] = useState('');
  const [poSent, setPoSent] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [leadTime, setLeadTime] = useState('3');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products')
      ]);
      setSuppliers(supRes.data?.suppliers || []);
      setProducts(prodRes.data?.products || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (quickActionTrigger?.page === 'suppliers' || propIsNewModalOpen) {
      handleOpenAdd();
      if (onConsumeQuickAction) onConsumeQuickAction();
    }
  }, [quickActionTrigger, propIsNewModalOpen]);

  const getSupplierProducts = (supId) => products.filter(p => p.supplier_id === supId);

  const openPO = (sup) => {
    setPoSupplier(sup);
    const init = {};
    getSupplierProducts(sup.id).forEach(p => { init[p.id] = 0; });
    setPoItems(init);
    setPoNote('');
    setPoSent(false);
  };

  const togglePoItem = (pid) => setPoItems(prev => ({ ...prev, [pid]: prev[pid] > 0 ? 0 : 1 }));
  const updatePoQty = (pid, val) => setPoItems(prev => ({ ...prev, [pid]: Math.max(0, parseInt(val, 10) || 0) }));

  const handleSendPO = () => {
    if (!poSupplier) return;
    const selected = poSupplier ? getSupplierProducts(poSupplier.id).filter(p => (poItems[p.id] || 0) > 0) : [];
    if (selected.length === 0) { alert('Select at least one product with quantity > 0.'); return; }
    const subject = encodeURIComponent(`Purchase Order Request — ${new Date().toLocaleDateString('en-IN')}`);
    const bodyLines = [
      `Dear ${poSupplier.contact_person || poSupplier.name},`,
      ``,
      `We would like to place the following purchase order:`,
      ``,
      ...selected.map(p => `  • ${p.name} (SKU: ${p.sku}) — Qty: ${poItems[p.id]} ${p.unit}`),
      ``,
      poNote ? `Additional Notes: ${poNote}` : ``,
      `Please confirm availability and expected delivery date.`,
      `Payment Terms: ${poSupplier.payment_terms || 'Net 30'}`,
      ``,
      `Thank you,`,
      `DWDM Merchant Store`
    ].join('\n');
    window.location.href = `mailto:${poSupplier.email}?subject=${subject}&body=${encodeURIComponent(bodyLines)}`;
    setPoSent(true);
  };

  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

  const handleOpenAdd = () => {
    setName(''); setContactPerson(''); setPhone(''); setEmail('');
    setLeadTime('3'); setAddress(''); setLogoUrl(''); setPaymentTerms('Net 30');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', {
        name, contact_person: contactPerson, phone, email,
        lead_time_days: Number(leadTime), address, logo_url: logoUrl,
        payment_terms: paymentTerms
      });
      setIsModalOpen(false);
      fetchData();
    } catch {
      alert('Error creating supplier in database');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Supplier & Vendor Network
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Wholesale distributor directory, lead times, procurement pipelines, and contacts stored in database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {hasPermission('Admin') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map((sup) => {
          const supProducts = getSupplierProducts(sup.id);
          const isExpanded = expandedSup === sup.id;
          const stockVal = supProducts.reduce((s, p) => s + p.cost_price * p.stock_quantity, 0);
          const lowCount = supProducts.filter(p => p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level)).length;
          return (
            <div key={sup.id} className="glass-panel rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">Verified Vendor</span>
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold"><Clock className="w-3.5 h-3.5" />{sup.lead_time_days || 3}d Lead</span>
                </div>
                <div className="flex items-start gap-3">
                  {sup.logo_url ? (
                    <img src={sup.logo_url} alt={sup.name} className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=150'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0"><Truck className="w-6 h-6" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{sup.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{sup.contact_person || 'Representative'}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{sup.phone || '—'}</span></div>
                  {sup.email && <div className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{sup.email}</span></div>}
                  {sup.address && <div className="flex items-center gap-2 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{sup.address}</span></div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700"><Package className="w-3.5 h-3.5" /> {supProducts.length} Products</span>
                  {stockVal > 0 && <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/40">{fmt(stockVal)}</span>}
                  {lowCount > 0 && <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-xl border border-amber-200 dark:border-amber-800/40 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {lowCount} Low</span>}
                  {sup.payment_terms && <span className="text-[11px] font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-lg border border-violet-200 dark:border-violet-800/40">{sup.payment_terms}</span>}
                </div>
              </div>

              {/* Expandable products */}
              {supProducts.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setExpandedSup(isExpanded ? null : sup.id)}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Supplied Products</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
                      {supProducts.map(p => {
                        const isLow = p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level);
                        return (
                          <div key={p.id} className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-100 dark:border-slate-700">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                              <img src={p.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=60'} alt={p.name} className="w-full h-full object-cover"
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=60'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{p.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{fmt(p.cost_price)}/unit</span>
                              </div>
                            </div>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${isLow ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                              {p.stock_quantity} {p.unit}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Footer actions */}
              <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button onClick={() => openPO(sup)} disabled={!sup.email}
                  title={!sup.email ? 'Add email to enable purchase orders' : 'Send purchase order request'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                  <ShoppingCart className="w-3.5 h-3.5" /> Request Stock
                </button>
                {sup.email && (
                  <a href={`mailto:${sup.email}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {suppliers.length === 0 && !loading && (
          <div className="col-span-3 text-center py-16 text-slate-400 text-xs">No supplier records found in database.</div>
        )}
      </div>

      {/* PURCHASE ORDER MODAL */}
      {poSupplier && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setPoSupplier(null)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"><Send className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Purchase Order Request</h3>
                  <p className="text-[11px] text-slate-500">To: <strong>{poSupplier.name}</strong> · {poSupplier.email}</p>
                </div>
              </div>
              <button onClick={() => setPoSupplier(null)} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {poSent ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
                  <div>
                    <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">Email Client Opened!</h4>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">The purchase order is pre-filled in your email app.<br/>Review and send it from your email client.</p>
                  </div>
                  <button onClick={() => setPoSupplier(null)} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:scale-[1.02] transition-all shadow-md">Done</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider mb-2 block">Select Products to Order</label>
                    {getSupplierProducts(poSupplier.id).length === 0 ? (
                      <div className="text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>No products linked to this supplier yet.</p>
                        <p className="text-[10px] mt-1">Assign this supplier to products in the Product Catalog.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {getSupplierProducts(poSupplier.id).map(p => {
                          const checked = (poItems[p.id] || 0) > 0;
                          const isLow = p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level);
                          return (
                            <div key={p.id} onClick={() => togglePoItem(p.id)}
                              className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${checked ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                              <input type="checkbox" readOnly checked={checked} className="w-4 h-4 rounded accent-violet-600 cursor-pointer shrink-0" />
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                <img src={p.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=60'} alt={p.name} className="w-full h-full object-cover"
                                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=60'; }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate">{p.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-slate-400 text-[10px]">{p.sku}</span>
                                  <span className="text-emerald-600 font-semibold text-[10px]">{fmt(p.cost_price)}</span>
                                  {isLow && <span className="text-amber-600 font-bold text-[10px] flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Low</span>}
                                </div>
                              </div>
                              {checked && (
                                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                  <input type="number" min="1" value={poItems[p.id] || 1} onChange={e => updatePoQty(p.id, e.target.value)}
                                    className="w-16 text-center border border-violet-300 dark:border-violet-700 rounded-xl px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-violet-500" />
                                  <span className="text-slate-400 text-[10px]">{p.unit}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {poSupplier && getSupplierProducts(poSupplier.id).filter(p => (poItems[p.id] || 0) > 0).length > 0 && (() => {
                    const sel = getSupplierProducts(poSupplier.id).filter(p => (poItems[p.id] || 0) > 0);
                    return (
                      <div className="bg-violet-50 dark:bg-violet-950/30 rounded-2xl p-4 border border-violet-200 dark:border-violet-800/40 space-y-1.5">
                        <div className="font-bold text-violet-700 dark:text-violet-300 text-[11px] uppercase tracking-wider mb-2">Order Summary</div>
                        {sel.map(p => (
                          <div key={p.id} className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="truncate max-w-[55%]">{p.name}</span>
                            <span className="font-mono font-bold">{poItems[p.id]} × {fmt(p.cost_price)} = <strong className="text-violet-700 dark:text-violet-300">{fmt(p.cost_price * poItems[p.id])}</strong></span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-extrabold text-violet-800 dark:text-violet-200 border-t border-violet-200 dark:border-violet-800/40 pt-2 mt-1">
                          <span>Total PO Value</span>
                          <span>{fmt(sel.reduce((s, p) => s + p.cost_price * (poItems[p.id] || 0), 0))}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">Additional Notes (Optional)</label>
                    <textarea rows="2" value={poNote} onChange={e => setPoNote(e.target.value)}
                      placeholder="Delivery instructions, packaging requirements, urgent notes..."
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 resize-none" />
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">Clicking <strong>"Send via Email"</strong> opens your default email client with the order pre-filled. Review and send from there.</p>
                  </div>
                </>
              )}
            </div>
            {!poSent && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
                <button onClick={() => setPoSupplier(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                <button onClick={handleSendPO}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Send className="w-3.5 h-3.5" /> Send via Email
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ADD SUPPLIER MODAL (PORTALIZED) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Add Supplier Vendor</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      ✨ NEW
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Save wholesale vendor and procurement contact in database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="supplierModalForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Supplier Name / Business *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex FMCG Distributors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              {/* Direct Logo Upload */}
              <ImageUploadPicker
                value={logoUrl}
                onChange={(img) => setLogoUrl(img)}
                label="Company Logo / Photo (Direct Upload)"
                presets={[
                  { label: 'Logistics', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=150' },
                  { label: 'Farm Agro', url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=150' },
                  { label: 'Dairy Hub', url: 'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=150' },
                  { label: 'Beverages', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=150' }
                ]}
                placeholderText="Upload supplier logo from computer (PNG, JPG, WebP)"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Vikas Gupta"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="+91 98220 11223"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="orders@supplier.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Payment Terms</label>
                  <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500">
                    <option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 60</option><option>COD</option><option>Advance</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Warehouse Address</label>
                  <input type="text" placeholder="Industrial Area Phase 2" value={address} onChange={(e) => setAddress(e.target.value)}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500" />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="supplierModalForm"
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
