require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgClient = require('../src/config/pgClient');
const { seedDatabase } = require('../src/seeds/seedData');

async function syncAllToPostgres() {
  console.log('🌱 Reseeding database with store-unique invoice IDs...');
  seedDatabase();

  console.log('🔄 Initializing PostgreSQL connection for full database synchronization...');
  const connected = await pgClient.initPostgres();
  if (!connected) {
    console.error('❌ Could not connect to PostgreSQL. Check credentials in .env');
    process.exit(1);
  }

  const pool = pgClient.getPool();
  const dbJsonPath = path.join(__dirname, '../data/merchant_db.json');
  if (!fs.existsSync(dbJsonPath)) {
    console.error('❌ merchant_db.json file not found at:', dbJsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbJsonPath, 'utf8');
  const dbData = JSON.parse(raw);

  // 1. Ensure any missing columns exist & truncate old/unwanted tables
  console.log('🛠️ Verifying database schema columns & clearing old non-dwdm records...');
  await pool.query(`
    ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
    ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
    ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS date VARCHAR(64);
    TRUNCATE TABLE users, categories, suppliers, products, customers, invoices, invoice_items, expenses, inventory_transactions CASCADE;
  `);

  // Helper batch inserter / upsert
  async function syncTable(tableName, records, primaryKey = 'id') {
    if (!records || records.length === 0) return 0;
    
    // Get existing columns in PG table
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    const validCols = new Set(colRes.rows.map(r => r.column_name));

    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      for (const rec of batch) {
        const filteredKeys = Object.keys(rec).filter(k => validCols.has(k) && (typeof rec[k] !== 'object' || rec[k] === null));
        if (filteredKeys.length === 0) continue;

        const colsStr = filteredKeys.map(k => `"${k}"`).join(', ');
        const placeholders = filteredKeys.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = filteredKeys.map(k => rec[k]);
        const updateStr = filteredKeys
          .filter(k => k !== primaryKey)
          .map(k => `"${k}" = EXCLUDED."${k}"`)
          .join(', ');

        const sql = `
          INSERT INTO "${tableName}" (${colsStr}) 
          VALUES (${placeholders}) 
          ON CONFLICT ("${primaryKey}") 
          DO UPDATE SET ${updateStr || `"${primaryKey}" = EXCLUDED."${primaryKey}"`}
        `;

        try {
          await pool.query(sql, values);
          insertedCount++;
        } catch (err) {
          // Log first few errors if any
          if (i === 0 && insertedCount < 3) {
            console.warn(`Warning inserting into ${tableName} (${rec[primaryKey]}):`, err.message);
          }
        }
      }
    }
    return insertedCount;
  }

  console.log('\n📦 Syncing entities from JSON database into PostgreSQL...');

  // 1. Users
  const userCount = await syncTable('users', dbData.users || []);
  console.log(`✅ Users synced: ${userCount}`);

  // 2. Categories
  const catCount = await syncTable('categories', dbData.categories || []);
  console.log(`✅ Categories synced: ${catCount}`);

  // 3. Suppliers
  const supCount = await syncTable('suppliers', dbData.suppliers || []);
  console.log(`✅ Suppliers synced: ${supCount}`);

  // 4. Products
  const prodCount = await syncTable('products', dbData.products || []);
  console.log(`✅ Products synced: ${prodCount}`);

  // 5. Customers
  const custCount = await syncTable('customers', dbData.customers || []);
  console.log(`✅ Customers synced: ${custCount}`);

  // 6. Invoices
  const invRecords = dbData.invoices || [];
  const invCount = await syncTable('invoices', invRecords);
  console.log(`✅ Invoices synced: ${invCount}`);

  // 7. Invoice Items (Extract line items from all invoices)
  const allInvoiceItems = [];
  invRecords.forEach(inv => {
    if (Array.isArray(inv.items)) {
      inv.items.forEach((it, idx) => {
        allInvoiceItems.push({
          id: it.id || `item_${inv.id}_${idx}_${it.product_id || idx}`,
          invoice_id: inv.id,
          product_id: it.product_id || null,
          product_name: it.product_name || 'Item',
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_amount || (it.quantity * it.unit_price) || 0,
          created_at: inv.created_at || new Date().toISOString()
        });
      });
    }
  });

  const itemTableCount = await syncTable('invoice_items', allInvoiceItems);
  console.log(`✅ Invoice Items synced: ${itemTableCount} lines`);

  // 8. Expenses
  const expCount = await syncTable('expenses', dbData.expenses || []);
  console.log(`✅ Expenses synced: ${expCount}`);

  // 9. Inventory Transactions
  const txCount = await syncTable('inventory_transactions', dbData.inventory_transactions || []);
  console.log(`✅ Inventory Transactions synced: ${txCount}`);

  // Final Verification
  console.log('\n========================================================');
  console.log('📊 FINAL POSTGRESQL DATABASE RECORD COUNTS');
  console.log('========================================================');
  const tables = ['users', 'categories', 'suppliers', 'products', 'customers', 'invoices', 'invoice_items', 'expenses'];
  for (const t of tables) {
    const res = await pool.query(`SELECT count(*) FROM "${t}"`);
    console.log(`📌 ${t.padEnd(20)}: ${res.rows[0].count} rows in PostgreSQL`);
  }
  console.log('========================================================\n');
  console.log('🎉 Full Database Synchronization Completed Successfully!');
  process.exit(0);
}

syncAllToPostgres().catch(err => {
  console.error('Fatal Sync Error:', err);
  process.exit(1);
});
