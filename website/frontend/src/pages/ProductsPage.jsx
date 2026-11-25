import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Tag, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  TrendingUp, 
  Layers, 
  Barcode, 
  Check, 
  Copy
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

export default function ProductsPage({ quickActionTrigger, isNewModalOpen: propIsNewModalOpen, onConsumeQuickAction }) {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'normal'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'low_stock' | 'high_margin'
  const [copiedSku, setCopiedSku] = useState(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', code: '', description: '' });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeleting, setCategoryDeleting] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    supplier_id: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '',
    unit: 'Units',
    image_url: '',
    barcode: '',
    description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, supRes] = await Promise.all([
        api.get('/products'),
        api.get('/products/categories'),
        api.get('/suppliers')
      ]);
      setProducts(prodRes.data?.products || []);
      setCategories(catRes.data?.categories || []);
      setSuppliers(supRes.data?.suppliers || []);
    } catch (err) {
      console.error('Error loading products from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (quickActionTrigger?.page === 'products' || propIsNewModalOpen) {
      handleOpenAdd();
      if (onConsumeQuickAction) {
        onConsumeQuickAction();
      }
    }
  }, [quickActionTrigger, propIsNewModalOpen]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const autoSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    setFormData({
      name: '',
      sku: autoSku,
      category_id: categories[0]?.id || '',
      supplier_id: suppliers[0]?.id || '',
      cost_price: '',
      selling_price: '',
      stock_quantity: '',
      min_stock_level: '',
      unit: 'Units',
      image_url: '',
      barcode: autoBarcode,
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleGenerateSku = () => {
    const randomSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    setFormData(prev => ({
      ...prev,
      sku: randomSku,
      barcode: randomBarcode
    }));
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
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
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product to database');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product from the database?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (err) {
      alert('Error deleting product');
    }
  };

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
      await fetchData();
      if (res.data?.category?.id) {
        setSelectedCategory(res.data.category.id);
        if (isModalOpen) {
          setFormData(prev => ({ ...prev, category_id: res.data.category.id }));
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
      await fetchData();
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

  // Filter Logic
  const filtered = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    
    let matchesType = true;
    if (filterType === 'low_stock') {
      // A product with no recorded threshold has nothing to compare against, so
      // it cannot be low stock. The old `|| 10` invented one.
      matchesType = p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level);
    } else if (filterType === 'high_margin') {
      const margin = ((p.selling_price - p.cost_price) / (p.selling_price || 1)) * 100;
      matchesType = margin >= 30;
    }

    return matchesSearch && matchesCat && matchesType;
  });

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // Form Margin Calculation
  const formCost = parseFloat(formData.cost_price) || 0;
  const formPrice = parseFloat(formData.selling_price) || 0;
  const formMargin = formPrice > 0 ? Math.round(((formPrice - formCost) / formPrice) * 100) : 0;
  const formProfit = formPrice - formCost;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Product Catalog & SKU Master
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visual product catalog with direct photo uploads, live inventory tracking, and margin analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Dual View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode('normal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'normal'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Normal View</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {hasPermission('Admin') && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs & Quick Filter Row */}
      <div className="space-y-3">
        {/* Category Pills & Actions */}
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

        {/* Filter Toolbar */}
        <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
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

            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span> items
            </div>
          </div>
        </div>
      </div>

      {/* 1. VISUAL GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((prod) => {
            const isLowStock = prod.min_stock_level != null && Number(prod.stock_quantity || 0) <= Number(prod.min_stock_level);
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
                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {prod.name}
                    </h3>
                    {prod.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  {/* Pricing Matrix */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Retail Price</div>
                        <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                          {formatCurrency(prod.selling_price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500">Stock Available</div>
                        <div className={`text-base font-extrabold font-mono ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {prod.stock_quantity} <span className="text-[10px] font-normal text-slate-500">{prod.unit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Cost: {formatCurrency(prod.cost_price)}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                        Margin: +{margin}% (+{formatCurrency(profit)})
                      </span>
                    </div>
                  </div>

                  {/* Actions (Admin Only) */}
                  {hasPermission('Admin') && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        onClick={() => handleOpenEdit(prod)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(prod.id)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. NORMAL / LIST VIEW */}
      {viewMode === 'normal' && (
        <div className="glass-panel rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
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
                  {hasPermission('Admin') && <th className="py-3 px-4 text-right font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {filtered.map((p) => {
                  const isLowStock = p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level);
                  const isOutOfStock = p.stock_quantity === 0;
                  const margin = Math.round(((p.selling_price - p.cost_price) / (p.selling_price || 1)) * 100);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100'}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
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
                      {hasPermission('Admin') && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* ADD / EDIT PRODUCT MODAL (MOUNTED TO BODY VIA PORTAL) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          {/* Backdrop dismissal */}
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)} />

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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      editingProduct
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    }`}>
                      {editingProduct ? `EDITING: ${editingProduct.sku}` : '✨ NEW PRODUCT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingProduct
                      ? `Updating existing product "${editingProduct.name}". Changes apply immediately to POS and stock inventory.`
                      : 'Fill in product details and upload a photo directly to save to your database catalog.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="productModalForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Direct Image Upload Component */}
              <ImageUploadPicker
                value={formData.image_url}
                onChange={(img) => setFormData({ ...formData, image_url: img })}
                label="Product Photo / Visual Representation (Direct File Upload)"
                presets={PRODUCT_PRESETS}
                placeholderText="Click to upload product photo from computer (PNG, JPG, WebP)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="sm:col-span-2">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter product title (e.g. Royal Basmati Rice 25kg)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">SKU Code *</label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      🎲 Auto-Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-1001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Barcode / UPC</label>
                  <input
                    type="text"
                    placeholder="e.g. 890123456789"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Category *</label>
                    {hasPermission('Admin') && (
                      <button
                        type="button"
                        onClick={handleOpenAddCategory}
                        className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Category</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Preferred Supplier</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Cost Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Initial Stock *</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                {/* The inventory model uses this as the reorder floor, but the
                    form had no field for it — every product saved through this
                    screen was written with a hardcoded 10 and the merchant had
                    no way to set their own. */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Reorder Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Stock at or below this level is flagged. Leave blank for no alert.
                  </span>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Unit of Measure</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Units">Units (Pcs)</option>
                    <option value="Bags">Bags</option>
                    <option value="Packets">Packets</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Kg">Kilograms (Kg)</option>
                    <option value="Liters">Liters</option>
                    <option value="Boxes">Boxes</option>
                  </select>
                </div>
              </div>

              {/* Real-time Profit Preview */}
              {formPrice > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300 text-xs">Gross Margin & Profit:</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Profit: <strong className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(formProfit)}</strong></span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                      {formMargin}%
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Description</label>
                <textarea
                  rows="2"
                  placeholder="Optional product details, pack size, storage notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="productModalForm"
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {editingProduct ? 'Update Product' : 'Save New Product'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD CATEGORY MODAL (PORTALIZED) */}
      {isCategoryModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in text-left">
          <div className="fixed inset-0" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden z-10 my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Add Product Category</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Organize and group your inventory catalog</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form id="categoryModalForm" onSubmit={handleSaveCategory} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Quick Presets */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider mb-1.5 block">
                  Quick Suggestion Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCategoryFormData({ ...categoryFormData, name: preset.name, code: preset.code })}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spices & Condiments"
                  value={categoryFormData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoCode = val.trim().slice(0, 4).toUpperCase();
                    setCategoryFormData(prev => ({
                      ...prev,
                      name: val,
                      code: prev.code ? prev.code : autoCode
                    }));
                  }}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Category Code / Short Tag</label>
                <input
                  type="text"
                  placeholder="e.g. SPIC"
                  value={categoryFormData.code}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value.toUpperCase() })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Optional categorization notes or aisle number..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                form="categoryModalForm"
                type="submit"
                disabled={categorySaving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
              >
                {categorySaving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Save Category</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
