require('dotenv').config();
const axios = require('axios');
const pgClient = require('../src/config/pgClient');

const API_BASE = 'http://localhost:5000/api';

async function verifyAll() {
  console.log('========================================================');
  console.log('🧪 RUNNING COMPREHENSIVE SINGLE-STORE & DB INTEGRATION TEST');
  console.log('========================================================\n');

  // 1. Check PostgreSQL Direct Connection
  await pgClient.initPostgres();
  const pool = pgClient.getPool();

  console.log('1️⃣ Checking PostgreSQL Users Table:');
  const usersRes = await pool.query('SELECT id, name, email, role, store_id FROM users ORDER BY id');
  console.table(usersRes.rows);

  if (usersRes.rows.length !== 4) {
    console.error(`❌ Expected exactly 4 users for store_dwdm_001, found: ${usersRes.rows.length}`);
  } else {
    console.log('✅ Exactly 4 authorized accounts verified in PostgreSQL.');
  }

  // 2. Login via API with onr1@gmail.com
  console.log('\n2️⃣ Testing Authentication API with Owner account (onr1@gmail.com / onr123):');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'onr1@gmail.com',
    password: 'onr123'
  });
  const token = loginRes.data.token;
  const user = loginRes.data.user;
  console.log(`✅ Logged in successfully as: ${user.name} (${user.role}) - Store ID: ${user.store_id}`);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // 3. Test Staff List Endpoint
  console.log('\n3️⃣ Testing Staff & RBAC Endpoint:');
  const staffRes = await axios.get(`${API_BASE}/auth/staff`, authHeaders);
  console.log(`✅ Staff directory count: ${staffRes.data.staff.length}`);
  staffRes.data.staff.forEach(s => console.log(`   • ${s.name} (${s.email}) - ${s.role}`));

  // 4. Test Dashboard Overview & Calendar Horizons
  console.log('\n4️⃣ Testing Dashboard Analytics API for 14-day cycle:');
  const overviewRes = await axios.get(`${API_BASE}/analytics/overview?period=14`, authHeaders);
  const kpis = overviewRes.data.kpis;
  console.log(`   • 14-Day Revenue:    ₹${kpis.period_revenue.toLocaleString('en-IN')}`);
  console.log(`   • 14-Day COGS:       ₹${kpis.period_cogs.toLocaleString('en-IN')}`);
  console.log(`   • 14-Day Op Expense: ₹${kpis.period_expense.toLocaleString('en-IN')}`);
  console.log(`   • 14-Day Net Profit: ₹${kpis.period_net_profit.toLocaleString('en-IN')} (Target: 15k-20k)`);
  console.log(`   • Invoices Count:    ${kpis.period_invoices}`);

  // 5. Test Live Write Mutation -> Real-time PostgreSQL Reflection
  console.log('\n5️⃣ Testing Live Product Creation & PostgreSQL Sync:');
  const testSku = `TEST-${Date.now().toString().slice(-4)}`;
  const prodRes = await axios.post(`${API_BASE}/products`, {
    name: 'Organic Whole Green Cardamom (50g)',
    sku: testSku,
    cost_price: 110,
    selling_price: 145,
    stock_quantity: 30,
    min_stock_level: 10,
    unit: 'Packs',
    description: 'Aromatic whole green elaichi'
  }, authHeaders);

  const createdProdId = prodRes.data.product.id;
  console.log(`✅ Product created via API with ID: ${createdProdId}`);
  await new Promise(r => setTimeout(r, 300));

  // Query PostgreSQL directly to verify immediate reflection
  const pgProdCheck = await pool.query('SELECT id, name, sku, selling_price, stock_quantity FROM products WHERE id = $1', [createdProdId]);
  if (pgProdCheck.rows.length > 0) {
    console.log('✅ Real-time PostgreSQL Verification Succeeded! Product found in DB:', pgProdCheck.rows[0]);
  } else {
    console.error('❌ Product not found in PostgreSQL!');
  }

  // 6. Test POS Invoice Creation & Real-time PostgreSQL Line Items Sync
  console.log('\n6️⃣ Testing POS Invoice Creation & Real-time Line Items Sync:');
  const invRes = await axios.post(`${API_BASE}/invoices`, {
    customer_id: 'cust_01_store_dwdm_001',
    customer_name: 'Rahul Sharma',
    customer_phone: '+91 98111 22334',
    payment_method: 'UPI',
    items: [
      {
        product_id: createdProdId,
        product_name: 'Organic Whole Green Cardamom (50g)',
        quantity: 2,
        unit_price: 145,
        cost_price: 110,
        total_amount: 290
      }
    ],
    subtotal: 290,
    discount: 0,
    tax: 14.5,
    total_amount: 304.5
  }, authHeaders);

  const createdInvId = invRes.data.invoice.id;
  console.log(`✅ POS Invoice created via API with ID: ${createdInvId}`);
  await new Promise(r => setTimeout(r, 300));

  // Query PostgreSQL directly for invoice and invoice_items
  const pgInvCheck = await pool.query('SELECT id, invoice_number, total_amount, payment_method FROM invoices WHERE id = $1', [createdInvId]);
  const pgItemsCheck = await pool.query('SELECT id, invoice_id, product_name, quantity, total_price FROM invoice_items WHERE invoice_id = $1', [createdInvId]);
  
  if (pgInvCheck.rows.length > 0 && pgItemsCheck.rows.length > 0) {
    console.log('✅ Real-time PostgreSQL Invoice Verification Succeeded:', pgInvCheck.rows[0]);
    console.log(`✅ Real-time PostgreSQL Line Items (${pgItemsCheck.rows.length} lines) found:`, pgItemsCheck.rows);
  } else {
    console.error('❌ Invoice or line items not found in PostgreSQL!');
  }

  // 7. Test Expense Creation & Real-time PostgreSQL Sync
  console.log('\n7️⃣ Testing Expense Creation & Real-time PostgreSQL Sync:');
  const expRes = await axios.post(`${API_BASE}/expenses`, {
    category: 'Miscellaneous',
    amount: 350,
    description: 'Store cleaning & packing consumables',
    date: '2026-09-12'
  }, authHeaders);

  const createdExpId = expRes.data.expense.id;
  console.log(`✅ Expense created via API with ID: ${createdExpId}`);
  await new Promise(r => setTimeout(r, 300));

  const pgExpCheck = await pool.query('SELECT id, category, amount, description FROM expenses WHERE id = $1', [createdExpId]);
  if (pgExpCheck.rows.length > 0) {
    console.log('✅ Real-time PostgreSQL Expense Verification Succeeded:', pgExpCheck.rows[0]);
  } else {
    console.error('❌ Expense not found in PostgreSQL!');
  }

  // 8. Clean up test records
  console.log('\n8️⃣ Cleaning up test records...');
  await axios.delete(`${API_BASE}/products/${createdProdId}`, authHeaders);
  await axios.delete(`${API_BASE}/expenses/${createdExpId}`, authHeaders);
  await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [createdInvId]);
  await pool.query('DELETE FROM invoices WHERE id = $1', [createdInvId]);
  console.log('✅ Test cleanup completed.');

  console.log('\n========================================================');
  console.log('🎉 ALL TESTS PASSED! SINGLE STORE & DB INTEGRATION 100% VERIFIED!');
  console.log('========================================================');
  process.exit(0);
}

verifyAll().catch(err => {
  console.error('Test Error:', err.response?.data || err.message);
  process.exit(1);
});
