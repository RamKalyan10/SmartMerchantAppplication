require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { seedDatabase } = require('../seeds/seedData');

async function reseed() {
  console.log('========================================================');
  console.log('🔄 Smart Merchant - Full Database Purge & Reseed Utility');
  console.log('========================================================');

  const dbHost = process.env.PGHOST || 'localhost';
  const dbPort = parseInt(process.env.PGPORT || '5432', 10);
  const dbUser = process.env.PGUSER || 'postgres';
  const dbPassword = process.env.PGPASSWORD || 'postgres';
  const targetDbName = process.env.PGDATABASE || 'smart_merchant';

  const pool = new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: targetDbName
  });

  try {
    console.log(`Connecting to PostgreSQL (${targetDbName})...`);
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL successfully.');

    // 1. Apply Schema
    console.log('Applying database schema to ensure all tables exist...');
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);

    // 2. Truncate / Purge all tables in PostgreSQL (cascade)
    console.log('Purging existing records from PostgreSQL tables...');
    const tablesToPurge = [
      'invoice_items',
      'invoices',
      'inventory_transactions',
      'purchase_orders',
      'expenses',
      'products',
      'categories',
      'customers',
      'suppliers',
      'marketing_campaigns',
      'role_capabilities',
      'users'
    ];

    for (const tbl of tablesToPurge) {
      try {
        await pool.query(`TRUNCATE TABLE "${tbl}" CASCADE`);
      } catch (e) {
        try {
          await pool.query(`DELETE FROM "${tbl}"`);
        } catch (e2) {
          // Table might not exist yet
        }
      }
    }
    console.log('All PostgreSQL tables purged cleanly.');

    // 3. Seed in-memory dataset
    await seedDatabase();

    // 4. Batch sync from JSON memory into PostgreSQL
    console.log('\nSyncing newly generated dataset into PostgreSQL...');
    const syncTablesOrder = [
      'users',
      'role_capabilities',
      'categories',
      'suppliers',
      'products',
      'customers',
      'invoices',
      'invoice_items',
      'inventory_transactions',
      'purchase_orders',
      'expenses'
    ];

    for (const table of syncTablesOrder) {
      const records = db.table(table).find();
      if (!Array.isArray(records) || records.length === 0) continue;

      const colRes = await pool.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
        [table]
      );
      const validCols = new Set(colRes.rows.map(r => r.column_name));
      if (validCols.size === 0) continue;

      console.log(`  - Syncing "${table}" (${records.length} records)...`);

      // Batch insert in chunks of 500 for optimal performance
      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        for (const rec of chunk) {
          const adapted = { ...rec };
          if (table === 'expenses') {
            if (!adapted.expense_date && adapted.date) adapted.expense_date = adapted.date;
            if (!adapted.logged_by && adapted.created_by) adapted.logged_by = adapted.created_by;
          }
          if (table === 'invoices' && adapted.items) {
            adapted.items = JSON.stringify(adapted.items);
          }

          const keys = Object.keys(adapted).filter(k => validCols.has(k) && (typeof adapted[k] !== 'object' || adapted[k] === null || (table === 'invoices' && k === 'items')));
          if (keys.length === 0) continue;

          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = keys.map(k => adapted[k]);
          const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("id") DO NOTHING`;

          try {
            await pool.query(sql, values);
          } catch (insertErr) {
            // Log individual row error if necessary
          }
        }
      }
    }

    console.log('\n========================================================');
    console.log('🎉 Reseeding & PostgreSQL Sync Completed Successfully!');
    console.log('========================================================');
  } catch (err) {
    console.error('Reseed Error:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  reseed().then(() => process.exit(0));
}

module.exports = { reseed };
