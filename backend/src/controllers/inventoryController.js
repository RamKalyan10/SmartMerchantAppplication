const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

/** Postgres/JSON round-trips can leave this null; subtract from 0 rather than NaN. */
const stockOf = (p) => {
  const n = Number(p?.stock_quantity);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A product can only be "low stock" against a threshold it actually has.
 * `min_stock_level || 10` used to give every product without one an invented
 * threshold of 10, so the count disagreed with the Products page and with
 * `analyticsController`.
 */
const isLowStock = (p) =>
  p.min_stock_level != null && stockOf(p) <= Number(p.min_stock_level);

/** Types `adjustStock` knows how to apply, and the direction each moves stock. */
const STOCK_IN_TYPES = ['RESTOCK', 'IN'];
const STOCK_OUT_TYPES = ['SALE', 'OUT', 'DAMAGE'];
const SET_TYPE = 'SET';
const ADJUSTMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES, SET_TYPE];

/**
 * `schema.sql` lists 'RETURN' as a possible type, but the direction is ambiguous
 * — a customer return adds stock, a return to supplier deducts it — and nothing
 * in the app sends one. Applying a guess would silently corrupt the balance, so
 * it is refused with an explanation until the direction is actually decided.
 */
const UNSUPPORTED_TYPES = { RETURN: 'stock direction is ambiguous' };

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Add days to a `YYYY-MM-DD` key. */
const addDays = (key, days) =>
  new Date(new Date(`${key}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * Parse a stock quantity from a request body.
 *
 * Returns a number or an error string. `Number(undefined)` is NaN, which used to
 * flow straight into `stock_quantity` and serialise to JSON as null — a product
 * whose stock silently became unreadable.
 */
function parseQuantity(raw, { allowZero = false } = {}) {
  if (raw === undefined || raw === null || raw === '') return { error: 'quantity is required' };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { error: `quantity must be a number, received "${raw}"` };
  if (!Number.isInteger(value)) return { error: `quantity must be a whole number, received ${value}` };
  if (value < 0) return { error: `quantity cannot be negative, received ${value}` };
  if (value === 0 && !allowZero) return { error: 'quantity must be greater than zero' };
  return { value };
}

/** Next sequential PO id within the store, e.g. PO-2026-0007. */
function nextPurchaseOrderId(storeId) {
  const year = todayKey().slice(0, 4);
  const prefix = `PO-${year}-`;
  const existing = db.table('purchase_orders').find(
    (p) => p.store_id === storeId && String(p.id).startsWith(prefix)
  );
  const highest = existing.reduce((max, p) => {
    const n = Number(String(p.id).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

exports.getInventoryStatus = (req, res) => {
  const storeId = getStoreId(req);
  const products = db.table('products').find(p => p.store_id === storeId);
  const summary = {
    total_sku_count: products.length,
    low_stock_count: products.filter(isLowStock).length,
    // Coerced, so this agrees with isLowStock above rather than disagreeing on
    // any product whose stock arrived as a string.
    out_of_stock_count: products.filter(p => stockOf(p) === 0).length,
    total_inventory_value: products.reduce((acc, p) => acc + (stockOf(p) * (p.cost_price || 0)), 0),
    total_retail_value: products.reduce((acc, p) => acc + (stockOf(p) * (p.selling_price || 0)), 0)
  };

  const inventoryList = products.map(p => {
    const stock = stockOf(p);
    let status = 'In Stock';
    if (stock === 0) status = 'Out of Stock';
    else if (isLowStock(p)) status = 'Low Stock';

    return {
      ...p,
      status,
      stock_value: Math.round(stock * (p.cost_price || 0))
    };
  });

  res.json({ summary, inventory: inventoryList });
};

exports.adjustStock = (req, res) => {
  const storeId = getStoreId(req);
  const { product_id, adjustment_type, quantity, reason } = req.body;
  const product = db.table('products').findOne(p => p.id === product_id && p.store_id === storeId);
  if (!product) return res.status(404).json({ message: 'Product not found in your store catalog' });

  if (UNSUPPORTED_TYPES[adjustment_type]) {
    return res.status(400).json({
      message: `adjustment_type "${adjustment_type}" is not applied: ${UNSUPPORTED_TYPES[adjustment_type]}`
    });
  }

  if (!ADJUSTMENT_TYPES.includes(adjustment_type)) {
    // Previously an unknown type fell through every branch, changed nothing, and
    // still wrote a ledger row asserting an adjustment had happened.
    return res.status(400).json({
      message: `Unknown adjustment_type "${adjustment_type}". Expected one of: ${ADJUSTMENT_TYPES.join(', ')}`
    });
  }

  const parsed = parseQuantity(quantity, { allowZero: adjustment_type === SET_TYPE });
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const qty = parsed.value;

  const previousStock = stockOf(product);
  let newStock = previousStock;

  if (STOCK_IN_TYPES.includes(adjustment_type)) {
    newStock = previousStock + qty;
  } else if (STOCK_OUT_TYPES.includes(adjustment_type)) {
    newStock = Math.max(0, previousStock - qty);
  } else if (adjustment_type === SET_TYPE) {
    newStock = qty;
  }

  const updatedProduct = db.table('products').update(product_id, { stock_quantity: newStock });

  const transaction = db.table('inventory_transactions').insert({
    store_id: storeId,
    product_id,
    product_name: product.name,
    // Both fields: `type` is what schema.sql declares NOT NULL and what the
    // audit log filters on; `adjustment_type` is what the older client sends.
    type: adjustment_type,
    adjustment_type,
    quantity: qty,
    previous_stock: previousStock,
    new_stock: newStock,
    reason: reason || 'Manual adjustment',
    adjusted_by: req.user ? req.user.name : 'Merchant Admin'
  });

  res.json({
    message: 'Stock updated successfully in database',
    product: updatedProduct,
    transaction
  });
};

exports.getTransactions = (req, res) => {
  const storeId = getStoreId(req);
  const transactions = db.table('inventory_transactions').find(t => t.store_id === storeId);
  transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ transactions });
};

/**
 * Place a purchase order.
 *
 * This is what the Forecasting page's "Order N units" button calls, and what the
 * seeded ledger's historical orders were generated against, so a live order and a
 * backfilled one have the same shape.
 */
exports.createPurchaseOrder = (req, res) => {
  const storeId = getStoreId(req);
  const { product_id, quantity, supplier_id, expected_at, notes } = req.body;

  const product = db.table('products').findOne(p => p.id === product_id && p.store_id === storeId);
  if (!product) return res.status(404).json({ message: 'Product not found in your store catalog' });

  const parsed = parseQuantity(quantity);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const leadTimeDays = Math.max(1, Math.round(Number(product.lead_time_days) || 3));
  const orderedAt = todayKey();

  const order = db.table('purchase_orders').insert({
    id: nextPurchaseOrderId(storeId),
    store_id: storeId,
    supplier_id: supplier_id || product.supplier_id || null,
    product_id,
    product_name: product.name,
    quantity: parsed.value,
    unit_cost: Number(product.cost_price) || 0,
    ordered_at: orderedAt,
    expected_at: expected_at || addDays(orderedAt, leadTimeDays),
    received_at: null,
    status: 'ORDERED',
    trigger: req.body.trigger || 'manual',
    notes: notes || null,
    created_by: req.user ? req.user.name : 'Merchant Admin'
  });

  res.status(201).json({ message: `Purchase order ${order.id} placed`, purchase_order: order });
};

/** Purchase orders for the store, newest first. `?status=ORDERED` to filter. */
exports.getPurchaseOrders = (req, res) => {
  const storeId = getStoreId(req);
  const { status } = req.query;

  let orders = db.table('purchase_orders').find(p => p.store_id === storeId);
  if (status) orders = orders.filter(p => p.status === status);
  orders.sort((a, b) => new Date(b.ordered_at) - new Date(a.ordered_at));

  const summary = {
    total: orders.length,
    ordered: orders.filter(p => p.status === 'ORDERED').length,
    received: orders.filter(p => p.status === 'RECEIVED').length,
    cancelled: orders.filter(p => p.status === 'CANCELLED').length,
    // Value of goods still in flight — the number a merchant actually watches.
    on_order_value: orders
      .filter(p => p.status === 'ORDERED')
      .reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_cost) || 0), 0)
  };

  res.json({ summary, purchase_orders: orders });
};

/**
 * Receive a purchase order: goods arrive, stock goes up, the ledger records it.
 *
 * Idempotent — receiving an already-received order returns it unchanged rather
 * than adding its quantity to stock a second time.
 */
exports.receivePurchaseOrder = (req, res) => {
  const storeId = getStoreId(req);
  const { id } = req.params;

  const order = db.table('purchase_orders').findOne(p => p.id === id && p.store_id === storeId);
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });

  if (order.status === 'RECEIVED') {
    return res.json({
      message: `${order.id} was already received on ${order.received_at}; stock unchanged`,
      purchase_order: order,
      transaction: null
    });
  }
  if (order.status === 'CANCELLED') {
    return res.status(400).json({ message: `${order.id} was cancelled and cannot be received` });
  }

  const product = db.table('products').findOne(p => p.id === order.product_id && p.store_id === storeId);
  if (!product) {
    return res.status(404).json({ message: `Product ${order.product_id} is no longer in the catalog` });
  }

  const previousStock = stockOf(product);
  const receivedAt = todayKey();
  const newStock = previousStock + (Number(order.quantity) || 0);

  db.table('products').update(product.id, { stock_quantity: newStock });

  const transaction = db.table('inventory_transactions').insert({
    store_id: storeId,
    product_id: order.product_id,
    product_name: order.product_name || product.name,
    type: 'RESTOCK',
    adjustment_type: 'RESTOCK',
    quantity: order.quantity,
    previous_stock: previousStock,
    new_stock: newStock,
    reference_id: order.id,
    reason: `Goods received against ${order.id}`,
    notes: `Ordered ${order.ordered_at}, expected ${order.expected_at}`,
    created_by: req.user ? req.user.name : 'Merchant Admin'
  });

  const updated = db.table('purchase_orders').update(order.id, {
    status: 'RECEIVED',
    received_at: receivedAt
  });

  res.json({
    message: `${order.id} received — ${product.name} stock ${previousStock} → ${newStock}`,
    purchase_order: updated,
    transaction
  });
};
