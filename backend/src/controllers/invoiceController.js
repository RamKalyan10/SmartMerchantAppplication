const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

const getInvoiceEpoch = (inv) => {
  const dStr = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '1970-01-01');
  let tStr = inv.time || '';
  if (!tStr) {
    if (inv.created_at && inv.created_at.includes('T')) {
      tStr = inv.created_at.split('T')[1].replace('Z', '').split('.')[0];
    } else {
      tStr = '00:00:00';
    }
  }
  if (tStr.length === 5) tStr += ':00';
  const iso = `${dStr}T${tStr}`;
  const parsed = new Date(iso).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return new Date(inv.created_at || inv.date || 0).getTime() || 0;
};

exports.getInvoices = (req, res) => {
  const storeId = getStoreId(req);
  const { customer_id, start_date, end_date, payment_status } = req.query;
  let invoices = db.table('invoices').find(i => i.store_id === storeId);

  if (customer_id) {
    invoices = invoices.filter(inv => inv.customer_id === customer_id);
  }
  if (payment_status) {
    invoices = invoices.filter(inv => inv.payment_status === payment_status);
  }
  if (start_date) {
    invoices = invoices.filter(inv => inv.date >= start_date);
  }
  if (end_date) {
    invoices = invoices.filter(inv => inv.date <= end_date);
  }

  // Sort strictly descending by exact datetime (newest first)
  invoices.sort((a, b) => getInvoiceEpoch(b) - getInvoiceEpoch(a));
  res.json({ invoices, total: invoices.length });
};

exports.getInvoiceById = (req, res) => {
  const storeId = getStoreId(req);
  const invoice = db.table('invoices').findOne(i => i.id === req.params.id && i.store_id === storeId);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json({ invoice });
};

