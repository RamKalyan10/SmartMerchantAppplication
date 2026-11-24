require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function clearAll() {
  console.log('Connecting to Supabase PostgreSQL...');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  
  const tables = [
    'invoice_items',
    'invoices',
    'inventory_transactions',
    'purchase_orders',
    'expenses',
    'products',
    'categories',
    'suppliers',
    'customers',
    'marketing_campaigns',
    'role_capabilities',
    'users'
  ];

  try {
    for (const t of tables) {
      await pool.query(`TRUNCATE TABLE "${t}" CASCADE;`);
      console.log(`[PG] Truncated table: ${t}`);
    }

    // Verify row counts in PostgreSQL
    console.log('\n--- PostgreSQL Verification (Row Counts) ---');
    const counts = {};
    for (const t of tables) {
      const res = await pool.query(`SELECT count(*) FROM "${t}"`);
      counts[t] = parseInt(res.rows[0].count, 10);
      console.log(`  ${t.padEnd(25)}: ${counts[t]} rows`);
    }

    // Also clear backend/data/merchant_db.json
    const dbFile = path.resolve(__dirname, '../../data/merchant_db.json');
    const emptyDb = {
      users: [],
      products: [],
      categories: [],
      customers: [],
      suppliers: [],
      invoices: [],
      invoice_items: [],
      inventory_transactions: [],
      purchase_orders: [],
      expenses: [],
      expense_categories: [],
      staff: [],
      marketing_campaigns: []
    };
    fs.writeFileSync(dbFile, JSON.stringify(emptyDb, null, 2), 'utf-8');
    console.log(`\nCleared local database file (${dbFile}) to 0 records.`);
  } catch (err) {
    console.error('Error during truncation:', err.message);
  } finally {
    await pool.end();
  }
}

clearAll();
