const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

/**
 * Numbers the merchant may legitimately leave unset. Returns null for blank,
 * null and undefined so "not recorded" stays distinct from 0, which is a real
 * value for a reorder alert level.
 */
const parseOptionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

exports.getProducts = (req, res) => {
  const storeId = getStoreId(req);
  const { category_id, search, low_stock } = req.query;
  let products = db.table('products').find(p => p.store_id === storeId);

  if (category_id) {
    products = products.filter(p => p.category_id === category_id);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(q))
    );
  }
  if (low_stock === 'true') {
    // Only products that carry a threshold can breach one. `|| 10` used to
    // invent a threshold for products that had none.
    products = products.filter(
      p => p.min_stock_level != null && Number(p.stock_quantity || 0) <= Number(p.min_stock_level)
    );
  }

  res.json({ products, total: products.length });
};

exports.getProductById = (req, res) => {
  const storeId = getStoreId(req);
  const product = db.table('products').findOne(p => p.id === req.params.id && p.store_id === storeId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ product });
};

exports.createProduct = (req, res) => {
  const storeId = getStoreId(req);
  const { name, sku, category_id, supplier_id, cost_price, selling_price, stock_quantity, min_stock_level, unit, barcode, description, image_url, lead_time_days } = req.body;

  const category = category_id ? db.table('categories').findOne(c => c.id === category_id && c.store_id === storeId) : null;
  const newProd = db.table('products').insert({
    store_id: storeId,
    name,
    sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
    category_id,
    category_name: category ? category.name : 'General',
    supplier_id: supplier_id || null,
    cost_price: Number(cost_price) || 0,
    selling_price: Number(selling_price) || 0,
    stock_quantity: Number(stock_quantity) || 0,
    // Blank means the merchant set no alert level. The old `|| 10` stored a
    // threshold they never chose — and the inventory model treats this value
    // as a reorder floor, so it silently changed reorder points. An explicit
    // 0 is a real value (alert whenever stock hits zero) and is kept.
    min_stock_level: parseOptionalNumber(min_stock_level),
    unit: unit || 'Units',
    image_url: image_url || '',
    barcode: barcode || '',
    lead_time_days: Number(lead_time_days) > 0 ? Number(lead_time_days) : 3,
    description: description || ''
  });

  res.status(201).json({ product: newProd, message: 'Product created successfully' });
};

exports.updateProduct = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('products').findOne(p => p.id === req.params.id && p.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Product not found' });

  // `update` merges shallowly, so any key in the body overwrites. The edit form
  // always sends `min_stock_level`, so a blank field used to erase the stored
  // threshold; it now means "no alert level" explicitly.
  const updates = { ...req.body };
  if ('min_stock_level' in updates) {
    updates.min_stock_level = parseOptionalNumber(updates.min_stock_level);
  }
  if ('lead_time_days' in updates) {
    const leadTime = parseOptionalNumber(updates.lead_time_days);
    if (leadTime === null || leadTime <= 0) delete updates.lead_time_days;
    else updates.lead_time_days = leadTime;
  }

  const updated = db.table('products').update(req.params.id, updates);
  res.json({ product: updated, message: 'Product updated successfully' });
};

exports.deleteProduct = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('products').findOne(p => p.id === req.params.id && p.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Product not found' });

  db.table('products').delete(req.params.id);
  res.json({ message: 'Product deleted successfully' });
};

// Categories
exports.getCategories = (req, res) => {
  const storeId = getStoreId(req);
  const categories = db.table('categories').find(c => c.store_id === storeId || !c.store_id);
  res.json({ categories });
};

exports.createCategory = (req, res) => {
  const storeId = getStoreId(req);
  const { name, code, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }
  const categoryCode = code ? code.trim().toUpperCase() : name.trim().slice(0, 4).toUpperCase();
  const newCat = db.table('categories').insert({ 
    store_id: storeId, 
    name: name.trim(), 
    code: categoryCode, 
    description: description ? description.trim() : '' 
  });
  res.status(201).json({ category: newCat, message: 'Category created successfully' });
};

exports.deleteCategory = (req, res) => {
  const storeId = getStoreId(req);
  const categoryId = req.params.id;
  const category = db.table('categories').findOne(c => c.id === categoryId && (c.store_id === storeId || !c.store_id));
  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  // Update products that belonged to this category
  const products = db.table('products').find(p => p.store_id === storeId && p.category_id === categoryId);
  products.forEach(p => {
    db.table('products').update(p.id, { category_id: null, category_name: 'General' });
  });

  db.table('categories').delete(categoryId);
  res.json({ message: `Category "${category.name}" deleted successfully`, deletedId: categoryId });
};

