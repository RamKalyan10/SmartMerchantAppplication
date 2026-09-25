const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function reconcile() {
  console.log('--- RECONCILING DATABASE & TIMESTAMPS ---');

  // 1. Setup Users matching acc_pss.md exactly
  const hashOnr = bcrypt.hashSync('onr123', 10);
  const hashMgr = bcrypt.hashSync('mgr123', 10);
  const hashCsh1 = bcrypt.hashSync('csh1pass', 10);
  const hashCsh2 = bcrypt.hashSync('csh2pass', 10);

  const desiredUsers = [
    {
      id: 'usr_owner_001',
      store_id: 'store_dwdm_001',
      name: 'Store Owner',
      email: 'onr1@gmail.com',
      password: hashOnr,
      role: 'Owner',
      phone: '+91 99887 76655',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store'
    },
    {
      id: 'usr_mgr_001',
      store_id: 'store_dwdm_001',
      name: 'Ravi Kumar',
      email: 'manager1@dwdmstore.com',
      password: hashMgr,
      role: 'Manager',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store',
      salary: 18000
    },
    {
      id: 'usr_csh_001',
      store_id: 'store_dwdm_001',
      name: 'Priya Nair',
      email: 'cashier1@dwdmstore.com',
      password: hashCsh1,
      role: 'Staff',
      phone: '+91 98765 11223',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store',
      salary: 12000
    },
    {
      id: 'usr_csh_002',
      store_id: 'store_dwdm_001',
      name: 'Anand Sharma',
      email: 'cashier2@dwdmstore.com',
      password: hashCsh2,
      role: 'Staff',
      phone: '+91 98765 33445',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store',
      salary: 12000
    }
  ];

  // Set users
  db.data.users = desiredUsers;
  console.log('✅ Users synchronized with acc_pss.md (4 accounts ready).');

  // 2. Normalize Invoices
  const invoices = db.data.invoices || [];
  let updatedCount = 0;

  for (const inv of invoices) {
    let t = inv.time || '12:00:00';
    if (t.length === 5) {
      t = t + ':00';
      inv.time = t;
    }
    const d = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '2026-09-24');
    inv.date = d;
    inv.created_at = `${d}T${t}.000Z`;
    inv.updated_at = `${d}T${t}.000Z`;
    updatedCount++;
  }

  db.save();
  console.log(`✅ Normalized ${updatedCount} invoice timestamps to align date, time, and created_at.`);

  // 3. Verify chronological order of today's invoices
  const todayInvs = db.table('invoices').find(i => i.date === '2026-09-24');
  todayInvs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  console.log('Top 5 most recent invoices for today (2026-09-24):');
  todayInvs.slice(0, 5).forEach(i => {
    console.log(`  - ${i.invoice_number} | Time: ${i.time} | Customer: ${i.customer_name} | CreatedAt: ${i.created_at}`);
  });
}

reconcile().catch(console.error);
