wrequire('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function syncReseededData() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'smart_merchant'
  });

  try {
    console.log('Connecting to PostgreSQL smart_merchant database...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL.');

    const dbPath = path.join(__dirname, '../data/merchant_db.json');
    const raw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(raw);

    console.log(`Loaded merchant_db.json (${db.invoices?.length || 0} invoices).`);

    // 1. Truncate invoices and transactional tables in PostgreSQL
    console.log('Clearing old transaction data in PostgreSQL...');
    await client.query('TRUNCATE TABLE invoice_items, invoices, inventory_transactions, purchase_orders CASCADE;');
    console.log('Truncated invoices, invoice_items, inventory_transactions, purchase_orders.');

    // 2. Insert invoices in chunks
    console.log(`Inserting ${db.invoices.length} invoices into PostgreSQL...`);
    for (let i = 0; i < db.invoices.length; i += 100) {
      const chunk = db.invoices.slice(i, i + 100);
      for (const inv of chunk) {
        await client.query(`
          INSERT INTO invoices (
            id, invoice_number, store_id, customer_id, customer_name, customer_phone,
            customer_email, date, time, total_amount, payment_method, payment_status,
            cashier_name, billed_by, notes, items, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING;
        `, [
          inv.id,
          inv.invoice_number,
          inv.store_id,
          inv.customer_id,
          inv.customer_name,
          inv.customer_phone,
          inv.customer_email,
          inv.date,
          inv.time,
          inv.total_amount,
          inv.payment_method,
          inv.payment_status,
          inv.cashier_name,
          inv.billed_by,
          inv.notes,
          JSON.stringify(inv.items || []),
          inv.created_at,
          inv.created_at
        ]);

        if (Array.isArray(inv.items)) {
          for (let idx = 0; idx < inv.items.length; idx++) {
            const it = inv.items[idx];
            await client.query(`
              INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING;
            `, [
              `${inv.id}_item_${idx + 1}`,
              inv.id,
              it.product_id,
              it.product_name,
              it.quantity,
              it.unit_price,
              it.total_amount,
              inv.created_at
            ]);
          }
        }
      }
    }
    console.log('Invoices and invoice items synced successfully.');

    // 3. Sync Inventory Transactions
    console.log(`Inserting ${db.inventory_transactions?.length || 0} inventory transactions...`);
    for (const tx of db.inventory_transactions || []) {
      await client.query(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, product_name, type, quantity, previous_stock, new_stock,
          reference_id, reason, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING;
      `, [
        tx.id,
        tx.store_id,
        tx.product_id,
        tx.product_name || 'Product',
        tx.type || 'ADJUSTMENT',
        tx.quantity || tx.quantity_change || 0,
        tx.previous_stock || 0,
        tx.new_stock || 0,
        tx.reference_id,
        tx.reason,
        tx.notes,
        tx.created_by,
        tx.created_at
      ]);
    }

    // 4. Sync Purchase Orders
    console.log(`Inserting ${db.purchase_orders?.length || 0} purchase orders...`);
    for (const po of db.purchase_orders || []) {
      await client.query(`
        INSERT INTO purchase_orders (
          id, store_id, supplier_id, product_id, product_name, quantity,
          unit_cost, status, ordered_at, expected_at, received_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING;
      `, [
        po.id,
        po.store_id,
        po.supplier_id,
        po.product_id,
        po.product_name,
        po.quantity,
        po.unit_cost || 0,
        po.status || 'ORDERED',
        po.ordered_at,
        po.expected_at,
        po.received_at,
        po.created_at || po.ordered_at
      ]);
    }

    client.release();
    console.log('✅ Full PostgreSQL transactional synchronization completed successfully!');
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    await pool.end();
  }
}

syncReseededData();
