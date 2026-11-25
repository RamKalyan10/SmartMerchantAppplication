const fs = require('fs');
const path = require('path');
const pgClient = require('./pgClient');

// Local file-backed database storage engine for seamless operation
const DB_FILE = path.join(__dirname, '../../data/merchant_db.json');
const DATA_DIR = path.dirname(DB_FILE);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class DatabaseStore {
  constructor() {
    this._pgColumnsCache = new Map();
    this._syncingAll = false;
    this.data = {
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
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        let raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.charCodeAt(0) === 0xFEFF) {
          raw = raw.slice(1);
        }
        this.data = { ...this.data, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Error loading database file:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving database file:', e.message);
    }
  }

  // Get status of database engine
  getStatus() {
    const pgStatus = pgClient.getPgStatus();
    return {
      ...pgStatus,
      tables: Object.keys(this.data).map(key => ({
        name: key,
        count: this.data[key]?.length || 0
      }))
    };
  }

  // Direct PostgreSQL query execution helper
  async query(sql, params = []) {
    if (pgClient.isPgConnected()) {
      const pool = pgClient.getPool();
      return pool.query(sql, params);
    }
    return null;
  }

  // Generic table accessors with sync to both memory/file and PostgreSQL
  table(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }

    return {
      find: (predicate = () => true) => this.data[name].filter(predicate),
      findOne: (predicate) => this.data[name].find(predicate),
      findById: (id) => this.data[name].find((item) => String(item.id) === String(id)),
      insert: (record, autoSave = true) => {
        const now = new Date().toISOString();
        const newRecord = {
          id: record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          created_at: now,
          updated_at: now,
          ...record
        };
        this.data[name].push(newRecord);
        if (autoSave) {
          this.save();
        }

        // Background sync to PostgreSQL if connected
        if (pgClient.isPgConnected() && autoSave) {
          this.syncInsertToPg(name, newRecord).catch(err => {
            console.error(`PostgreSQL sync error on ${name}:`, err.message);
          });
        }

        return newRecord;
      },
      insertMany: (records) => {
        const now = new Date().toISOString();
        const inserted = records.map(record => ({
          id: record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          created_at: now,
          updated_at: now,
          ...record
        }));
        this.data[name].push(...inserted);
        this.save();
        if (pgClient.isPgConnected()) {
          inserted.forEach(r => this.syncInsertToPg(name, r).catch(() => {}));
        }
        return inserted;
      },
      update: (id, updates, autoSave = true) => {
        const index = this.data[name].findIndex((item) => String(item.id) === String(id));
        if (index === -1) return null;
        this.data[name][index] = {
          ...this.data[name][index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        if (autoSave) {
          this.save();
        }
        if (pgClient.isPgConnected()) {
          this.syncUpdateToPg(name, id, this.data[name][index]).catch(() => {});
        }
        return this.data[name][index];
      },
      delete: (id) => {
        const index = this.data[name].findIndex((item) => String(item.id) === String(id));
        if (index === -1) return false;
        this.data[name].splice(index, 1);
        this.save();
        if (pgClient.isPgConnected()) {
          this.syncDeleteFromPg(name, id).catch(() => {});
        }
        return true;
      },
      count: (predicate = () => true) => this.data[name].filter(predicate).length
    };
  }

  async getValidColumns(tableName) {
    if (this._pgColumnsCache.has(tableName)) {
      return this._pgColumnsCache.get(tableName);
    }
    const pool = pgClient.getPool();
    if (!pool || !pgClient.isPgConnected()) return new Set();

    const colRes = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      [tableName]
    );
    const validCols = new Set(colRes.rows.map(r => r.column_name));
    if (validCols.size > 0) {
      this._pgColumnsCache.set(tableName, validCols);
    }
    return validCols;
  }

  async syncUpdateToPg(tableName, id, record) {
    try {
      const pool = pgClient.getPool();
      if (!pool || !pgClient.isPgConnected()) return;
      const validCols = await this.getValidColumns(tableName);
      const keys = Object.keys(record).filter(k =>
        k !== 'id' &&
        (validCols.size === 0 || validCols.has(k)) &&
        (typeof record[k] !== 'object' || record[k] === null || (tableName === 'invoices' && k === 'items'))
      );
      if (keys.length === 0) return;

      const setClauses = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
      const values = keys.map(k =>
        tableName === 'invoices' && k === 'items' && record[k] !== null && typeof record[k] !== 'string'
          ? JSON.stringify(record[k])
          : record[k]
      );
      values.push(id);

      const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE "id" = $${values.length}`;
      await pool.query(sql, values);
    } catch (e) {
      // Table might not exist or non-matching column
    }
  }

  async syncDeleteFromPg(tableName, id) {
    try {
      const pool = pgClient.getPool();
      if (!pool || !pgClient.isPgConnected()) return;
      await pool.query(`DELETE FROM "${tableName}" WHERE "id" = $1`, [id]);
    } catch (e) {
      // Table might not exist
    }
  }

  async syncInsertToPg(tableName, record) {
    try {
      const pool = pgClient.getPool();
      if (!pool || !pgClient.isPgConnected()) return;

      const validCols = await this.getValidColumns(tableName);
      if (validCols.size === 0) return;

      const adaptedRecord = { ...record };
      if (tableName === 'expenses') {
        if (!adaptedRecord.expense_date && adaptedRecord.date) adaptedRecord.expense_date = adaptedRecord.date;
        if (!adaptedRecord.logged_by && adaptedRecord.created_by) adaptedRecord.logged_by = adaptedRecord.created_by;
      }

      const keys = Object.keys(adaptedRecord).filter(k =>
        validCols.has(k) &&
        (typeof adaptedRecord[k] !== 'object' || adaptedRecord[k] === null || (tableName === 'invoices' && k === 'items'))
      );
      if (keys.length === 0) return;
      
      const cols = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = keys.map(k =>
        tableName === 'invoices' && k === 'items' && adaptedRecord[k] !== null && typeof adaptedRecord[k] !== 'string'
          ? JSON.stringify(adaptedRecord[k])
          : adaptedRecord[k]
      );

      const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("id") DO UPDATE SET ${keys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ') || '"id" = EXCLUDED."id"'}`;
      
      try {
        await pool.query(sql, values);
      } catch (insertErr) {
        if (tableName === 'invoices' && insertErr.message.includes('foreign key constraint')) {
          // Retry invoice with customer_id = null if customer is missing in PG
          const custIdx = keys.indexOf('customer_id');
          if (custIdx !== -1) {
            values[custIdx] = null;
            await pool.query(sql, values);
          }
        } else {
          console.warn(`PostgreSQL insert warning on ${tableName}:`, insertErr.message);
        }
      }

      // If inserting an invoice, also insert its line items into invoice_items
      if (tableName === 'invoices' && Array.isArray(record.items)) {
        for (let idx = 0; idx < record.items.length; idx++) {
          const it = record.items[idx];
          const itemId = it.id || `item_${record.id}_${idx}`;
          const itemSql = `
            INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_price, total_price, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT ("id") DO UPDATE SET
              product_name = EXCLUDED.product_name,
              quantity = EXCLUDED.quantity,
              unit_price = EXCLUDED.unit_price,
              total_price = EXCLUDED.total_price
          `;
          try {
            await pool.query(itemSql, [
              itemId,
              record.id,
              it.product_id || null,
              it.product_name || 'Item',
              it.quantity || 1,
              it.unit_price || 0,
              it.total_amount || (it.quantity * it.unit_price) || 0,
              record.created_at || new Date().toISOString()
            ]);
          } catch (e) {
            // If product FK fails, insert with product_id = null
            await pool.query(itemSql, [
              itemId,
              record.id,
              null,
              it.product_name || 'Item',
              it.quantity || 1,
              it.unit_price || 0,
              it.total_amount || (it.quantity * it.unit_price) || 0,
              record.created_at || new Date().toISOString()
            ]).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn(`PostgreSQL sync error on ${tableName}:`, e.message);
    }
  }

  async loadFromPostgres() {
    if (!pgClient.isPgConnected()) return;
    const pool = pgClient.getPool();
    if (!pool) return;

    try {
      const tables = ['users', 'categories', 'suppliers', 'products', 'customers', 'invoices', 'expenses', 'inventory_transactions', 'purchase_orders'];
      let loadedAny = false;

      for (const t of tables) {
        try {
          const res = await pool.query(`SELECT * FROM "${t}"`);
          if (res.rows && res.rows.length > 0) {
            loadedAny = true;
            if (!this.data[t] || this.data[t].length === 0) {
              this.data[t] = res.rows;
            } else {
              const localMap = new Map(this.data[t].map(item => [String(item.id), item]));
              res.rows.forEach(pgRow => {
                if (!localMap.has(String(pgRow.id))) {
                  this.data[t].push(pgRow);
                }
              });
            }
          }
        } catch (tableErr) {
          // Table query notice
        }
      }

      // Backfill invoice.items from invoice_items if any loaded invoice has null/empty items
      const invoicesNeedingItems = (this.data.invoices || []).filter(inv => !Array.isArray(inv.items));
      if (invoicesNeedingItems.length > 0) {
        try {
          const itemsRes = await pool.query('SELECT * FROM "invoice_items"');
          if (itemsRes.rows && itemsRes.rows.length > 0) {
            const productCostMap = new Map(
              (this.data.products || []).map(p => [String(p.id), Number(p.cost_price || 0)])
            );
            const itemsByInvoice = new Map();
            for (const row of itemsRes.rows) {
              const invId = String(row.invoice_id);
              if (!itemsByInvoice.has(invId)) itemsByInvoice.set(invId, []);
              itemsByInvoice.get(invId).push({
                product_id: row.product_id,
                product_name: row.product_name,
                quantity: Number(row.quantity || 0),
                unit_price: Number(row.unit_price || 0),
                cost_price: row.product_id ? (productCostMap.get(String(row.product_id)) || 0) : 0,
                total_amount: Number(row.total_price || 0)
              });
            }
            for (const inv of invoicesNeedingItems) {
              inv.items = itemsByInvoice.get(String(inv.id)) || [];
            }
          }
        } catch (e) {
          // invoice_items fallback notice
        }
      }

      if (loadedAny) {
        this.save();
        console.log('✅ Synchronized and reconciled records from PostgreSQL database.');
      }
    } catch (err) {
      console.warn('PostgreSQL load notice:', err.message);
    }
  }

  async syncAllToPostgres() {
    if (!pgClient.isPgConnected() || this._syncingAll) return;
    const pool = pgClient.getPool();
    if (!pool) return;

    this._syncingAll = true;
    try {
      await pool.query(`
        ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(14, 2) DEFAULT 0.00;
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS date VARCHAR(64);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS time VARCHAR(64);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS items JSONB;
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS billed_by VARCHAR(255);
        ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
        ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS date VARCHAR(64);
        ALTER TABLE IF EXISTS inventory_transactions ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);
        ALTER TABLE IF EXISTS inventory_transactions ALTER COLUMN type SET DEFAULT 'ADJUSTMENT';
        ALTER TABLE IF EXISTS inventory_transactions ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(50);
        ALTER TABLE IF EXISTS inventory_transactions ADD COLUMN IF NOT EXISTS reason TEXT;
        ALTER TABLE IF EXISTS inventory_transactions ADD COLUMN IF NOT EXISTS adjusted_by VARCHAR(255);
      `);
      this._pgColumnsCache.clear();

      const tables = ['users', 'categories', 'suppliers', 'products', 'customers', 'invoices', 'expenses', 'inventory_transactions', 'purchase_orders'];
      const CHUNK_SIZE = 10;
      let totalSynced = 0;

      for (const t of tables) {
        const records = this.data[t] || [];
        if (records.length === 0) continue;

        let existingIdSet = new Set();
        try {
          const idRes = await pool.query(`SELECT id FROM "${t}"`);
          existingIdSet = new Set(idRes.rows.map(r => String(r.id)));
        } catch (e) {}

        const missing = records.filter(r => !existingIdSet.has(String(r.id)));
        for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
          const chunk = missing.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(rec => this.syncInsertToPg(t, rec)));
        }
        totalSynced += missing.length;
      }

      if (totalSynced > 0) {
        console.log(`✅ PostgreSQL background sync complete (${totalSynced} records synced).`);
      }
    } catch (err) {
      console.warn('Sync notice:', err.message);
    } finally {
      this._syncingAll = false;
    }
  }
}

const db = new DatabaseStore();

module.exports = db;
