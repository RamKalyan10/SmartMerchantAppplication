const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendOtpEmail } = require('../services/emailService');

const emailOtpStore = new Map();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set. Add it to backend/.env');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const cleanIdentifier = String(email).trim().toLowerCase();
    const user = db.table('users').findOne(u => 
      (u.email && u.email.toLowerCase() === cleanIdentifier) || 
      (u.id && u.id.toLowerCase() === cleanIdentifier)
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials. Incorrect password.' });
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

exports.firebaseSync = async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, phoneNumber } = req.body || {};
    if (!uid && !email) {
      return res.status(400).json({ message: 'UID or email required for sync' });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    let user = null;

    if (cleanEmail) {
      user = db.table('users').findOne(u => u.email && u.email.toLowerCase() === cleanEmail);
    }
    if (!user && uid) {
      user = db.table('users').findOne(u => u.id === uid || u.firebase_uid === uid);
    }

    if (!user) {
      const newUserId = uid || `usr_${Date.now()}`;
      const uniqueStoreId = `store_${newUserId}`;
      const storeName = displayName ? `${displayName}'s Store` : 'My Store';
      user = db.table('users').insert({
        id: newUserId,
        name: displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Merchant Owner'),
        email: cleanEmail || `${newUserId}@merchant.local`,
        role: 'Owner',
        phone: phoneNumber || '',
        avatar: photoURL || '',
        business_name: storeName,
        store_id: uniqueStoreId
      });
    }

    const userStoreId = user.store_id || `store_${user.id}`;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, store_id: userStoreId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userObj = { ...user, store_id: userStoreId };
    delete userObj.password;

    res.json({ token, user: userObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
  const currentStoreId = req.storeId || req.user?.store_id || (req.user?.id ? `store_${req.user.id}` : null);

  if (id === req.user?.id) {
    return res.status(400).json({ message: 'Store owners cannot delete their own account from the staff portal.' });
  }

  const staffMember = db.table('users').findOne(u => u.id === id && u.store_id === currentStoreId);
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

// --- 2-STEP / EMAIL OTP PASSWORD RESET & CHANGE ---

exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.table('users').findOne(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ message: 'No registered merchant account found with this email address.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    emailOtpStore.set(`reset_${cleanEmail}`, { otp, expiresAt, attempts: 0 });

    const emailRes = await sendOtpEmail(user.email, otp, 'Password Reset');

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox.`,
      simulated: !emailRes.delivered
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.forgotPasswordVerifyReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, 6-digit OTP code, and new password are required.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const key = `reset_${cleanEmail}`;
    const stored = emailOtpStore.get(key);

    if (!stored) {
      return res.status(400).json({ message: 'No active verification code found. Please request a new code.' });
    }

    if (Date.now() > stored.expiresAt) {
      emailOtpStore.delete(key);
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    if (stored.otp !== String(otp).trim()) {
      stored.attempts = (stored.attempts || 0) + 1;
      if (stored.attempts >= 5) {
        emailOtpStore.delete(key);
        return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new code.' });
      }
      return res.status(400).json({ message: 'Incorrect 6-digit verification code.' });
    }

    // OTP verified! Update password in database
    const user = db.table('users').findOne(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found in system.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.table('users').update(user.id, { password: hashedPassword });
    emailOtpStore.delete(key);

    res.json({
      success: true,
      message: 'Your password has been successfully reset! You can now log in.'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.changePasswordSendOtp = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(400).json({ message: 'No registered email found on your user profile.' });
    }

    const cleanEmail = user.email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    emailOtpStore.set(`change_${user.id}`, { otp, expiresAt, attempts: 0 });

    const emailRes = await sendOtpEmail(user.email, otp, '2-Step Password Change');

    res.json({
      success: true,
      message: `A 6-digit security verification code has been sent to your email (${cleanEmail}). Please check your inbox.`,
      simulated: !emailRes.delivered
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.changePasswordVerifyChange = async (req, res) => {
  try {
    const { otp, newPassword } = req.body || {};
    if (!otp || !newPassword) {
      return res.status(400).json({ message: '6-digit OTP code and new password are required.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const key = `change_${req.user.id}`;
    const stored = emailOtpStore.get(key);

    if (!stored) {
      return res.status(400).json({ message: 'No active OTP verification code found. Please click Send Security Code first.' });
    }

    if (Date.now() > stored.expiresAt) {
      emailOtpStore.delete(key);
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    if (stored.otp !== String(otp).trim()) {
      stored.attempts = (stored.attempts || 0) + 1;
      if (stored.attempts >= 5) {
        emailOtpStore.delete(key);
        return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new code.' });
      }
      return res.status(400).json({ message: 'Incorrect 6-digit verification code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.table('users').update(req.user.id, { password: hashedPassword });
    emailOtpStore.delete(key);

    res.json({
      success: true,
      message: 'Password changed successfully! Your store account is updated.'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
