require('dotenv').config();
const pgClient = require('../src/config/pgClient');

async function inspect() {
  await pgClient.initPostgres();
  const pool = pgClient.getPool();
  const tables = ['users', 'categories', 'suppliers', 'products', 'customers', 'invoices', 'invoice_items', 'expenses', 'inventory_transactions'];
  console.log('\n📊 POSTGRESQL RECORD COUNTS:');
  for (const t of tables) {
    const countRes = await pool.query(`SELECT count(*) FROM "${t}"`);
    console.log(`- ${t.padEnd(22)}: ${countRes.rows[0].count} rows`);
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
