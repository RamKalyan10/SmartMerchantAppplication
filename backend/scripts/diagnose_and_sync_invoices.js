require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgClient = require('../src/config/pgClient');

async function check() {
  await pgClient.initPostgres();
  const pool = pgClient.getPool();
  const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/merchant_db.json'), 'utf8'));
  const invoices = dbData.invoices || [];
  console.log('Total Invoices in JSON:', invoices.length);

  const pgRes = await pool.query('SELECT id, invoice_number FROM invoices');
  console.log('Total Invoices currently in PostgreSQL:', pgRes.rows.length);
  const pgIdSet = new Set(pgRes.rows.map(r => r.id));

  const missing = invoices.filter(inv => !pgIdSet.has(inv.id));
  console.log('Count of invoices missing from PostgreSQL:', missing.length);

  // Check unique constraints or foreign key violations
  let fkCustErrors = 0;
  let uniqueInvNumErrors = 0;
  let otherErrors = 0;

  for (const rec of missing) {
    try {
      await pool.query(`
        INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, items_count, cashier_id, cashier_name, created_at, updated_at, store_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          invoice_number = EXCLUDED.invoice_number,
          total_amount = EXCLUDED.total_amount
      `, [
        rec.id, 
        rec.invoice_number || `INV-${rec.id}`, 
        rec.customer_id || null, 
        rec.customer_name || 'Walk-in Customer',
        rec.customer_phone || '', 
        rec.subtotal || 0, 
        rec.discount || 0, 
        rec.tax || 0, 
        rec.total_amount || 0,
        rec.payment_method || 'Cash', 
        rec.payment_status || 'Paid', 
        rec.items?.length || 0,
        rec.cashier_id || null, 
        rec.cashier_name || null, 
        rec.created_at || new Date().toISOString(),
        rec.updated_at || new Date().toISOString(), 
        rec.store_id || 'default_store'
      ]);
    } catch (err) {
      if (err.message.includes('foreign key constraint "invoices_customer_id_fkey"')) {
        fkCustErrors++;
        // Insert with customer_id = null if customer does not exist in customers table
        try {
          await pool.query(`
            INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, items_count, cashier_id, cashier_name, created_at, updated_at, store_id)
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `, [
            rec.id, 
            rec.invoice_number || `INV-${rec.id}`, 
            rec.customer_name || 'Walk-in Customer',
            rec.customer_phone || '', 
            rec.subtotal || 0, 
            rec.discount || 0, 
            rec.tax || 0, 
            rec.total_amount || 0,
            rec.payment_method || 'Cash', 
            rec.payment_status || 'Paid', 
            rec.items?.length || 0,
            rec.cashier_id || null, 
            rec.cashier_name || null, 
            rec.created_at || new Date().toISOString(),
            rec.updated_at || new Date().toISOString(), 
            rec.store_id || 'default_store'
          ]);
        } catch (e) {
          if (e.message.includes('unique constraint "invoices_invoice_number_key"')) {
            uniqueInvNumErrors++;
            // Make invoice number globally unique across stores
            const uniqueNum = `${rec.invoice_number}-${rec.id.slice(-4)}`;
            await pool.query(`
              INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, items_count, cashier_id, cashier_name, created_at, updated_at, store_id)
              VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `, [
              rec.id, 
              uniqueNum, 
              rec.customer_name || 'Walk-in Customer',
              rec.customer_phone || '', 
              rec.subtotal || 0, 
              rec.discount || 0, 
              rec.tax || 0, 
              rec.total_amount || 0,
              rec.payment_method || 'Cash', 
              rec.payment_status || 'Paid', 
              rec.items?.length || 0,
              rec.cashier_id || null, 
              rec.cashier_name || null, 
              rec.created_at || new Date().toISOString(),
              rec.updated_at || new Date().toISOString(), 
              rec.store_id || 'default_store'
            ]);
          }
        }
      } else if (err.message.includes('unique constraint "invoices_invoice_number_key"')) {
        uniqueInvNumErrors++;
        const uniqueNum = `${rec.invoice_number}-${rec.id.slice(-4)}`;
        await pool.query(`
          INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, items_count, cashier_id, cashier_name, created_at, updated_at, store_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          rec.id, 
          uniqueNum, 
          rec.customer_id || null,
          rec.customer_name || 'Walk-in Customer',
          rec.customer_phone || '', 
          rec.subtotal || 0, 
          rec.discount || 0, 
          rec.tax || 0, 
          rec.total_amount || 0,
          rec.payment_method || 'Cash', 
          rec.payment_status || 'Paid', 
          rec.items?.length || 0,
          rec.cashier_id || null, 
          rec.cashier_name || null, 
          rec.created_at || new Date().toISOString(),
          rec.updated_at || new Date().toISOString(), 
          rec.store_id || 'default_store'
        ]);
      } else {
        otherErrors++;
        console.error('Other error on rec', rec.id, err.message);
      }
    }
  }

  console.log('FK Customer errors resolved:', fkCustErrors);
  console.log('Unique invoice number collisions resolved:', uniqueInvNumErrors);

  // Now sync all missing invoice items
  console.log('\nSyncing invoice line items into PostgreSQL...');
  for (const inv of invoices) {
    if (Array.isArray(inv.items)) {
      for (let idx = 0; idx < inv.items.length; idx++) {
        const it = inv.items[idx];
        const itemId = it.id || `item_${inv.id}_${idx}`;
        try {
          await pool.query(`
            INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `, [
            itemId,
            inv.id,
            it.product_id || null,
            it.product_name || 'Product',
            it.quantity || 1,
            it.unit_price || 0,
            it.total_amount || (it.quantity * it.unit_price) || 0,
            inv.created_at || new Date().toISOString()
          ]);
        } catch (itemErr) {
          // If FK on product fails, insert with product_id = NULL
          await pool.query(`
            INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at)
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
          `, [
            itemId,
            inv.id,
            it.product_name || 'Product',
            it.quantity || 1,
            it.unit_price || 0,
            it.total_amount || (it.quantity * it.unit_price) || 0,
            inv.created_at || new Date().toISOString()
          ]);
        }
      }
    }
  }

  const finalInvCount = await pool.query('SELECT count(*) FROM invoices');
  const finalItemCount = await pool.query('SELECT count(*) FROM invoice_items');
  console.log('\n=============================================');
  console.log('✅ Final PostgreSQL Invoices Count:', finalInvCount.rows[0].count);
  console.log('✅ Final PostgreSQL Invoice Items Count:', finalItemCount.rows[0].count);
  console.log('=============================================\n');

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