exports.createInvoice = (req, res) => {
  try {
    const storeId = getStoreId(req);
    const {
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      items, // array of { product_id, quantity, unit_price, discount }
      payment_method = 'Cash',
      payment_status = 'PAID',
      discount = 0,
      tax_rate = 0.05, // 5% default GST
      notes = ''
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Invoice must contain at least one product item.' });
    }

    let subtotal = 0;
    const processedItems = [];

    // Process each item and deduct stock
    for (const it of items) {
      const product = db.table('products').findOne(p => p.id === it.product_id && p.store_id === storeId);
      if (!product) {
        return res.status(400).json({ message: `Product ID ${it.product_id} not found in your store catalog.` });
      }

      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || product.selling_price;
      const lineTotal = qty * price;
      subtotal += lineTotal;

      processedItems.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        category_id: product.category_id,
        category_name: product.category_name,
        cost_price: product.cost_price,
        unit_price: price,
        quantity: qty,
        unit: product.unit,
        total_amount: lineTotal
      });

      // Automatically deduct inventory
      const newStock = Math.max(0, product.stock_quantity - qty);
      db.table('products').update(product.id, { stock_quantity: newStock });

      // Record transaction
      db.table('inventory_transactions').insert({
        store_id: storeId,
        product_id: product.id,
        product_name: product.name,
        type: 'SALE',
        adjustment_type: 'SALE',
        quantity: qty,
        previous_stock: product.stock_quantity,
        new_stock: newStock,
        reason: `Sold via Invoice`,
        notes: `Sold via Invoice`,
        created_by: req.user ? req.user.name : 'Billing Staff',
        adjusted_by: req.user ? req.user.name : 'Billing Staff'
      });
    }

    const overallDiscount = Number(discount) || 0;
    const taxableAmount = Math.max(0, subtotal - overallDiscount);
    const tax = Math.round(taxableAmount * tax_rate);
    const grandTotal = taxableAmount + tax;

    const todayStr = new Date().toISOString().split('T')[0];
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;

    // Upsert or update customer record
    const isWalkIn = !customer_id || customer_id === 'walk_in' ||
      !customer_name ||
      customer_name.trim().toLowerCase() === 'walk-in customer' ||
      customer_name.trim().toLowerCase() === 'walk-in' ||
      customer_name.trim().toLowerCase() === 'walkin' ||
      req.body.is_walkin === true;

    let finalCustId = null;
    let finalCustName = 'Walk-in Customer';
    let existingCust = null;

    if (!isWalkIn) {
      if (customer_id) {
        existingCust = db.table('customers').findOne(c => c.id === customer_id && c.store_id === storeId);
      }
      if (!existingCust && customer_phone) {
        existingCust = db.table('customers').findOne(c => c.phone === customer_phone && c.store_id === storeId);
      }
    }

    const isPaid = (payment_status || 'PAID').toUpperCase() === 'PAID';

    if (isWalkIn) {
      finalCustId = null;
      finalCustName = customer_name && customer_name.trim() ? customer_name.trim() : 'Walk-in Customer';
    } else if (existingCust) {
      finalCustId = existingCust.id;
      finalCustName = existingCust.name;
      const prevSpent = Number(existingCust.total_spent || 0);
      const prevPending = Number(existingCust.pending_amount || 0);
      db.table('customers').update(existingCust.id, {
        name: existingCust.name || customer_name,
        phone: existingCust.phone || customer_phone || '',
        email: existingCust.email || customer_email || '',
        total_spent: isPaid ? round2(prevSpent + grandTotal) : prevSpent,
        pending_amount: isPaid ? prevPending : round2(prevPending + grandTotal),
        orders_count: (Number(existingCust.orders_count) || 0) + 1
      });
    } else if (req.body.save_as_new_customer && customer_name && customer_name.trim() !== 'Walk-in Customer') {
      // Only register as a new customer if explicitly requested
      existingCust = db.table('customers').insert({
        store_id: storeId,
        name: customer_name.trim(),
        phone: customer_phone || '',
        email: customer_email || '',
        total_spent: isPaid ? round2(grandTotal) : 0,
        pending_amount: isPaid ? 0 : round2(grandTotal),
        orders_count: 1
      });
      finalCustId = existingCust.id;
      finalCustName = existingCust.name;
    } else {
      // Default non-registered buyer
      finalCustId = null;
      finalCustName = customer_name && customer_name.trim() ? customer_name.trim() : 'Walk-in Customer';
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const invoiceDate = req.body.date || todayStr;
    const rawTime = req.body.time || timeStr;
    const invoiceTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const createdAt = req.body.created_at || `${invoiceDate}T${invoiceTime}.000Z`;

    const dObj = new Date(invoiceDate);
    const dow = dObj.getDay();
    const defaultDayType = (dow === 0 || dow === 6) ? 'Weekend' : 'Working Day';

    const invoice = db.table('invoices').insert({
      store_id: storeId,
      invoice_number: req.body.invoice_number || invoiceNum,
      customer_id: finalCustId,
      customer_name: finalCustName,
      customer_phone: customer_phone || (existingCust ? existingCust.phone : '') || '',
      customer_email: customer_email || (existingCust ? existingCust.email : '') || '',
      date: invoiceDate,
      time: invoiceTime,
      created_at: createdAt,
      items: processedItems,
      subtotal: round2(subtotal),
      discount: round2(overallDiscount),
      tax: round2(tax),
      total_amount: round2(grandTotal),
      payment_method,
      payment_status,
      cashier_id: req.user ? req.user.id : undefined,
      cashier_name: req.user ? req.user.name : undefined,
      billed_by: req.user ? req.user.name : 'Staff',
      notes: notes || req.body.notes || defaultDayType
    });

    // Also populate invoice_items table for relational integrity
    processedItems.forEach((it, idx) => {
      db.table('invoice_items').insert({
        id: `${invoice.id}_item_${idx + 1}`,
        invoice_id: invoice.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_amount,
        created_at: createdAt
      });
    });

    res.status(201).json({
      message: 'Invoice created successfully and stock updated in database.',
      invoice
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePaymentStatus = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('invoices').findOne(i => i.id === req.params.id && i.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Invoice not found' });

  const { payment_status } = req.body;
  const oldStatus = (existing.payment_status || 'PAID').toUpperCase();
  const newStatus = (payment_status || 'PAID').toUpperCase();

  const updated = db.table('invoices').update(req.params.id, { payment_status: newStatus });

  // Update customer balance if linked
  let cust = null;
  if (existing.customer_id) {
    cust = db.table('customers').findOne(c => c.id === existing.customer_id && c.store_id === storeId);
  }
  if (!cust && existing.customer_phone) {
    cust = db.table('customers').findOne(c => c.phone === existing.customer_phone && c.store_id === storeId);
  }

  if (cust) {
    let spent = Number(cust.total_spent || 0);
    let pending = Number(cust.pending_amount || 0);
    const amount = Number(existing.total_amount || 0);

    if (oldStatus === 'PENDING' && newStatus === 'PAID') {
      pending = Math.max(0, pending - amount);
      spent = spent + amount;
    } else if (oldStatus === 'PAID' && newStatus === 'PENDING') {
      spent = Math.max(0, spent - amount);
      pending = pending + amount;
    }

    db.table('customers').update(cust.id, {
      total_spent: round2(spent),
      pending_amount: round2(pending)
    });
  }

  res.json({ invoice: updated, message: 'Payment status updated' });
};

function round2(val) {
  return Math.round(val * 100) / 100;
}
