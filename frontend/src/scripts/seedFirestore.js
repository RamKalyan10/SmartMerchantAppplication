import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DB_PATH = path.join(__dirname, '../../../backend/data/merchant_db.json');
const STORE_ID = 'store_dwdm_001';

async function seed() {
  console.log('Reading local database:', LOCAL_DB_PATH);
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.error('File not found:', LOCAL_DB_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`Found:`);
  console.log(`- Categories: ${data.categories?.length || 0}`);
  console.log(`- Suppliers: ${data.suppliers?.length || 0}`);
  console.log(`- Products: ${data.products?.length || 0}`);
  console.log(`- Customers: ${data.customers?.length || 0}`);

  // Firestore batches can hold up to 500 operations
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalCommitted = 0;

  async function flushBatch() {
    if (batchCount > 0) {
      await batch.commit();
      totalCommitted += batchCount;
      console.log(`Committed batch of ${batchCount} (Total: ${totalCommitted})`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // 1. Categories
  for (const c of (data.categories || [])) {
    const ref = doc(db, 'categories', c.id);
    batch.set(ref, {
      id: c.id,
      storeId: STORE_ID,
      name: c.name,
      code: c.code,
      description: c.description || '',
      createdAt: new Date().toISOString()
    });
    batchCount++;
    if (batchCount >= 450) await flushBatch();
  }

  // 2. Suppliers
  for (const s of (data.suppliers || [])) {
    const ref = doc(db, 'suppliers', s.id);
    batch.set(ref, {
      id: s.id,
      storeId: STORE_ID,
      name: s.name,
      contactPerson: s.contact_person || '',
      phone: s.phone || '',
      email: s.email || '',
      leadTimeDays: Number(s.lead_time_days) || 3,
      address: s.address || '',
      createdAt: new Date().toISOString()
    });
    batchCount++;
    if (batchCount >= 450) await flushBatch();
  }

  // 3. Products
  for (const p of (data.products || [])) {
    const ref = doc(db, 'products', p.id);
    batch.set(ref, {
      id: p.id,
      storeId: STORE_ID,
      name: p.name,
      sku: p.sku,
      category_id: p.category_id,
      category_name: p.category_name,
      supplier_id: p.supplier_id,
      cost_price: Number(p.cost_price || 0),
      selling_price: Number(p.selling_price || 0),
      stock_quantity: Number(p.stock_quantity || 0),
      min_stock_level: Number(p.min_stock_level || 10),
      unit: p.unit || 'Pcs',
      image_url: p.image_url || '',
      lead_time_days: Number(p.lead_time_days || 3),
      barcode: p.barcode || '',
      description: p.description || '',
      createdAt: new Date().toISOString()
    });
    batchCount++;
    if (batchCount >= 450) await flushBatch();
  }

  // 4. Customers
  for (const cu of (data.customers || [])) {
    const ref = doc(db, 'customers', cu.id);
    batch.set(ref, {
      id: cu.id,
      storeId: STORE_ID,
      name: cu.name,
      phone: cu.phone || '',
      email: cu.email || '',
      tier: cu.tier || 'Silver',
      total_spent: Number(cu.total_spent || 0),
      pending_amount: Number(cu.pending_amount || 0),
      orders_count: Number(cu.orders_count || 0),
      address: cu.address || '',
      createdAt: new Date().toISOString()
    });
    batchCount++;
    if (batchCount >= 450) await flushBatch();
  }

  await flushBatch();
  console.log(`✅ Seeding complete! Total records committed to Cloud Firestore: ${totalCommitted}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
