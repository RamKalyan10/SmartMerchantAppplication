require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const pgClient = require('../src/config/pgClient');

async function standardizeDates() {
  console.log('🔄 Starting date format audit and standardization across DB...');

  await pgClient.initPostgres();
  const pool = pgClient.getPool();

  let invoicesFixed = 0;
  const invoices = db.data.invoices || [];

  for (const inv of invoices) {
    let modified = false;

    // 1. Ensure date is in YYYY-MM-DD format
    if (!inv.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(inv.date))) {
      let derivedDate = '';
      if (inv.created_at) {
        const d = new Date(inv.created_at);
        if (!isNaN(d.getTime())) {
          derivedDate = d.toISOString().split('T')[0];
        }
      } else if (inv.invoice_number && inv.invoice_number.includes('-2026')) {
        // e.g. INV-20260515-017
        const parts = inv.invoice_number.split('-');
        if (parts[1] && parts[1].length === 8) {
          const y = parts[1].substring(0, 4);
          const m = parts[1].substring(4, 6);
          const d = parts[1].substring(6, 8);
          derivedDate = `${y}-${m}-${d}`;
        }
      }

      if (!derivedDate) {
        derivedDate = '2026-09-15';
      }

      inv.date = derivedDate;
      modified = true;
    }

    // 2. Ensure time is populated
    if (!inv.time) {
      if (inv.created_at) {
        const d = new Date(inv.created_at);
        if (!isNaN(d.getTime())) {
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const minutes = String(d.getUTCMinutes()).padStart(2, '0');
          inv.time = `${hours}:${minutes}`;
        } else {
          inv.time = '12:00';
        }
      } else {
        inv.time = '12:00';
      }
      modified = true;
    }

    // 3. Ensure notes have a clean default if empty
    if (!inv.notes) {
      const d = new Date(inv.date);
      const dow = d.getDay();
      if (dow === 0) inv.notes = '🌟 Sunday Peak';
      else if (dow === 6) inv.notes = '🛒 Saturday Rush';
      else if (dow === 2 || dow === 3 || dow === 4) inv.notes = '🏢 Workday Lull';
      else inv.notes = 'Regular Day';
      modified = true;
    }

    if (modified) {
      invoicesFixed++;
    }
  }

  // Save to JSON database
  db.save();
  console.log(`✅ Standardized dates on ${invoicesFixed} invoices in JSON store.`);

  // Update PostgreSQL
  if (pgClient.isPgConnected() && pool) {
    console.log('🔄 Syncing date standardization to PostgreSQL...');
    
    await pool.query(`
      ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS date VARCHAR(64);
      ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS time VARCHAR(64);
      ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    for (const inv of invoices) {
      await pool.query(
        `UPDATE invoices SET date = $1, time = $2, notes = $3 WHERE id = $4`,
        [inv.date, inv.time, inv.notes || '', inv.id]
      );
    }
    console.log(`✅ Updated PostgreSQL invoices table with standardized dates.`);
  }

  // Audit expenses
  let expFixed = 0;
  const expenses = db.data.expenses || [];
  for (const exp of expenses) {
    let modified = false;
    if (!exp.date && exp.expense_date) {
      exp.date = String(exp.expense_date).split('T')[0];
      modified = true;
    } else if (exp.date && !exp.expense_date) {
      exp.expense_date = exp.date;
      modified = true;
    }
    if (modified) expFixed++;
  }
  if (expFixed > 0) {
    db.save();
    console.log(`✅ Standardized ${expFixed} expense dates.`);
  }

  console.log('🎉 Date standardization completed successfully!');
  process.exit(0);
}

standardizeDates().catch(err => {
  console.error('Error during date standardization:', err);
  process.exit(1);
});
