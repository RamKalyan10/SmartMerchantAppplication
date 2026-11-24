const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pgClient = require('../config/pgClient');
const db = require('../config/db');
const { simulateStockHistory } = require('../seeds/stockHistory');
const {
  CATEGORIES_MASTER,
  SUPPLIERS_MASTER,
  CUSTOMERS_MASTER,
  PRODUCTS_MASTER,
  FESTIVALS_2026: BASE_FESTIVALS
} = require('../seeds/seedData');

// Extended 2026 Festivals covering full year up to Nov 24, 2026
const FESTIVALS_2026 = {
  ...BASE_FESTIVALS,
  '2026-10-02': { name: 'Gandhi Jayanti Public Holiday Shopping', multiplier: 1.4 },
  '2026-10-18': { name: 'Maha Saptami / Durga Puja Festive Rush', multiplier: 1.65 },
  '2026-10-19': { name: 'Maha Ashtami / Navratri Pooja Preparations', multiplier: 1.85 },
  '2026-10-20': { name: 'Vijaya Dashami / Dussehra Grand Celebrations', multiplier: 2.0 },
  '2026-11-06': { name: 'Dhanteras Utensils & Gold Festive Rush', multiplier: 1.85 },
  '2026-11-08': { name: 'Diwali / Lakshmi Pooja Grand Rush', multiplier: 2.2 },
  '2026-11-09': { name: 'Govardhan Pooja & New Year Shopping', multiplier: 1.85 },
  '2026-11-10': { name: 'Bhai Dooj Sweets & Gifts Exchange', multiplier: 1.7 },
  '2026-11-15': { name: 'Chhath Puja Offerings & Essentials', multiplier: 1.6 }
};

const WALKIN_NAMES = [
  'Rahul Verma', 'Sneha Reddy', 'Amitabh Sen', 'Pooja Hegde', 'Karthik Raja',
  'Deepa Nair', 'Vikram Joshi', 'Ananya Deshmukh', 'Manoj Tiwari', 'Kavita Menon',
  'Siddharth Roy', 'Neha Choudhary', 'Arun Kumar', 'Swati Mishra', 'Harish Gowda',
  'Divya Pillai', 'Rohan Gupta', 'Meera Krishnan', 'Gautam Singhania', 'Bhavna Chawla',
  'Kishore Bajaj', 'Shreya Ghoshal', 'Naveen Jindal', 'Rashmi Bansal', 'Sanjay Dutt'
];

