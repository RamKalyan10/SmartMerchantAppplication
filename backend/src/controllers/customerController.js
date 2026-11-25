const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || (req.user?.id ? `store_${req.user.id}` : null);

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
        const total = Number(inv.total_amount || 0);
        const status = (inv.payment_status || 'PAID').toUpperCase();
        const paid = inv.paid_amount !== undefined ? Number(inv.paid_amount) : (status === 'PAID' ? total : 0);
        const balance = inv.balance_due !== undefined ? Number(inv.balance_due) : (status === 'PAID' ? 0 : Math.max(0, total - paid));

        if (status === 'PENDING' || status === 'UNPAID' || status === 'DUE' || status === 'PARTIAL') {
          calculatedPending += balance;
          calculatedPaid += paid;
          if (balance > 0) pendingCount += 1;
        } else {
          calculatedPaid += total;
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
    const total = Number(inv.total_amount || 0);
    const status = (inv.payment_status || 'PAID').toUpperCase();
    const paid = inv.paid_amount !== undefined ? Number(inv.paid_amount) : (status === 'PAID' ? total : 0);
    const balance = inv.balance_due !== undefined ? Number(inv.balance_due) : (status === 'PAID' ? 0 : Math.max(0, total - paid));

    if (status === 'PENDING' || status === 'UNPAID' || status === 'DUE' || status === 'PARTIAL') {
      calculatedPending += balance;
      calculatedPaid += paid;
      if (balance > 0) pendingCount += 1;
    } else {
      calculatedPaid += total;
    }
  });

  const enrichedCustomer = {
    ...customer,
    total_spent: invoices.length > 0 ? Math.round(calculatedPaid * 100) / 100 : (Number(customer.total_spent) || 0),
    pending_amount: invoices.length > 0 ? Math.round(calculatedPending * 100) / 100 : (Number(customer.pending_amount) || 0),
    pending_count: pendingCount,
    orders_count: invoices.length > 0 ? invoices.length : (Number(customer.orders_count) || 0)
  };

  // Attach customer repayment / installment history
  const allPayments = db.table('customer_payments').find(p => 
    p.store_id === storeId && (p.customer_id === customer.id || (customer.phone && p.customer_phone === customer.phone))
  );
  allPayments.sort((a, b) => new Date(b.created_at || b.payment_date) - new Date(a.created_at || a.payment_date));

  res.json({ customer: enrichedCustomer, invoices, payments: allPayments });
};

exports.recordInstallmentPayment = (req, res) => {
  const storeId = getStoreId(req);
  const customerId = req.params.id;
  const customer = db.table('customers').findOne(c => c.id === customerId && c.store_id === storeId);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const amount = Number(req.body.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Please provide a valid installment amount greater than 0.' });
  }

  const paymentMethod = req.body.payment_method || 'Cash';
  const notes = req.body.notes || '';
  const referenceId = req.body.reference_id || '';
  const targetInvoiceId = req.body.invoice_id || null;

  // Retrieve customer's pending invoices
  const allInvoices = db.table('invoices').find(inv => inv.store_id === storeId);
  const custInvoices = allInvoices.filter(inv =>
    inv.customer_id === customer.id || (customer.phone && inv.customer_phone === customer.phone)
  );

  const pendingInvoices = custInvoices.filter(inv => {
    const s = (inv.payment_status || 'PAID').toUpperCase();
    return s === 'PENDING' || s === 'UNPAID' || s === 'DUE' || s === 'PARTIAL';
  });

  // Sort FIFO (oldest first) so installments clear older debts first
  pendingInvoices.sort((a, b) => new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0));

  let eligibleInvoices = targetInvoiceId 
    ? pendingInvoices.filter(i => i.id === targetInvoiceId)
    : pendingInvoices;

  if (eligibleInvoices.length === 0 && targetInvoiceId) {
    // If specific invoice wasn't found in pending list, fall back to all pending
    eligibleInvoices = pendingInvoices;
  }

  let remainingToAllocate = amount;
  const allocatedInvoices = [];

  for (const inv of eligibleInvoices) {
    if (remainingToAllocate <= 0) break;
    const total = Number(inv.total_amount || 0);
    const prevPaid = inv.paid_amount !== undefined ? Number(inv.paid_amount) : 0;
    const prevBalance = inv.balance_due !== undefined ? Number(inv.balance_due) : Math.max(0, total - prevPaid);

    if (prevBalance <= 0) continue;

    const paymentForThis = Math.min(remainingToAllocate, prevBalance);
    const newPaidAmount = Math.round((prevPaid + paymentForThis) * 100) / 100;
    const newBalanceDue = Math.round(Math.max(0, prevBalance - paymentForThis) * 100) / 100;
    const newStatus = newBalanceDue <= 0.01 ? 'PAID' : 'PARTIAL';

    db.table('invoices').update(inv.id, {
      paid_amount: newPaidAmount,
      balance_due: newBalanceDue,
      payment_status: newStatus
    });

    allocatedInvoices.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      amount_allocated: paymentForThis,
      previous_balance: prevBalance,
      new_balance: newBalanceDue,
      status: newStatus
    });

    remainingToAllocate = Math.round((remainingToAllocate - paymentForThis) * 100) / 100;
  }

  // Update customer pending amount and total spent
  const currentPending = Number(customer.pending_amount || 0);
  const currentSpent = Number(customer.total_spent || 0);
  const updatedPending = Math.max(0, Math.round((currentPending - amount) * 100) / 100);
  const updatedSpent = Math.round((currentSpent + amount) * 100) / 100;

  const updatedCustomer = db.table('customers').update(customer.id, {
    pending_amount: updatedPending,
    total_spent: updatedSpent
  });

  // Create payment receipt record in customer_payments
  const receiptNumber = `REC-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
  const paymentRecord = db.table('customer_payments').insert({
    id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    receipt_number: receiptNumber,
    store_id: storeId,
    customer_id: customer.id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    amount: Math.round(amount * 100) / 100,
    payment_method: paymentMethod,
    payment_date: new Date().toISOString().split('T')[0],
    reference_id: referenceId,
    notes: notes,
    allocated_invoices: allocatedInvoices,
    created_at: new Date().toISOString()
  });

  res.status(201).json({
    message: 'Installment payment recorded successfully',
    receipt: paymentRecord,
    customer: updatedCustomer,
    allocated_invoices: allocatedInvoices,
    remaining_unallocated: remainingToAllocate
  });
};

exports.getCustomerPayments = (req, res) => {
  const storeId = getStoreId(req);
  const customerId = req.params.id;
  const customer = db.table('customers').findOne(c => c.id === customerId && c.store_id === storeId);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const payments = db.table('customer_payments').find(p =>
    p.store_id === storeId && (p.customer_id === customer.id || (customer.phone && p.customer_phone === customer.phone))
  );
  payments.sort((a, b) => new Date(b.created_at || b.payment_date) - new Date(a.created_at || a.payment_date));

  res.json({ payments });
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
