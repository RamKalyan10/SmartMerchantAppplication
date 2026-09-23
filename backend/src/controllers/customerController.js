const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

exports.getCustomers = (req, res) => {
  const storeId = getStoreId(req);
  const { search, filter } = req.query;
  const rawCustomers = db.table('customers').find(c => c.store_id === storeId);
  const allInvoices = db.table('invoices').find(inv => inv.store_id === storeId);

  // Group invoices by customer_id and customer_phone
  const invById = {};
  const invByPhone = {};

  allInvoices.forEach(inv => {
    if (inv.customer_id) {
      if (!invById[inv.customer_id]) invById[inv.customer_id] = [];
      invById[inv.customer_id].push(inv);
    }
    if (inv.customer_phone) {
      if (!invByPhone[inv.customer_phone]) invByPhone[inv.customer_phone] = [];
      invByPhone[inv.customer_phone].push(inv);
    }
  });

  let customers = rawCustomers.map(c => {
    const invMap = new Map();
    (invById[c.id] || []).forEach(i => invMap.set(i.id, i));
    if (c.phone) {
      (invByPhone[c.phone] || []).forEach(i => invMap.set(i.id, i));
    }
    const custInvoices = Array.from(invMap.values());

    let calculatedPaid = 0;
    let calculatedPending = 0;
    let pendingCount = 0;

    if (custInvoices.length > 0) {
      custInvoices.forEach(inv => {
        const amt = Number(inv.total_amount || 0);
        const status = (inv.payment_status || 'PAID').toUpperCase();
        if (status === 'PENDING' || status === 'UNPAID' || status === 'DUE') {
          calculatedPending += amt;
          pendingCount += 1;
        } else {
          calculatedPaid += amt;
        }
      });
    }

    const totalSpent = custInvoices.length > 0 
      ? Math.round(calculatedPaid * 100) / 100 
      : (Number(c.total_spent) || 0);
    const pendingAmount = custInvoices.length > 0 
      ? Math.round(calculatedPending * 100) / 100 
      : (Number(c.pending_amount) || 0);
    const ordersCount = custInvoices.length > 0 
      ? custInvoices.length 
      : (Number(c.orders_count) || 0);

    return {
      ...c,
      total_spent: totalSpent,
      pending_amount: pendingAmount,
      pending_count: pendingCount,
      orders_count: ordersCount,
      invoices_count: custInvoices.length
    };
  });

  if (filter === 'pending') {
    customers = customers.filter(c => (c.pending_amount || 0) > 0);
  }

  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }

  res.json({ customers, total: customers.length });
};

exports.getCustomerById = (req, res) => {
  const storeId = getStoreId(req);
  const customer = db.table('customers').findOne(c => c.id === req.params.id && c.store_id === storeId);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  
  // Attach past invoices matching customer id or phone
  const allInvoices = db.table('invoices').find(inv => inv.store_id === storeId);
  const invMap = new Map();
  allInvoices.forEach(inv => {
    if (inv.customer_id === customer.id || (customer.phone && inv.customer_phone === customer.phone)) {
      invMap.set(inv.id, inv);
    }
  });
  const invoices = Array.from(invMap.values());
  invoices.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

  let calculatedPaid = 0;
  let calculatedPending = 0;
  let pendingCount = 0;

  invoices.forEach(inv => {
    const amt = Number(inv.total_amount || 0);
    const status = (inv.payment_status || 'PAID').toUpperCase();
    if (status === 'PENDING' || status === 'UNPAID' || status === 'DUE') {
      calculatedPending += amt;
      pendingCount += 1;
    } else {
      calculatedPaid += amt;
    }
  });

  const enrichedCustomer = {
    ...customer,
    total_spent: invoices.length > 0 ? Math.round(calculatedPaid * 100) / 100 : (Number(customer.total_spent) || 0),
    pending_amount: invoices.length > 0 ? Math.round(calculatedPending * 100) / 100 : (Number(customer.pending_amount) || 0),
    pending_count: pendingCount,
    orders_count: invoices.length > 0 ? invoices.length : (Number(customer.orders_count) || 0)
  };

  res.json({ customer: enrichedCustomer, invoices });
};

exports.createCustomer = (req, res) => {
  const storeId = getStoreId(req);
  const { name, phone, email, address, avatar } = req.body;
  const newCust = db.table('customers').insert({
    store_id: storeId,
    name,
    phone,
    email: email || '',
    avatar: avatar || '',
    address: address || '',
    total_spent: 0,
    orders_count: 0
  });
  res.status(201).json({ customer: newCust });
};

exports.updateCustomer = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('customers').findOne(c => c.id === req.params.id && c.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Customer not found' });

  const updated = db.table('customers').update(req.params.id, req.body);
  res.json({ customer: updated });
};

exports.deleteCustomer = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('customers').findOne(c => c.id === req.params.id && c.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Customer not found' });

  db.table('customers').delete(req.params.id);
  res.json({ message: 'Customer deleted successfully' });
};
