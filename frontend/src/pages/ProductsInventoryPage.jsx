import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  Boxes, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  CheckCircle2,
  Tag, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  TrendingUp, 
  Layers, 
  Barcode, 
  Check, 
  Copy,
  History,
  ArrowRight,
  SlidersHorizontal,
  DollarSign,
  AlertCircle,
  Truck
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUploadPicker from '../components/ImageUploadPicker';

const PRODUCT_PRESETS = [
  { label: 'Grains & Rice', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=80' },
  { label: 'Dairy & Milk', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=80' },
  { label: 'Snacks & Food', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d628169a?w=200&auto=format&fit=crop&q=80' },
  { label: 'Fresh Produce', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200&auto=format&fit=crop&q=80' },
  { label: 'Beverages', url: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&auto=format&fit=crop&q=80' },
  { label: 'Personal Care', url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=200&auto=format&fit=crop&q=80' }
];

const CATEGORY_PRESETS = [
  { name: 'Dairy & Eggs', code: 'DAIR' },
  { name: 'Grains & Pulses', code: 'GRAN' },
  { name: 'Bakery & Snacks', code: 'BAKE' },
  { name: 'Fresh Fruits & Veg', code: 'VEG' },
  { name: 'Beverages & Juices', code: 'BEV' },
  { name: 'Personal & Health', code: 'CARE' },
  { name: 'Frozen Foods', code: 'FRZN' },
  { name: 'Spices & Condiments', code: 'SPIC' }
];

/**
 * A product can only be low stock against a threshold it actually has.
 * The previous `min_stock_level || 10` gave every product without a recorded
 * threshold an invented one, which disagreed with the backend's
 * `inventoryController` — and `item.min_stock_level * 3` produced `NaN` in the
 * stock-bar width once the threshold could genuinely be absent.
 */
const hasBreachedThreshold = (item) =>
  item?.min_stock_level != null &&
  Number(item.stock_quantity || 0) <= Number(item.min_stock_level);

/** Threshold for display; `null` renders as an em dash, not an invented 10. */
const thresholdLabel = (item) =>
  item?.min_stock_level != null ? item.min_stock_level : '—';

/**
 * How a ledger entry moved stock, for display.
 *
 * The audit log used to render every non-RESTOCK row with a leading `-`, so a
 * SET reconciliation (a physical count that *sets* the balance) and an OPENING
 * balance both displayed as deductions, and a restock logged as `IN` displayed
 * as one too. Direction is a property of the type, not of "is it RESTOCK".
 */
const MOVEMENT_IN = ['RESTOCK', 'IN', 'OPENING'];
const MOVEMENT_OUT = ['SALE', 'OUT', 'DAMAGE'];
const MOVEMENT_NEUTRAL = ['SET', 'ADJUSTMENT'];

const movementOf = (tx) => {
  const type = tx?.adjustment_type || tx?.type || '';
  if (MOVEMENT_IN.includes(type)) return 'in';
  if (MOVEMENT_OUT.includes(type)) return 'out';
  if (MOVEMENT_NEUTRAL.includes(type)) return 'neutral';
  return 'unknown';
};

/** Signed quantity for display: `+5`, `-3`, or `=12` for a re-baseline. */
const signedQuantity = (tx) => {
  const qty = Number(tx?.quantity) || 0;
  switch (movementOf(tx)) {
    case 'in':
      return `+${qty}`;
    case 'out':
      return `-${qty}`;
    case 'neutral':
      return `=${qty}`;
    default:
      return `${qty}`;
  }
};

/** Tailwind classes for the type badge, keyed off the same direction. */
const movementBadgeClass = (tx) => {
  switch (movementOf(tx)) {
    case 'in':
      return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-transparent';
    case 'out':
      return 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-transparent';
    case 'neutral':
      return 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-transparent';
    default:
      return 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-transparent';
  }
};


export default function ProductsInventoryPage({ 
  initialSubTab = 'catalog', 
  quickActionTrigger, 
  isNewModalOpen: propIsNewModalOpen, 
  onConsumeQuickAction 
}) {
  const { hasPermission } = useAuth();

  // Active top-level subtab: 'catalog' | 'inventory' | 'audit' | 'purchase-orders'
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || 'catalog');

  // Shared / Catalog States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [catalogViewMode, setCatalogViewMode] = useState('grid'); // 'grid' | 'normal'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'low_stock' | 'high_margin'
  const [copiedSku, setCopiedSku] = useState(null);

  // Inventory & Audit States
  const [inventorySummary, setInventorySummary] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventoryViewMode, setInventoryViewMode] = useState('grid'); // 'grid' | 'table'
  const [auditFilterType, setAuditFilterType] = useState('ALL');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');

  // Purchase Order States
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poSummary, setPoSummary] = useState(null);
  const [poStatusFilter, setPoStatusFilter] = useState('ALL');
  const [receivingPoId, setReceivingPoId] = useState(null);
  const [poMessage, setPoMessage] = useState(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', code: '', description: '' });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeleting, setCategoryDeleting] = useState(null);

  // Product Add / Edit Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    supplier_id: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: 10,
    unit: 'Units',
    image_url: '',
    barcode: '',
    description: ''
  });

  // Stock Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedAdjustProduct, setSelectedAdjustProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('RESTOCK');
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Supplier shipment received');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Load all data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, supRes, invRes, txRes, poRes] = await Promise.allSettled([
        api.get('/products'),
        api.get('/products/categories'),
        api.get('/suppliers'),
        api.get('/inventory/status'),
        api.get('/inventory/transactions'),
        api.get('/inventory/purchase-orders')
      ]);

      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data?.products || []);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data?.categories || []);
      if (supRes.status === 'fulfilled') setSuppliers(supRes.value.data?.suppliers || []);
      if (invRes.status === 'fulfilled') {
        setInventorySummary(invRes.value.data?.summary || null);
        setInventoryItems(invRes.value.data?.inventory || []);
      }
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data?.transactions || []);
      if (poRes.status === 'fulfilled') {
        setPurchaseOrders(poRes.value.data?.purchase_orders || []);
        setPoSummary(poRes.value.data?.summary || null);
      }
    } catch (err) {
      console.error('Error loading products & inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (quickActionTrigger?.page === 'products' || propIsNewModalOpen) {
      setActiveSubTab('catalog');
      handleOpenAddProduct();
      if (onConsumeQuickAction) onConsumeQuickAction();
    } else if (quickActionTrigger?.page === 'inventory') {
      setActiveSubTab('inventory');
      if (onConsumeQuickAction) onConsumeQuickAction();
    }
  }, [quickActionTrigger, propIsNewModalOpen]);

  // Product Modal Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    const autoSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    setProductFormData({
      name: '',
      sku: autoSku,
      category_id: categories[0]?.id || '',
      supplier_id: suppliers[0]?.id || '',
      cost_price: '',
      selling_price: '',
      stock_quantity: '',
      min_stock_level: 10,
      unit: 'Units',
      image_url: '',
      barcode: autoBarcode,
      description: ''
    });
    setIsProductModalOpen(true);
  };

  const handleGenerateSku = () => {
    const randomSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    setProductFormData(prev => ({
      ...prev,
      sku: randomSku,
      barcode: randomBarcode
    }));
  };

  const handleOpenEditProduct = (p) => {
    setEditingProduct(p);
    setProductFormData({
      name: p.name || '',
      sku: p.sku || '',
      category_id: p.category_id || '',
      supplier_id: p.supplier_id || '',
      cost_price: p.cost_price ?? '',
      selling_price: p.selling_price ?? '',
      stock_quantity: p.stock_quantity ?? '',
      min_stock_level: p.min_stock_level ?? '',
      unit: p.unit || 'Units',
      image_url: p.image_url || '',
      barcode: p.barcode || '',
      description: p.description || ''
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, productFormData);
      } else {
        await api.post('/products', productFormData);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product to database');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product from the database?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchAllData();
    } catch (err) {
      alert('Error deleting product');
    }
  };

  // Category Handlers
  const handleOpenAddCategory = () => {
    setCategoryFormData({ name: '', code: '', description: '' });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) return;
    setCategorySaving(true);
    try {
      const res = await api.post('/products/categories', categoryFormData);
      setIsCategoryModalOpen(false);
      setCategoryFormData({ name: '', code: '', description: '' });
      await fetchAllData();
      if (res.data?.category?.id) {
        setSelectedCategory(res.data.category.id);
        if (isProductModalOpen) {
          setProductFormData(prev => ({ ...prev, category_id: res.data.category.id }));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating category in database');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (e, cat) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?\nProducts under this category will have their category reset to "General".`)) {
      return;
    }
    setCategoryDeleting(cat.id);
    try {
      await api.delete(`/products/categories/${cat.id}`);
      if (selectedCategory === cat.id) {
        setSelectedCategory('');
      }
      await fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting category');
    } finally {
      setCategoryDeleting(null);
    }
  };

  const handleCopySku = (sku) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  // Stock Adjustment Handlers
  const handleOpenAdjustStock = (prod) => {
    setSelectedAdjustProduct(prod);
    setAdjustType('RESTOCK');
    setAdjustQty('10');
    setAdjustReason('Direct warehouse restock');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAdjustProduct) return;
    setAdjustSaving(true);
    try {
      await api.post('/inventory/adjust', {
        product_id: selectedAdjustProduct.id,
        adjustment_type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason
      });
      setIsAdjustModalOpen(false);
      fetchAllData();
      alert(`Stock for ${selectedAdjustProduct.name} updated successfully in database!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error adjusting stock in database');
    } finally {
      setAdjustSaving(false);
    }
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  /**
   * Mark a purchase order as received. This is the step that actually moves
   * stock — placing an order only says goods are expected.
   */
  const handleReceivePurchaseOrder = async (order) => {
    if (!window.confirm(
      `Receive ${order.quantity} × ${order.product_name} against ${order.id}?\n\n` +
      'This adds the quantity to stock and writes a RESTOCK entry to the audit log.'
    )) return;

    setReceivingPoId(order.id);
    setPoMessage(null);
    try {
      const res = await api.post(`/inventory/purchase-orders/${order.id}/receive`);
      setPoMessage({ ok: true, message: res.data?.message || `${order.id} received.` });
      fetchAllData();
    } catch (err) {
      setPoMessage({
        ok: false,
        message: err.response?.data?.message || `Could not receive ${order.id}.`
      });
    } finally {
      setReceivingPoId(null);
    }
  };

  // Filter Purchase Orders
  const filteredPurchaseOrders = purchaseOrders.filter(po =>
    poStatusFilter === 'ALL' ? true : po.status === poStatusFilter
  );

  // Filter Catalog Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    
    let matchesType = true;
    if (filterType === 'low_stock') {
      matchesType = hasBreachedThreshold(p);
    } else if (filterType === 'high_margin') {
      const margin = ((p.selling_price - p.cost_price) / (p.selling_price || 1)) * 100;
      matchesType = margin >= 30;
    }

    return matchesSearch && matchesCat && matchesType;
  });

  // Filter Audit Transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.product_name?.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                          tx.reason?.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                          tx.adjusted_by?.toLowerCase().includes(auditSearchTerm.toLowerCase());
    const matchesType = auditFilterType === 'ALL'
      ? true
      : (tx.adjustment_type || tx.type) === auditFilterType;
    return matchesSearch && matchesType;
  });

  // Margin calculation for product form
  const formCost = parseFloat(productFormData.cost_price) || 0;
  const formPrice = parseFloat(productFormData.selling_price) || 0;
  const formMargin = formPrice > 0 ? Math.round(((formPrice - formCost) / formPrice) * 100) : 0;
  const formProfit = formPrice - formCost;

  // Stock KPI counts
  const lowStockCount = inventorySummary?.low_stock_count ?? products.filter(hasBreachedThreshold).length;
  const totalValuation = inventorySummary?.total_inventory_value ?? products.reduce((acc, p) => acc + (p.stock_quantity * p.cost_price), 0);
  const totalRetail = inventorySummary?.total_retail_value ?? products.reduce((acc, p) => acc + (p.stock_quantity * p.selling_price), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Integrated Subtab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <span>Products & Inventory</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Unified product catalog, warehouse stock tracking, safety buffers, stock adjustments, and audit logs.
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Subtab Navigation Pill Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs font-semibold shadow-inner">
            <button
              onClick={() => setActiveSubTab('catalog')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'catalog'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/25 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Product Catalog</span>
            </button>

            <button
              onClick={() => setActiveSubTab('inventory')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'inventory'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/25 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Stock & Levels</span>
            </button>

            <button
              onClick={() => setActiveSubTab('purchase-orders')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'purchase-orders'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/25 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Purchase Orders</span>
              {poSummary?.ordered > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                  {poSummary.ordered}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('audit')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'audit'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/25 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit History</span>
            </button>
          </div>

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Sync all data from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {hasPermission('Admin') && (
            <button
              onClick={handleOpenAddProduct}
              className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Active SKUs</p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {products.length} Products
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200 dark:border-brand-800/50">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Inventory Valuation (Cost)</p>
            <h3 className="text-xl font-extrabold text-brand-600 dark:text-brand-400 font-mono mt-1">
              {formatCurrency(totalValuation)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/50">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Retail Potential</p>
            <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {formatCurrency(totalRetail)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveSubTab('catalog');
            setFilterType('low_stock');
          }}
          className={`glass-panel p-4 rounded-2xl border bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${
            lowStockCount > 0 
              ? 'border-amber-300 dark:border-amber-800/60 hover:bg-amber-50/40 dark:hover:bg-amber-950/20' 
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Low Stock / Alerts</p>
            <h3 className={`text-xl font-extrabold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {lowStockCount} Items
            </h3>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            lowStockCount > 0 
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' 
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PRODUCT CATALOG SUBTAB                                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-4">
          {/* Category Tabs & Quick Filter Row */}
          <div className="space-y-3">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none flex-nowrap">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedCategory === ''
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                All Categories ({products.length})
              </button>
              
              {categories.map((cat) => {
                const count = products.filter(p => p.category_id === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                const isDeleting = categoryDeleting === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`group shrink-0 inline-flex items-center rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/20'
                        : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCategory(cat.id)}
                      className="pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 focus:outline-none"
                    >
                      <span>{cat.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-brand-700 text-brand-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    </button>

                    {hasPermission('Admin') && (
                      <button
                        onClick={(e) => handleDeleteCategory(e, cat)}
                        disabled={isDeleting}
                        className={`p-1 mr-1 rounded-lg transition-colors ${
                          isSelected
                            ? 'hover:bg-brand-700 text-brand-200 hover:text-white'
                            : 'opacity-40 group-hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                        title={`Delete category "${cat.name}"`}
                      >
                        {isDeleting ? (
                          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}

              {hasPermission('Admin') && (
                <button
                  onClick={handleOpenAddCategory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border border-dashed border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="Add New Category"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              )}
            </div>

            {/* Filter Toolbar & View Switcher */}
            <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterType === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    onClick={() => setFilterType('low_stock')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                      filterType === 'low_stock' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Low Stock</span>
                  </button>
                  <button
                    onClick={() => setFilterType('high_margin')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                      filterType === 'high_margin' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>High Margin</span>
                  </button>
                </div>

                {/* Grid / Table switch */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setCatalogViewMode('grid')}
                    className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold ${
                      catalogViewMode === 'grid'
                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grid</span>
                  </button>
                  <button
                    onClick={() => setCatalogViewMode('normal')}
                    className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold ${
                      catalogViewMode === 'normal'
                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  <span className="font-bold text-slate-900 dark:text-white">{filteredProducts.length}</span> items
                </div>
              </div>
            </div>
          </div>

          {/* Catalog Grid View */}
          {catalogViewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map((prod) => {
                const isLowStock = hasBreachedThreshold(prod);
                const isOutOfStock = prod.stock_quantity === 0;
                const margin = Math.round(((prod.selling_price - prod.cost_price) / (prod.selling_price || 1)) * 100);
                const profit = prod.selling_price - prod.cost_price;

                return (
                  <div 
                    key={prod.id} 
                    className="group glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between overflow-hidden hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
                  >
                    {/* Image Section */}
                    <div className="relative h-28 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                      <img 
                        src={prod.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'} 
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                      {/* Stock Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-md border ${
                          isOutOfStock
                            ? 'bg-rose-500/90 text-white border-rose-400'
                            : isLowStock
                            ? 'bg-amber-500/90 text-white border-amber-400 animate-pulse'
                            : 'bg-emerald-500/90 text-white border-emerald-400'
                        }`}>
                          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>

                      {/* SKU Pill */}
                      <div className="absolute top-3 left-3">
                        <button
                          onClick={() => handleCopySku(prod.sku)}
                          className="flex items-center gap-1 text-[10px] font-mono font-bold text-white bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20 hover:bg-slate-900 transition-colors"
                          title="Click to copy SKU"
                        >
                          <span>{prod.sku}</span>
                          {copiedSku === prod.sku ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-slate-400" />}
                        </button>
                      </div>

                      {/* Bottom Image Overlay: Category */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                        <span className="text-[11px] font-semibold text-white/90 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                          {prod.category_name || 'General'}
                        </span>
                        <span className="text-[11px] text-white/80 font-mono">
                          {prod.unit}
                        </span>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {prod.name}
                        </h3>
                        {prod.description && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {prod.description}
                          </p>
                        )}
                      </div>

                      {/* Pricing Matrix */}
                      <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Retail Price</div>
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                              {formatCurrency(prod.selling_price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Stock Available</div>
                            <div className={`text-sm font-extrabold font-mono ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {prod.stock_quantity} <span className="text-[9px] font-normal text-slate-500">{prod.unit}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400 text-[9px]">Cost: {formatCurrency(prod.cost_price)}</span>
                          <span className="font-bold text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                            +{margin}% (+{formatCurrency(profit)})
                          </span>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        {hasPermission('Manager') && (
                          <button
                            onClick={() => handleOpenAdjustStock(prod)}
                            className="flex-1 py-1 px-2 rounded-lg bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                            title="Restock or adjust stock"
                          >
                            <Boxes className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                        )}

                        {hasPermission('Admin') && (
                          <>
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                              title="Edit Product details"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Catalog Table View */}
          {catalogViewMode === 'normal' && (
            <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Product</th>
                      <th className="py-3 px-4 font-bold">SKU</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 text-right font-bold">Cost</th>
                      <th className="py-3 px-4 text-right font-bold">Selling Price</th>
                      <th className="py-3 px-4 text-right font-bold">Margin</th>
                      <th className="py-3 px-4 text-center font-bold">Stock</th>
                      <th className="py-3 px-4 text-center font-bold">Status</th>
                      <th className="py-3 px-4 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                    {filteredProducts.map((p) => {
                      const isLowStock = hasBreachedThreshold(p);
                      const isOutOfStock = p.stock_quantity === 0;
                      const margin = Math.round(((p.selling_price - p.cost_price) / (p.selling_price || 1)) * 100);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100'}
                                alt={p.name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-xs">{p.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{p.unit}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-brand-600 dark:text-brand-400">
                            {p.sku}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                              {p.category_name || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(p.cost_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(p.selling_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{margin}%
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            <span className={isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOutOfStock
                                ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                                : isLowStock
                                ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            }`}>
                              {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'OK'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasPermission('Manager') && (
                                <button
                                  onClick={() => handleOpenAdjustStock(p)}
                                  className="px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 text-[10px] font-bold border border-brand-200 dark:border-brand-800/60 transition-colors"
                                  title="Restock / Adjust Stock"
                                >
                                  Adjust
                                </button>
                              )}
                              {hasPermission('Admin') && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditProduct(p)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INVENTORY STOCK LEVELS SUBTAB                                         */}
      {/* ========================================================================= */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          {/* Subheader & View Switcher */}
          <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter stock by product name, SKU, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setInventoryViewMode('grid')}
                  className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold ${
                    inventoryViewMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Card View</span>
                </button>
                <button
                  onClick={() => setInventoryViewMode('table')}
                  className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold ${
                    inventoryViewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Table View</span>
                </button>
              </div>
            </div>
          </div>

          {/* Inventory Grid View */}
          {inventoryViewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(inventoryItems.length > 0 ? inventoryItems : products).filter(item => {
                return item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
              }).map((item) => {
                const isOut = (item.status === 'Out of Stock') || item.stock_quantity === 0;
                const isLow = (item.status === 'Low Stock') || hasBreachedThreshold(item);
                const stockPct = Math.min(100, Math.round((item.stock_quantity / Math.max(Number(item.min_stock_level || 0) * 3, 1)) * 100));
                const stockVal = item.stock_value || (item.stock_quantity * item.cost_price);

                return (
                  <div key={item.id} className="group glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col overflow-hidden hover:border-brand-500/40 hover:shadow-lg transition-all">
                    {/* Image */}
                    <div className="relative h-24 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                      <img 
                        src={item.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'} 
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300'; }} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOut ? 'bg-rose-500 text-white' : isLow ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-500 text-white'
                      }`}>{isOut ? 'Out' : isLow ? 'Low' : 'OK'}</span>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{item.sku} • {item.category_name || 'General'}</div>
                      </div>

                      {/* Stock Bar */}
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className={`font-bold ${isOut ? 'text-rose-500' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {item.stock_quantity} {item.unit || 'Units'}
                          </span>
                          <span className="text-slate-400 font-mono">min: {thresholdLabel(item)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} 
                            style={{ width: `${stockPct}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-slate-400 font-semibold uppercase">Valuation</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(stockVal)}</span>
                      </div>

                      {hasPermission('Manager') && (
                        <button 
                          onClick={() => handleOpenAdjustStock(item)}
                          className="mt-1 w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 text-[10px] font-bold transition-all"
                        >
                          ⚡ Adjust / Restock
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Inventory Table View */
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Product SKU</th>
                      <th className="px-5 py-3.5 font-bold">Product Name</th>
                      <th className="px-5 py-3.5 font-bold">Category</th>
                      <th className="px-5 py-3.5 font-bold">Current Stock</th>
                      <th className="px-5 py-3.5 font-bold">Safety Buffer</th>
                      <th className="px-5 py-3.5 font-bold">Holding Cost Value</th>
                      <th className="px-5 py-3.5 font-bold">Status</th>
                      {hasPermission('Manager') && (
                        <th className="px-5 py-3.5 text-right font-bold">Stock Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                    {(inventoryItems.length > 0 ? inventoryItems : products).filter(item => {
                      return item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             item.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
                    }).map((item) => {
                      const isLow = hasBreachedThreshold(item);
                      const isOut = item.stock_quantity === 0;
                      const stockVal = item.stock_value || (item.stock_quantity * item.cost_price);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 font-mono font-semibold text-brand-600 dark:text-brand-400">{item.sku}</td>
                          <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.category_name || 'General'}</td>
                          <td className="px-5 py-4 font-mono font-bold text-sm">
                            <span className={isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}>
                              {item.stock_quantity} {item.unit || 'Units'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-mono">
                            {item.min_stock_level != null
                              ? `${item.min_stock_level} ${item.unit || 'Units'}`
                              : '—'}
                          </td>
                          <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-300">{formatCurrency(stockVal)}</td>
                          <td className="px-5 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isOut ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                              : isLow ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            }`}>
                              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          {hasPermission('Manager') && (
                            <td className="px-5 py-4 text-right">
                              <button 
                                onClick={() => handleOpenAdjustStock(item)}
                                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/30 text-xs font-semibold transition-all"
                              >
                                Adjust / Restock
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PURCHASE ORDERS SUBTAB                                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'purchase-orders' && (
        <div className="space-y-4">
          {poMessage && (
            <div className={`p-3 rounded-2xl border text-xs font-medium ${
              poMessage.ok
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
            }`}>
              {poMessage.message}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Orders on record', poSummary?.total ?? 0, 'text-slate-900 dark:text-white'],
              ['Awaiting delivery', poSummary?.ordered ?? 0, 'text-amber-600 dark:text-amber-400'],
              ['Received', poSummary?.received ?? 0, 'text-emerald-600 dark:text-emerald-400'],
              ['Value on order', formatCurrency(poSummary?.on_order_value ?? 0), 'text-brand-600 dark:text-brand-400']
            ].map(([label, value, tone]) => (
              <div key={label} className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">{label}</div>
                <div className={`text-xl font-extrabold mt-1 font-mono ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Truck className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>
                A purchase order records that stock was <strong>ordered</strong>. Stock only moves
                when the order is <strong>received</strong>, which also writes a RESTOCK entry to
                the audit log.
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {['ALL', 'ORDERED', 'RECEIVED', 'CANCELLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setPoStatusFilter(s)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                    poStatusFilter === s
                      ? 'bg-brand-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {filteredPurchaseOrders.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center">
              <Truck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No orders match this filter'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {purchaseOrders.length === 0
                  ? 'Order from a restock recommendation on the Forecasting → Demand tab, or record a delivery with Adjust Stock.'
                  : 'Try a different status filter.'}
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Order</th>
                      <th className="px-5 py-3.5 font-bold">Product</th>
                      <th className="px-5 py-3.5 font-bold">Quantity</th>
                      <th className="px-5 py-3.5 font-bold">Value</th>
                      <th className="px-5 py-3.5 font-bold">Ordered</th>
                      <th className="px-5 py-3.5 font-bold">Expected</th>
                      <th className="px-5 py-3.5 font-bold">Status</th>
                      <th className="px-5 py-3.5 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                    {filteredPurchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-white">
                          {po.id}
                          {po.trigger && (
                            <span className="block text-[10px] font-normal text-slate-400">{po.trigger}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold">{po.product_name}</td>
                        <td className="px-5 py-4 font-mono font-bold">{po.quantity}</td>
                        <td className="px-5 py-4 font-mono">
                          {formatCurrency((po.quantity || 0) * (po.unit_cost || 0))}
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-400">{po.ordered_at}</td>
                        <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-400">
                          {po.received_at
                            ? <span className="text-emerald-600 dark:text-emerald-400">received {po.received_at}</span>
                            : po.expected_at}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                              : po.status === 'CANCELLED'
                              ? 'bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30'
                              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {po.status === 'ORDERED' ? (
                            <button
                              onClick={() => handleReceivePurchaseOrder(po)}
                              disabled={receivingPoId === po.id}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] shadow transition-all disabled:opacity-50"
                            >
                              {receivingPoId === po.id ? 'Receiving...' : 'Receive'}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY AUDIT LOGS SUBTAB                                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Toolbar */}
          <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail by product, reason, or staff..."
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['ALL', 'OPENING', 'RESTOCK', 'SALE', 'DAMAGE', 'SET'].map((t) => (
                <button
                  key={t}
                  onClick={() => setAuditFilterType(t)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                    auditFilterType === t
                      ? 'bg-brand-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t === 'ALL' ? 'All Types' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Inventory Movement & Stock Adjustment Audit Ledger</span>
              <span className="font-mono text-slate-400 font-normal">{filteredTransactions.length} Recorded Movements</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-bold">Timestamp</th>
                    <th className="px-5 py-3 font-bold">Product</th>
                    <th className="px-5 py-3 font-bold">Movement Type</th>
                    <th className="px-5 py-3 font-bold">Delta Qty</th>
                    <th className="px-5 py-3 font-bold">Stock Before → After</th>
                    <th className="px-5 py-3 font-bold">Reason / Reference</th>
                    <th className="px-5 py-3 font-bold">Adjusted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                        {tx.product_name}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${movementBadgeClass(tx)}`}>
                          {tx.adjustment_type || tx.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3 font-mono font-bold ${
                        movementOf(tx) === 'in'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : movementOf(tx) === 'out'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {signedQuantity(tx)}
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
                  {filteredTransactions.length === 0 && (
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL (PORTALIZED)                                    */}
      {/* ========================================================================= */}
      {isProductModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsProductModalOpen(false)} />

          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${editingProduct ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'}`}>
                  {editingProduct ? <Edit className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {editingProduct ? 'Edit Product SKU' : 'Add New Product to Catalog'}
                    </h3>
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/40">
                      PostgreSQL Live
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingProduct 
                      ? `Updating existing product "${editingProduct.name}". Changes apply immediately to POS and stock inventory.`
                      : 'Configure SKU details, pricing matrix, supplier association, and live inventory quantities.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="productForm" onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Product Photo Uploader Component */}
              <ImageUploadPicker
                label="Product Visual Photo / Image"
                value={productFormData.image_url}
                onChange={(url) => setProductFormData(prev => ({ ...prev, image_url: url }))}
                presets={PRODUCT_PRESETS}
                folder="products"
              />

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                    Product Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Basmati Rice (5kg Premium)"
                    value={productFormData.name}
                    onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                      Stock Keeping Unit (SKU) *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold"
                    >
                      ⚡ Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-1049"
                    value={productFormData.sku}
                    onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                    Barcode / EAN-13 (Optional)
                  </label>
                  <div className="relative mt-1">
                    <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 8901030382910"
                      value={productFormData.barcode}
                      onChange={(e) => setProductFormData({ ...productFormData, barcode: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                      Product Category *
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenAddCategory}
                      className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    required
                    value={productFormData.category_id}
                    onChange={(e) => setProductFormData({ ...productFormData, category_id: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 transition-colors"
                  >
                    <option value="" disabled>Select a Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                    Assigned Supplier (Optional)
                  </label>
                  <select
                    value={productFormData.supplier_id}
                    onChange={(e) => setProductFormData({ ...productFormData, supplier_id: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 transition-colors"
                  >
                    <option value="">No specific supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Profit Matrix */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-bold text-[11px] text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Pricing & Profit Margins</span>
                  {formPrice > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${formProfit >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-rose-100 text-rose-700'}`}>
                      Estimated Margin: {formMargin}% (+₹{formProfit.toFixed(2)})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold text-[10px] uppercase">Cost Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={productFormData.cost_price}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_price: e.target.value })}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-semibold text-[10px] uppercase">Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={productFormData.selling_price}
                      onChange={(e) => setProductFormData({ ...productFormData, selling_price: e.target.value })}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-brand-600 dark:text-brand-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-semibold text-[10px] uppercase">Stock Quantity *</label>
                    <input
                      type="number"
                      required
                      placeholder="0"
                      value={productFormData.stock_quantity}
                      onChange={(e) => setProductFormData({ ...productFormData, stock_quantity: e.target.value })}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-semibold text-[10px] uppercase">Unit of Measure</label>
                    <select
                      value={productFormData.unit}
                      onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    >
                      <option value="Units">Units / Pcs</option>
                      <option value="Kg">Kilograms (Kg)</option>
                      <option value="Gram">Grams (g)</option>
                      <option value="Ltr">Liters (Ltr)</option>
                      <option value="Pack">Packs</option>
                      <option value="Box">Boxes</option>
                      <option value="Bottle">Bottles</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold text-[10px] uppercase">Min Safety Stock Level (Alert Threshold)</label>
                  <input
                    type="number"
                    value={productFormData.min_stock_level}
                    onChange={(e) => setProductFormData({ ...productFormData, min_stock_level: e.target.value })}
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">
                  Product Notes & Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional product details, batch instructions, or storage requirements..."
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="productForm"
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {editingProduct ? 'Update Product SKU' : 'Save Product to Catalog'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* CATEGORY MANAGEMENT MODAL (PORTALIZED)                                   */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Create New Category</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Organize and group your inventory catalog</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="categoryForm" onSubmit={handleSaveCategory} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Quick Suggestions</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CATEGORY_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => setCategoryFormData({ name: preset.name, code: preset.code, description: '' })}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Pulses & Flours"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Category Code (Short)</label>
                <input
                  type="text"
                  placeholder="e.g. PULS"
                  value={categoryFormData.code}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value.toUpperCase() })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. All packaged grains, lentils, pulses, and flours"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="categoryForm"
                type="submit"
                disabled={categorySaving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {categorySaving ? 'Saving...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* STOCK ADJUSTMENT MODAL (PORTALIZED)                                      */}
      {/* ========================================================================= */}
      {isAdjustModalOpen && selectedAdjustProduct && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsAdjustModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Adjust Stock Level</h3>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{selectedAdjustProduct.name}</p>
                </div>
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
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Current Stock on Record:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{selectedAdjustProduct.stock_quantity} {selectedAdjustProduct.unit || 'Units'}</span>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Adjustment Operation</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="RESTOCK">Supplier Restock In (Add Stock +)</option>
                  <option value="DAMAGE">Damaged / Expired / Write-off (Deduct Stock -)</option>
                  <option value="SET">Physical Count Reconciliation (Set Exact Value =)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Audit Reason / Shipment Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received PO-8902 from Agro Staples or damaged during transit"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
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
                disabled={adjustSaving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {adjustSaving ? 'Updating...' : 'Confirm Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
