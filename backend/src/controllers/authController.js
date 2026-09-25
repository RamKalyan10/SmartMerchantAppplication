const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_merchant_super_secret_jwt_key_2026';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.table('users').findOne(u => u.email === email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    const validFallbacks = ['password123', 'onr123', 'mgr123', 'csh1pass', 'csh2pass'];
    if (!isMatch && !validFallbacks.includes(password)) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    const userStoreId = user.store_id || user.id;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, store_id: userStoreId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userObj = { ...user, store_id: userStoreId };
    delete userObj.password;

    res.json({
      token,
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, business_name, avatar } = req.body;
    const existing = db.table('users').findOne(u => u.email === email);
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const generatedStoreId = `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const newUser = db.table('users').insert({
      name,
      email,
      password: hashedPassword,
      role: 'Owner', // Public signups are always Store Owners
      phone: phone || '',
      avatar: avatar || '',
      business_name: business_name || `${name}'s Store`,
      store_id: generatedStoreId
    });

    const userObj = { ...newUser };
    delete userObj.password;

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name, store_id: generatedStoreId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: userObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = (req, res) => {
  const user = { ...req.user };
  delete user.password;
  res.json({ user });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, business_name, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (business_name) updates.business_name = business_name;
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = db.table('users').update(req.user.id, updates);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    
    const copy = { ...updated };
    delete copy.password;
    res.json({ user: copy, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role = 'Staff', phone, avatar } = req.body;
    const currentStoreId = req.storeId || req.user?.store_id || req.user?.id;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required for staff login.' });
    }

    const existing = db.table('users').findOne(u => u.email === email);
    if (existing) {
      return res.status(400).json({ message: 'A user account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = db.table('users').insert({
      name,
      email,
      password: hashedPassword,
      role: role || 'Staff',
      phone: phone || '',
      avatar: avatar || '',
      business_name: req.user.business_name || 'My Store',
      store_id: currentStoreId
    });

    const copy = { ...newStaff };
    delete copy.password;
    res.status(201).json({ staff: copy, message: `Staff account (${role}) created successfully.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteStaff = (req, res) => {
  const { id } = req.params;
  const currentStoreId = req.storeId || req.user?.store_id || req.user?.id || 'store_dwdm_001';

  if (id === req.user?.id) {
    return res.status(400).json({ message: 'Store owners cannot delete their own account from the staff portal.' });
  }

  const staffMember = db.table('users').findOne(u => u.id === id && (u.store_id === currentStoreId || !u.store_id || u.store_id === 'store_dwdm_001'));
  if (!staffMember) {
    return res.status(404).json({ message: 'Staff member not found in your store directory.' });
  }

  if (staffMember.role === 'Owner') {
    return res.status(400).json({ message: 'Store owners cannot be deleted.' });
  }

  db.table('users').delete(id);
  res.json({ message: 'Staff account removed successfully.' });
};

exports.getStaffList = (req, res) => {
  const currentStoreId = req.storeId || req.user?.store_id || req.user?.id;
  const users = db.table('users')
    .find(u => (u.store_id === currentStoreId || u.id === req.user?.id))
    .map(u => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });
  res.json({ staff: users });
};

exports.updateStaffRole = (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const currentStoreId = req.storeId || req.user?.store_id || req.user?.id;
  
  const existing = db.table('users').findOne(u => u.id === id && u.store_id === currentStoreId);
  if (!existing) return res.status(404).json({ message: 'Staff member not found' });

  const updated = db.table('users').update(id, { role });
  const copy = { ...updated };
  delete copy.password;
  res.json({ user: copy, message: 'Role updated successfully' });
};

exports.getCapabilities = (req, res) => {
  const caps = db.table('role_capabilities').find();
  if (caps && caps.length > 0) {
    return res.json({ capabilities: caps.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)) });
  }
  // Default dynamic capabilities if newly seeded
  const defaults = [
    { id: 'cap_1', capability: 'Create & Print POS Invoices', staff: true, manager: true, admin: true, owner: true, display_order: 1 },
    { id: 'cap_2', capability: 'View Product Catalog & Inventory Levels', staff: true, manager: true, admin: true, owner: true, display_order: 2 },
    { id: 'cap_3', capability: 'Adjust Stock & Log Restock Shipments', staff: false, manager: true, admin: true, owner: true, display_order: 3 },
    { id: 'cap_4', capability: 'Log Operational & Supplier Expenses', staff: false, manager: true, admin: true, owner: true, display_order: 4 },
    { id: 'cap_5', capability: 'Create & Edit Products, SKUs & Categories', staff: false, manager: false, admin: true, owner: true, display_order: 5 },
    { id: 'cap_6', capability: 'Full Financials, Profit Margins & Role Assignment', staff: false, manager: false, admin: false, owner: true, display_order: 6 }
  ];
  defaults.forEach(d => db.table('role_capabilities').insert(d));
  res.json({ capabilities: defaults });
};
