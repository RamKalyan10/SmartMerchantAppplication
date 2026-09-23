require('dotenv').config();
const pgClient = require('../src/config/pgClient');

async function testSql() {
  await pgClient.initPostgres();
  const pool = pgClient.getPool();

  const record = {
    id: 'test_prod_001',
    store_id: 'store_dwdm_001',
    name: 'Test Elaichi',
    sku: 'SKU-TEST-001',
    category_id: null,
    category_name: 'Spices',
    supplier_id: null,
    cost_price: 50,
    selling_price: 70,
    stock_quantity: 20,
    min_stock_level: 5,
    unit: 'Packs'
  };

  const keys = Object.keys(record).filter(k => typeof record[k] !== 'object' || record[k] === null);
  const cols = keys.map(k => `"${k}"`).join(', ');
  const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
  const values = keys.map(k => record[k]);
  const updateClauses = keys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

  const sql = `INSERT INTO "products" (${cols}) VALUES (${placeholders}) ON CONFLICT ("id") DO UPDATE SET ${updateClauses || '"id" = EXCLUDED."id"'}`;
  console.log('SQL:', sql);
  console.log('Values:', values);

  try {
    const res = await pool.query(sql, values);
    console.log('Query result:', res.rowCount);
    await pool.query('DELETE FROM products WHERE id = $1', ['test_prod_001']);
  } catch (e) {
    console.error('Query error:', e.message);
  }
  process.exit(0);
}
testSql();
