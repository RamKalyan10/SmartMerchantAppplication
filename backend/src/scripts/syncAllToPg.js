require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function syncData() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'smart_merchant'
  });

  try {
    const raw = fs.readFileSync(path.join(__dirname, '../../data/merchant_db.json'), 'utf8');
    const db = JSON.parse(raw);

    console.log('Connected to PostgreSQL database smart_merchant. Starting data sync...');

    // 1. Categories
    for (const cat of db.categories || []) {
      await pool.query(`
        INSERT INTO categories (id, store_id, name, code, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, code = EXCLUDED.code, description = EXCLUDED.description;
      `, [cat.id, cat.store_id || null, cat.name, cat.code, cat.description, cat.created_at || new Date(), cat.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.categories || []).length} categories`);

    // 2. Suppliers
    for (const s of db.suppliers || []) {
      await pool.query(`
        INSERT INTO suppliers (id, store_id, name, contact_person, phone, email, logo_url, lead_time_days, address, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, logo_url = EXCLUDED.logo_url;
      `, [s.id, s.store_id || null, s.name, s.contact_person, s.phone, s.email, s.logo_url || '', s.lead_time_days || 3, s.address || '', s.created_at || new Date(), s.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.suppliers || []).length} suppliers`);

    // 3. Customers
    for (const c of db.customers || []) {
      await pool.query(`
        INSERT INTO customers (id, store_id, name, phone, email, avatar, address, tier, total_spent, orders_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, avatar = EXCLUDED.avatar, total_spent = EXCLUDED.total_spent;
      `, [c.id, c.store_id || null, c.name, c.phone, c.email, c.avatar || '', c.address || '', c.tier || 'Silver', c.total_spent || 0, c.orders_count || 0, c.created_at || new Date(), c.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.customers || []).length} customers`);

    // 4. Products
    for (const p of db.products || []) {
      await pool.query(`
        INSERT INTO products (id, store_id, name, sku, category_id, category_name, supplier_id, cost_price, selling_price, stock_quantity, min_stock_level, unit, image_url, barcode, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, sku = EXCLUDED.sku, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, stock_quantity = EXCLUDED.stock_quantity, image_url = EXCLUDED.image_url;
      `, [p.id, p.store_id || null, p.name, p.sku, p.category_id || null, p.category_name || '', p.supplier_id || null, p.cost_price || 0, p.selling_price || 0, p.stock_quantity || 0, p.min_stock_level || 10, p.unit || 'Units', p.image_url || '', p.barcode || '', p.description || '', p.created_at || new Date(), p.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.products || []).length} products`);

    // 5. Users
    for (const u of db.users || []) {
      await pool.query(`
        INSERT INTO users (id, store_id, name, email, password, role, phone, avatar, business_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, avatar = EXCLUDED.avatar, business_name = EXCLUDED.business_name;
      `, [u.id, u.store_id || `store_${u.id}`, u.name, u.email, u.password, u.role || 'Staff', u.phone || '', u.avatar || '', u.business_name || '', u.created_at || new Date(), u.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.users || []).length} users`);

    // 6. Invoices
    const custIds = new Set((db.customers || []).map(c => c.id));
    for (const inv of db.invoices || []) {
      const validCustId = custIds.has(inv.customer_id) ? inv.customer_id : null;
      await pool.query(`
        INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, items_count, cashier_id, cashier_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO NOTHING;
      `, [inv.id, inv.invoice_number, validCustId, inv.customer_name || 'Walk-in Customer', inv.customer_phone || '', inv.subtotal || 0, inv.discount || 0, inv.tax || 0, inv.total_amount || 0, inv.payment_method || 'Cash', inv.payment_status || 'Paid', inv.items_count || (inv.items?.length || 1), inv.cashier_id || null, inv.cashier_name || 'Staff', inv.created_at || new Date(), inv.updated_at || new Date()]);

      // Invoice Items
      if (Array.isArray(inv.items)) {
        for (const itm of inv.items) {
          await pool.query(`
            INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING;
          `, [itm.id || `item_${Math.random().toString(36).substr(2, 9)}`, inv.id, itm.product_id || null, itm.product_name || 'Item', itm.quantity || 1, itm.unit_price || 0, itm.total_price || 0, inv.created_at || new Date()]);
        }
      }
    }
    console.log(`Synced ${(db.invoices || []).length} invoices and line items`);

    // 7. Expenses
    for (const exp of db.expenses || []) {
      await pool.query(`
        INSERT INTO expenses (id, category, description, amount, payment_method, vendor, logged_by, expense_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;
      `, [exp.id, exp.category || 'General', exp.description || '', exp.amount || 0, exp.payment_method || 'Cash', exp.vendor || '', exp.logged_by || 'Admin', exp.expense_date || new Date(), exp.created_at || new Date(), exp.updated_at || new Date()]);
    }
    console.log(`Synced ${(db.expenses || []).length} expenses`);

    // Check counts
    console.log('\n--- Final PostgreSQL Database Verification ---');
    const tbls = ['users', 'products', 'categories', 'suppliers', 'customers', 'invoices', 'invoice_items', 'expenses'];
    for (const tbl of tbls) {
      const cntRes = await pool.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`Table "${tbl.padEnd(16)}": ${cntRes.rows[0].count} records`);
    }

  } catch (err) {
    console.error('Data sync failed:', err);
  } finally {
    await pool.end();
  }
}

syncData();
