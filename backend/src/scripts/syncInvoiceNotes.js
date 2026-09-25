const db = require('../config/db');
const pgClient = require('../config/pgClient');

async function syncNotes() {
  const invs = db.data.invoices || [];
  for (const inv of invs) {
    const d = new Date(inv.date || inv.created_at);
    const dow = d.getDay();
    inv.notes = (dow === 0 || dow === 6) ? 'Weekend' : 'Working Day';
  }
  db.save();
  console.log('✅ merchant_db.json invoices notes updated.');

  if (pgClient.isPgConnected()) {
    const pool = pgClient.getPool();
    if (pool) {
      await pool.query(`
        UPDATE invoices
        SET notes = CASE 
          WHEN EXTRACT(DOW FROM TO_DATE(date, 'YYYY-MM-DD')) IN (0, 6) THEN 'Weekend'
          ELSE 'Working Day'
        END
      `);
      console.log('✅ PostgreSQL invoices notes updated.');
    }
  }
}

syncNotes().catch(console.error);
