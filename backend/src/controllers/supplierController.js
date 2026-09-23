const db = require('../config/db');

const getStoreId = (req) => req.storeId || req.user?.store_id || 'store_dwdm_001';

exports.getSuppliers = (req, res) => {
  const storeId = getStoreId(req);
  const suppliers = db.table('suppliers').find(s => s.store_id === storeId);
  res.json({ suppliers });
};

exports.getSupplierById = (req, res) => {
  const storeId = getStoreId(req);
  const supplier = db.table('suppliers').findOne(s => s.id === req.params.id && s.store_id === storeId);
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
  const products = db.table('products').find(p => p.supplier_id === supplier.id && p.store_id === storeId);
  res.json({ supplier, products });
};

exports.createSupplier = (req, res) => {
  const storeId = getStoreId(req);
  const { name, contact_person, phone, email, lead_time_days, address, logo_url } = req.body;
  const newSup = db.table('suppliers').insert({
    store_id: storeId,
    name,
    contact_person: contact_person || '',
    phone: phone || '',
    email: email || '',
    logo_url: logo_url || '',
    lead_time_days: Number(lead_time_days) || 3,
    address: address || ''
  });
  res.status(201).json({ supplier: newSup });
};

exports.updateSupplier = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('suppliers').findOne(s => s.id === req.params.id && s.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Supplier not found' });

  const updated = db.table('suppliers').update(req.params.id, req.body);
  res.json({ supplier: updated });
};

exports.deleteSupplier = (req, res) => {
  const storeId = getStoreId(req);
  const existing = db.table('suppliers').findOne(s => s.id === req.params.id && s.store_id === storeId);
  if (!existing) return res.status(404).json({ message: 'Supplier not found' });

  db.table('suppliers').delete(req.params.id);
  res.json({ message: 'Supplier deleted' });
};