async function seedUserStore() {
  console.log('========================================================');
  console.log('🛒 Smart Merchant - Multi-Store Transaction Generator');
  console.log('   Target Account: tramkalyanrahul@gmail.com');
  console.log('   Date Range: 2026-01-01 to 2026-11-24 (328 Days)');
  console.log('========================================================\n');

  await pgClient.initPostgres();
  const pool = pgClient.getPool();

  const storeId = 'store_3ARkiW0rCQPuLIFNCalRLrMcOjn1';
  const ownerUserId = '3ARkiW0rCQPuLIFNCalRLrMcOjn1';
  const cashierUserId = 'rec_1795455736964_s7vxxo';
  const hashedPassword = await bcrypt.hash('123456', 10);

  // 1. Prepare Users
  const users = [
    {
      id: ownerUserId,
      store_id: storeId,
      name: 'Thirandi Ram kalyan',
      email: 'tramkalyanrahul@gmail.com',
      password: hashedPassword,
      role: 'Owner',
      phone: '+91 99887 76655',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      business_name: "Thirandi Ram kalyan's Store"
    },
    {
      id: cashierUserId,
      store_id: storeId,
      name: 'mani',
      email: 'mani@gmail.com',
      password: hashedPassword,
      role: 'Staff',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      business_name: "Thirandi Ram kalyan's Store",
      salary: 12000
    }
  ];

  // 2. Clean existing records for this store
  console.log('Cleaning existing records for store:', storeId);
  if (pool) {
    const cleanTables = [
      'DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE store_id = $1)',
      'DELETE FROM invoices WHERE store_id = $1',
      'DELETE FROM inventory_transactions WHERE store_id = $1',
      'DELETE FROM purchase_orders WHERE store_id = $1',
      'DELETE FROM expenses WHERE store_id = $1',
      'DELETE FROM products WHERE store_id = $1',
      'DELETE FROM customers WHERE store_id = $1',
      'DELETE FROM categories WHERE store_id = $1',
      'DELETE FROM suppliers WHERE store_id = $1'
    ];
    for (const q of cleanTables) {
      await pool.query(q, [storeId]);
    }
  }

  // 3. Setup Categories, Suppliers, Customers, Products
  const categories = CATEGORIES_MASTER.map(c => ({ ...c, store_id: storeId }));
  const suppliers = SUPPLIERS_MASTER.map(s => ({ ...s, store_id: storeId }));
  const customers = CUSTOMERS_MASTER.map(c => ({ ...c, store_id: storeId, total_spent: 0, orders_count: 0 }));
  const products = PRODUCTS_MASTER.map(p => ({ ...p, store_id: storeId }));

  // 4. Generate daily invoices from 2026-01-01 to 2026-11-24
  console.log('Generating daily POS sales invoices (2026-01-01 to 2026-11-24)...');
  const invoices = [];
  const invoiceItems = [];
  const customerSpendMap = {};
  customers.forEach(c => { customerSpendMap[c.id] = { total: 0, count: 0 }; });

  let invoiceSeq = 1;
  const startDate = new Date('2026-01-01T00:00:00Z');
  const endDate = new Date('2026-11-24T00:00:00Z');
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1;

  for (let d = 0; d < totalDays; d++) {
    const currentDay = new Date(startDate.getTime() + d * dayMs);
    const dateStr = currentDay.toISOString().slice(0, 10);
    const dayOfWeek = currentDay.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const festival = FESTIVALS_2026[dateStr];

    // Determine invoice count for the day
    let dailyInvoiceCount = 18 + Math.floor(Math.sin(d * 0.3) * 4) + (d % 5);
    if (isFriday) dailyInvoiceCount = Math.round(dailyInvoiceCount * 1.25);
    if (isWeekend) dailyInvoiceCount = Math.round(dailyInvoiceCount * 1.45);
    if (festival) dailyInvoiceCount = Math.round(dailyInvoiceCount * festival.multiplier);

    // On today (2026-11-24), generate half-day morning/afternoon transactions
    if (dateStr === '2026-11-24') {
      dailyInvoiceCount = Math.max(12, Math.floor(dailyInvoiceCount * 0.6));
    }

    for (let i = 0; i < dailyInvoiceCount; i++) {
      const invId = `INV-2026-${String(invoiceSeq++).padStart(6, '0')}`;
      
      // Random hour between 09:30 and 21:30
      const hour = 9 + Math.floor((i / dailyInvoiceCount) * 12);
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      const createdAt = `${dateStr}T${timeStr}.000Z`;

      // Customer selection
      const isRegular = Math.random() < 0.35;
      let customerId = null;
      let customerName = '';
      let customerPhone = '';
      let customerEmail = '';

      if (isRegular) {
        const cust = customers[i % customers.length];
        customerId = cust.id;
        customerName = cust.name;
        customerPhone = cust.phone;
        customerEmail = cust.email;
      } else {
        customerName = WALKIN_NAMES[(i + d) % WALKIN_NAMES.length];
        customerPhone = `+91 ${98000 + (i % 999)} ${10000 + (d % 89999)}`;
        customerEmail = `${customerName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
      }

      // Pick 2 to 5 distinct products
      const basketSize = 2 + (i % 4);
      const items = [];
      const usedProdIndexes = new Set();
      let subtotal = 0;

      while (items.length < basketSize) {
        const prodIdx = Math.floor(Math.random() * products.length);
        if (usedProdIndexes.has(prodIdx)) continue;
        usedProdIndexes.add(prodIdx);

        const prod = products[prodIdx];
        const qty = 1 + (Math.random() < 0.25 ? 1 : 0) + (Math.random() < 0.1 ? 2 : 0);
        const unitPrice = Number(prod.selling_price);
        const costPrice = Number(prod.cost_price);
        const totalPrice = Math.round(unitPrice * qty * 100) / 100;
        subtotal += totalPrice;

        items.push({
          product_id: prod.id,
          product_name: prod.name,
          quantity: qty,
          unit_price: unitPrice,
          cost_price: costPrice,
          total_amount: totalPrice
        });
      }

      const tax = Math.round(subtotal * 0.05 * 100) / 100;
      const totalAmount = Math.round((subtotal + tax) * 100) / 100;

      if (customerId && customerSpendMap[customerId]) {
        customerSpendMap[customerId].total += totalAmount;
        customerSpendMap[customerId].count += 1;
      }

      const paymentMethod = i % 10 < 5 ? 'UPI' : (i % 10 < 8 ? 'Cash' : 'Card');
      const isStaffShift = i % 4 !== 0;

      const invoiceRecord = {
        id: invId,
        invoice_number: invId,
        store_id: storeId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        date: dateStr,
        time: timeStr,
        subtotal: subtotal,
        discount: 0,
        tax: tax,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: 'Paid',
        items_count: items.length,
        items: items,
        cashier_id: isStaffShift ? cashierUserId : ownerUserId,
        cashier_name: isStaffShift ? 'mani (Cashier)' : 'Thirandi Ram kalyan (Owner)',
        billed_by: isStaffShift ? 'mani' : 'Thirandi Ram kalyan',
        notes: festival ? festival.name : (isWeekend ? 'Weekend Retail Rush' : 'Daily Walk-in POS Sale'),
        created_at: createdAt,
        updated_at: createdAt
      };

      invoices.push(invoiceRecord);

      items.forEach((it, idx) => {
        invoiceItems.push({
          id: `${invId}_item_${idx + 1}`,
          invoice_id: invId,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_amount,
          created_at: createdAt
        });
      });
    }
  }

  // Update customer totals
  customers.forEach(c => {
    if (customerSpendMap[c.id]) {
      c.total_spent = Math.round(customerSpendMap[c.id].total);
      c.orders_count = customerSpendMap[c.id].count;
    }
  });

  // 5. Generate Retail Expenses from Jan 2026 to Nov 2026 (11 months)
  console.log('Generating retail shop operational expenses for all 11 months...');
  const expenses = [];
  let expSeq = 1;

  const months = [
    { ym: '2026-01', power: 4200, freight: 2400, bags: 1800, maint: 1200, deadStock: 1450 },
    { ym: '2026-02', power: 4400, freight: 2600, bags: 1900, maint: 1100, deadStock: 1600 },
    { ym: '2026-03', power: 4900, freight: 3200, bags: 2400, maint: 1500, deadStock: 2100 },
    { ym: '2026-04', power: 5400, freight: 2800, bags: 2100, maint: 1400, deadStock: 1750 },
    { ym: '2026-05', power: 5800, freight: 2900, bags: 2200, maint: 1600, deadStock: 1900 },
    { ym: '2026-06', power: 5300, freight: 4200, bags: 2300, maint: 1800, deadStock: 2400 },
    { ym: '2026-07', power: 4700, freight: 2700, bags: 2000, maint: 1300, deadStock: 1650 },
    { ym: '2026-08', power: 4800, freight: 3400, bags: 2500, maint: 1500, deadStock: 2200 },
    { ym: '2026-09', power: 4600, freight: 3100, bags: 2400, maint: 1400, deadStock: 2500 },
    { ym: '2026-10', power: 5100, freight: 3800, bags: 2600, maint: 1600, deadStock: 2300 }, // Dussehra rush
    { ym: '2026-11', power: 5200, freight: 4400, bags: 2800, maint: 1700, deadStock: 2100 }  // Diwali mega season
  ];

  months.forEach(m => {
    // 1st of month: Lease Rent
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-01`,
      expense_date: `${m.ym}-01`,
      category: 'Rent',
      amount: 25000,
      description: `Store retail premises commercial lease (${m.ym})`,
      payment_method: 'Bank Transfer',
      vendor: 'Shree Balaji Commercial Properties',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-01T10:00:00.000Z`
    });

    // 2nd: Software & POS
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-02`,
      expense_date: `${m.ym}-02`,
      category: 'Software & Internet',
      amount: 1500,
      description: 'JioFiber Business Gigabit + Smart Merchant POS Cloud Server',
      payment_method: 'UPI',
      vendor: 'JioFiber / Cloud POS Services',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-02T10:00:00.000Z`
    });

    // 3rd: Staff Salary
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-03`,
      expense_date: `${m.ym}-03`,
      category: 'Staff Salary',
      amount: 12000,
      description: 'Monthly salary disbursement for mani (Cashier) - ₹12,000',
      payment_method: 'Bank Transfer',
      vendor: 'mani (Cashier)',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-03T10:00:00.000Z`
    });

    // 4th: Water
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-04`,
      expense_date: `${m.ym}-04`,
      category: 'Water & Utilities',
      amount: 800,
      description: 'Commercial water supply & sanitation charges',
      payment_method: 'UPI',
      vendor: 'Hyderabad Municipal Water Board',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-04T10:00:00.000Z`
    });

    // 5th: Electricity
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-05`,
      expense_date: `${m.ym}-05`,
      category: 'Electricity',
      amount: m.power,
      description: `Store lighting, chiller cold storage & air circulation billing (${m.ym})`,
      payment_method: 'NetBanking',
      vendor: 'TSSPDCL Commercial Power Supply',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-05T10:00:00.000Z`
    });

    // 10th: Packaging
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-10`,
      expense_date: `${m.ym}-10`,
      category: 'Packaging & Bags',
      amount: m.bags,
      description: 'Biodegradable shopping bags, billing paper rolls & packing cartons',
      payment_method: 'Cash',
      vendor: 'Sri Sai Packaging Traders',
      logged_by: 'mani',
      created_at: `${m.ym}-10T10:00:00.000Z`
    });

    // 15th: Transport
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-15`,
      expense_date: `${m.ym}-15`,
      category: 'Transport & Logistics',
      amount: m.freight,
      description: 'Wholesale mandi logistics, supplier delivery freight & unloading labor',
      payment_method: 'UPI',
      vendor: 'City Cargo Express Logistics',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-15T10:00:00.000Z`
    });

    // 20th: Maintenance
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-20`,
      expense_date: `${m.ym}-20`,
      category: 'Maintenance & Repairs',
      amount: m.maint,
      description: 'Display racks upkeep, pest control inspection & chiller coil servicing',
      payment_method: 'Cash',
      vendor: 'Apex Facility Management Services',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-20T10:00:00.000Z`
    });

    // 28th: Spoilage / Dead stock
    expenses.push({
      id: `exp_${storeId}_${String(expSeq++).padStart(4, '0')}`,
      store_id: storeId,
      date: `${m.ym}-28`,
      expense_date: `${m.ym}-28`,
      category: 'Dead Stock & Spoilage Write-off',
      amount: m.deadStock,
      description: `Spoiled perishable items, expired batch write-off and handling breakages for ${m.ym}`,
      payment_method: 'Internal Journal Entry',
      vendor: 'Store Inventory Loss Account',
      logged_by: 'Thirandi Ram kalyan',
      created_at: `${m.ym}-28T10:00:00.000Z`
    });
  });

  // 6. Simulate Stock History & Purchase Orders
  console.log('Simulating inventory transactions and purchase orders based on sales history...');
  const { transactions, purchaseOrders, finalStock, notes } = simulateStockHistory({
    products,
    invoices,
    suppliers,
    storeId
  });

  finalStock.forEach((stock, productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) prod.stock_quantity = stock;
  });

  // Low stock candidates for alerts
  const lowStockCandidates = ['prd_grn_04', 'prd_oil_01', 'prd_dry_03', 'prd_snk_01', 'prd_bev_01', 'prd_car_04'];
  lowStockCandidates.forEach(id => {
    const prod = products.find(p => p.id === id);
    if (prod) {
      prod.stock_quantity = Math.max(3, Math.min(prod.min_stock_level - 2, 8));
    }
  });

  notes.slice(0, 5).forEach(n => console.log('  ', n));

  // 7. Write to Local JSON Database
  console.log('Writing to local merchant_db.json cache...');
  const dbFile = path.resolve(__dirname, '../../data/merchant_db.json');
  let currentJson = {};
  if (fs.existsSync(dbFile)) {
    try {
      currentJson = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    } catch (e) {}
  }

  // Update or insert users
  const userMap = new Map((currentJson.users || []).map(u => [u.email, u]));
  users.forEach(u => userMap.set(u.email, u));

  currentJson.users = Array.from(userMap.values());
  currentJson.categories = categories;
  currentJson.suppliers = suppliers;
  currentJson.customers = customers;
  currentJson.products = products;
  currentJson.invoices = invoices;
  currentJson.invoice_items = invoiceItems;
  currentJson.expenses = expenses;
  currentJson.inventory_transactions = transactions;
  currentJson.purchase_orders = purchaseOrders;

  fs.writeFileSync(dbFile, JSON.stringify(currentJson, null, 2), 'utf-8');
  console.log('✅ Updated local merchant_db.json successfully.');

  // 8. Batch Insert into PostgreSQL
  if (pool) {
    console.log('\nInserting records into Supabase PostgreSQL database...');

    // Users upsert
    for (const u of users) {
      await pool.query(`
        INSERT INTO users (id, store_id, name, email, password, role, phone, avatar, business_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          store_id = EXCLUDED.store_id,
          business_name = EXCLUDED.business_name,
          updated_at = CURRENT_TIMESTAMP;
      `, [u.id, u.store_id, u.name, u.email, u.password, u.role, u.phone, u.avatar, u.business_name]);
    }
    console.log('✅ Users synced.');

    // Helper for multi-row chunked inserts
    async function chunkedInsert(tableName, records, columns, formatRow) {
      const CHUNK_SIZE = 250;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const valueClauses = [];
        const params = [];
        let paramIdx = 1;

        for (const row of chunk) {
          const rowValues = formatRow(row);
          const placeholders = rowValues.map(() => `$${paramIdx++}`);
          valueClauses.push(`(${placeholders.join(', ')})`);
          params.push(...rowValues);
        }

        const query = `
          INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
          VALUES ${valueClauses.join(', ')}
          ON CONFLICT (id) DO NOTHING;
        `;
        await pool.query(query, params);
      }
      console.log(`✅ [PG] Inserted ${records.length} records into ${tableName}`);
    }

    // Categories
    await chunkedInsert('categories', categories, ['id', 'store_id', 'name', 'code', 'description'], c => [c.id, c.store_id, c.name, c.code, c.description]);

    // Suppliers
    await chunkedInsert('suppliers', suppliers, ['id', 'store_id', 'name', 'contact_person', 'phone', 'email', 'lead_time_days', 'address', 'logo_url'], s => [s.id, s.store_id, s.name, s.contact_person, s.phone, s.email, s.lead_time_days, s.address, s.logo_url]);

    // Customers
    await chunkedInsert('customers', customers, ['id', 'store_id', 'name', 'phone', 'email', 'address', 'tier', 'total_spent', 'pending_amount', 'orders_count', 'avatar'], c => [c.id, c.store_id, c.name, c.phone, c.email, c.address, c.tier, c.total_spent, c.pending_amount, c.orders_count, c.avatar]);

    // Products
    await chunkedInsert('products', products, ['id', 'store_id', 'name', 'sku', 'category_id', 'category_name', 'supplier_id', 'cost_price', 'selling_price', 'stock_quantity', 'min_stock_level', 'unit', 'lead_time_days', 'barcode', 'description', 'image_url'], p => [p.id, p.store_id, p.name, p.sku, p.category_id, p.category_name, p.supplier_id, p.cost_price, p.selling_price, p.stock_quantity, p.min_stock_level, p.unit, p.lead_time_days, p.barcode, p.description, p.image_url]);

    // Expenses
    await chunkedInsert('expenses', expenses, ['id', 'store_id', 'category', 'description', 'amount', 'payment_method', 'vendor', 'logged_by', 'date', 'expense_date', 'created_at'], e => [e.id, e.store_id, e.category, e.description, e.amount, e.payment_method, e.vendor, e.logged_by, e.date, e.expense_date, e.created_at]);

    // Invoices
    await chunkedInsert('invoices', invoices, ['id', 'invoice_number', 'store_id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'date', 'time', 'subtotal', 'discount', 'tax', 'total_amount', 'payment_method', 'payment_status', 'items_count', 'items', 'cashier_id', 'cashier_name', 'billed_by', 'notes', 'created_at'], inv => [inv.id, inv.invoice_number, inv.store_id, inv.customer_id, inv.customer_name, inv.customer_phone, inv.customer_email, inv.date, inv.time, inv.subtotal, inv.discount, inv.tax, inv.total_amount, inv.payment_method, inv.payment_status, inv.items_count, JSON.stringify(inv.items), inv.cashier_id, inv.cashier_name, inv.billed_by, inv.notes, inv.created_at]);

    // Invoice Items
    await chunkedInsert('invoice_items', invoiceItems, ['id', 'invoice_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'total_price', 'created_at'], it => [it.id, it.invoice_id, it.product_id, it.product_name, it.quantity, it.unit_price, it.total_price, it.created_at]);

    // Inventory Transactions
    await chunkedInsert('inventory_transactions', transactions, ['id', 'store_id', 'product_id', 'product_name', 'type', 'adjustment_type', 'quantity', 'previous_stock', 'new_stock', 'reference_id', 'reason', 'created_by', 'created_at'], t => [t.id, t.store_id, t.product_id, t.product_name, t.type, t.adjustment_type, t.quantity, t.previous_stock, t.new_stock, t.reference_id, t.reason, t.created_by, t.created_at]);

    // Purchase Orders
    await chunkedInsert('purchase_orders', purchaseOrders, ['id', 'store_id', 'supplier_id', 'product_id', 'product_name', 'quantity', 'unit_cost', 'ordered_at', 'expected_at', 'received_at', 'status', 'trigger', 'created_by', 'created_at'], po => [po.id, po.store_id, po.supplier_id, po.product_id, po.product_name, po.quantity, po.unit_cost, po.ordered_at, po.expected_at, po.received_at, po.status, po.trigger, po.created_by, po.created_at]);
  }

  console.log('\n========================================================');
  console.log('🎉 Store Population Complete!');
  console.log(`   - Invoices Generated: ${invoices.length} across ${totalDays} days`);
  console.log(`   - Line Items: ${invoiceItems.length}`);
  console.log(`   - Expenses: ${expenses.length} (Jan - Nov 2026)`);
  console.log(`   - Inventory Ledger: ${transactions.length} rows`);
  console.log(`   - Purchase Orders: ${purchaseOrders.length}`);
  console.log(`   - Target User: tramkalyanrahul@gmail.com (Password: 123456)`);
  console.log('========================================================\n');

  process.exit(0);
}

seedUserStore().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
