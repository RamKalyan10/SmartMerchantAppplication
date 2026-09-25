require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pgClient = require('../config/pgClient');

async function main() {
  console.log('--- Cleaning Mock Customers ---');

  // 1. Clean PostgreSQL if connected
  try {
    await pgClient.initPostgres();
    const pool = pgClient.getPool();
    if (pool && pgClient.isPgConnected()) {
      console.log('Connected to PostgreSQL.');
      const delRes = await pool.query("DELETE FROM customers WHERE id LIKE 'rec_%'");
      console.log(`Deleted ${delRes.rowCount} mock customer rows from PostgreSQL.`);
      const updRes = await pool.query("UPDATE invoices SET customer_id = NULL, customer_name = 'Walk-in Customer' WHERE customer_id LIKE 'rec_%'");
      console.log(`Updated ${updRes.rowCount} invoices in PostgreSQL.`);
    }
  } catch (pgErr) {
    console.warn('PostgreSQL notice:', pgErr.message);
  }

  // 2. Clean merchant_db.json
  const dbPath = path.join(__dirname, '../../data/merchant_db.json');
  const raw = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(raw);

  console.log(`Original customers count in JSON: ${db.customers.length}`);

  // Identify mock customer IDs (all starting with rec_)
  const mockIds = new Set(db.customers.filter(c => c.id.startsWith('rec_')).map(c => c.id));
  console.log(`Mock customers to delete: ${mockIds.size}`);

  // Filter customers to only legitimate core customers
  const legitCustomers = db.customers.filter(c => !mockIds.has(c.id));
  console.log(`Retained legitimate customers: ${legitCustomers.length}`);
  console.log(legitCustomers.map(c => ({ id: c.id, name: c.name, phone: c.phone })));

  // Clean up invoices referencing deleted mock customer IDs
  let updatedInvoicesCount = 0;
  db.invoices.forEach(inv => {
    if (mockIds.has(inv.customer_id)) {
      inv.customer_id = null;
      inv.customer_name = 'Walk-in Customer';
      inv.customer_phone = '';
      inv.customer_email = '';
      updatedInvoicesCount++;
    }
  });
  console.log(`Updated ${updatedInvoicesCount} invoices to Walk-in Customer in JSON.`);

  // Recalculate stats for legitimate customers
  legitCustomers.forEach(c => {
    const custInvoices = db.invoices.filter(i => i.customer_id === c.id);
    let paidSpent = 0;
    let pendingSpent = 0;
    custInvoices.forEach(inv => {
      const amt = Number(inv.total_amount || 0);
      const status = (inv.payment_status || 'PAID').toUpperCase();
      if (status === 'PENDING' || status === 'UNPAID') {
        pendingSpent += amt;
      } else {
        paidSpent += amt;
      }
    });
    c.orders_count = custInvoices.length;
    c.total_spent = Math.round(paidSpent * 100) / 100;
    c.pending_amount = Math.round(pendingSpent * 100) / 100;
  });

  db.customers = legitCustomers;

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('✅ Successfully saved cleaned database to merchant_db.json!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
