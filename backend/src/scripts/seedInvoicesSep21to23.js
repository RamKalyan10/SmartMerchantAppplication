/**
 * Seed Invoices for September 21, 22, and 23, 2026.
 * Generates realistic retail transactions matching current sales velocity (~20-25 invoices/day).
 * Submits through Express backend API to maintain database, inventory, and customer integrity.
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (data) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || body}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Baskets reflecting neighborhood grocery & staple patterns
const PRODUCT_BASKETS = [
  // Morning Dairy & Essentials
  [{ product_id: 'prd_dry_01', quantity: 2 }, { product_id: 'prd_snk_01', quantity: 1 }],
  [{ product_id: 'prd_dry_02', quantity: 1 }, { product_id: 'prd_bev_01', quantity: 1 }],
  [{ product_id: 'prd_dry_05', quantity: 2 }, { product_id: 'prd_grn_04', quantity: 1 }],
  [{ product_id: 'prd_dry_03', quantity: 1 }, { product_id: 'prd_grn_12', quantity: 1 }],

  // Staple Atta, Rice & Pulses
  [{ product_id: 'prd_grn_01', quantity: 1 }, { product_id: 'prd_grn_06', quantity: 1 }, { product_id: 'prd_spc_01', quantity: 1 }],
  [{ product_id: 'prd_grn_04', quantity: 1 }, { product_id: 'prd_oil_01', quantity: 1 }],
  [{ product_id: 'prd_grn_02', quantity: 1 }, { product_id: 'prd_grn_07', quantity: 1 }],
  [{ product_id: 'prd_grn_05', quantity: 1 }, { product_id: 'prd_oil_06', quantity: 1 }],
  [{ product_id: 'prd_grn_08', quantity: 2 }, { product_id: 'prd_spc_02', quantity: 1 }],
  [{ product_id: 'prd_oil_01', quantity: 1 }, { product_id: 'prd_spc_03', quantity: 2 }],

  // Tea, Snacks & Confectionery
  [{ product_id: 'prd_bev_01', quantity: 1 }, { product_id: 'prd_snk_02', quantity: 2 }],
  [{ product_id: 'prd_bev_02', quantity: 1 }, { product_id: 'prd_snk_04', quantity: 1 }],
  [{ product_id: 'prd_snk_03', quantity: 2 }, { product_id: 'prd_bev_05', quantity: 1 }],
  [{ product_id: 'prd_bev_03', quantity: 1 }, { product_id: 'prd_snk_05', quantity: 2 }],

  // Household & Personal Care
  [{ product_id: 'prd_cln_01', quantity: 1 }, { product_id: 'prd_cln_03', quantity: 1 }],
  [{ product_id: 'prd_car_01', quantity: 1 }, { product_id: 'prd_car_04', quantity: 1 }],
  [{ product_id: 'prd_cln_02', quantity: 1 }, { product_id: 'prd_dry_01', quantity: 1 }],
  [{ product_id: 'prd_spc_04', quantity: 1 }, { product_id: 'prd_spc_05', quantity: 1 }]
];

const REGULAR_CUSTOMERS = [
  { customer_id: 'cust_001', customer_name: 'Ramesh Sharma', customer_phone: '+91 98765 43210', customer_email: 'ramesh.sharma@gmail.com' },
  { customer_id: 'cust_002', customer_name: 'Sunita Patel', customer_phone: '+91 98234 56789', customer_email: 'sunita.patel@outlook.com' },
  { customer_id: 'cust_003', customer_name: 'Anand Rao', customer_phone: '+91 97123 45678', customer_email: 'anand.rao@yahoo.com' },
  { customer_id: 'cust_004', customer_name: 'Priya Sundaram', customer_phone: '+91 99456 78901', customer_email: 'priya.sundaram@gmail.com' },
  { customer_id: 'cust_005', customer_name: 'Mohammed Farooq', customer_phone: '+91 98876 54321', customer_email: 'm.farooq@gmail.com' }
];

const WALKIN_NAMES = [
  'Kavitha Nair', 'Deepak Verma', 'Sanjay Kulkarni', 'Meenakshi Iyer',
  'Arun Joshi', 'Suresh Naidu', 'Bhavna Chawla', 'Venkatesh Rao',
  'Pooja Sen', 'Manoj Tiwari', 'Rekha Agarwal', 'Girish Nambiar',
  'Ananya Deshmukh', 'Vikram Malhotra', 'Siddharth Roy', 'Nandini Das'
];

async function seedInvoices() {
  console.log('Logging in as Store Owner...');
  const loginRes = await request(`${API_BASE}/auth/login`, { method: 'POST' }, JSON.stringify({
    email: 'onr1@gmail.com',
    password: 'onr123'
  }));
  const token = loginRes.token;
  console.log('[OK] Logged in. Token obtained.');

  // Replenish stock for products in basket to ensure abundant inventory
  console.log('Verifying stock levels for seed basket...');
  const prodRes = await request(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${token}` } });
  const products = prodRes.products || [];
  for (const p of products) {
    if (p.stock_quantity < 15) {
      const topUp = 40;
      await request(`${API_BASE}/inventory/adjust`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }, JSON.stringify({
        product_id: p.id,
        adjustment_type: 'RESTOCK',
        quantity: topUp,
        reason: 'Restocking for recent sales velocity'
      }));
    }
  }
  console.log('[OK] Inventory verified and replenished.');

  // Determine starting invoice sequence number
  const existingInvoicesRes = await request(`${API_BASE}/invoices`, { headers: { Authorization: `Bearer ${token}` } });
  const existingList = existingInvoicesRes.invoices || [];
  let maxSeq = 16576;
  existingList.forEach(i => {
    if (i.invoice_number && i.invoice_number.startsWith('INV-2026-')) {
      const num = parseInt(i.invoice_number.split('-')[2], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  let nextSeq = maxSeq + 1;
  console.log(`Starting sequence: INV-2026-0${nextSeq}`);

  // Schedule for 21-09-2026 (Monday) - 22 invoices
  const sep21Schedule = [
    { time: '08:15:30', notes: 'Morning Milk & Bread' },
    { time: '08:45:10', notes: 'Breakfast Staples' },
    { time: '09:20:45', notes: 'Walk-in Grocery Top-up' },
    { time: '09:55:12', notes: 'Atta & Pulses Run' },
    { time: '10:30:00', notes: 'Cooking Oils & Masalas' },
    { time: '11:05:22', notes: 'Residential Customer' },
    { time: '11:40:15', notes: 'Spices and Rice Basket' },
    { time: '12:15:40', notes: 'Midday Quick Purchase' },
    { time: '12:50:05', notes: 'Lunch Hour Walk-in' },
    { time: '13:30:18', notes: 'Snacks & Biscuits' },
    { time: '14:15:55', notes: 'Afternoon Retail Sale' },
    { time: '15:00:30', notes: 'Tea & Beverage Top-up' },
    { time: '15:45:20', notes: 'Cleaning Essentials' },
    { time: '16:30:10', notes: 'Daily Dairy Replenish' },
    { time: '17:15:40', notes: 'Evening Tea Walk-in' },
    { time: '18:00:25', notes: 'Family Grocery Run' },
    { time: '18:45:15', notes: 'Dinner Prep Items' },
    { time: '19:30:00', notes: 'Evening Peak Basket' },
    { time: '20:10:45', notes: 'Late Shopper Grains' },
    { time: '20:45:30', notes: 'Night Walk-in Customer' },
    { time: '21:15:20', notes: 'Pre-closing Quick Checkout' },
    { time: '21:40:10', notes: 'Closing Retail Sale' }
  ];

  // Schedule for 22-09-2026 (Tuesday) - 23 invoices
  const sep22Schedule = [
    { time: '08:20:15', notes: 'Morning Milk & Curd' },
    { time: '08:50:40', notes: 'Breakfast Cereals & Bread' },
    { time: '09:25:00', notes: 'Atta & Cooking Oil Basket' },
    { time: '10:00:35', notes: 'Spices and Dal Purchase' },
    { time: '10:35:10', notes: 'Residential Regular Order' },
    { time: '11:10:45', notes: 'Mid-Morning Pantry Staples' },
    { time: '11:45:20', notes: 'Household Cleaning Supplies' },
    { time: '12:20:00', notes: 'Lunch Hour Shopper' },
    { time: '12:55:30', notes: 'Tea and Sugar Pack' },
    { time: '13:35:15', notes: 'Afternoon Quick Pick' },
    { time: '14:20:50', notes: 'Snacks and Biscuits' },
    { time: '15:05:10', notes: 'Beverage Top-up' },
    { time: '15:50:35', notes: 'Personal Care Items' },
    { time: '16:35:00', notes: 'Evening Rush Essentials' },
    { time: '17:10:25', notes: 'After-Work Walk-in' },
    { time: '17:50:40', notes: 'Dinner Staples Combo' },
    { time: '18:30:15', notes: 'Family Monthly Atta' },
    { time: '19:15:30', notes: 'Evening Grocery Basket' },
    { time: '19:55:10', notes: 'Night Walk-in Counter' },
    { time: '20:30:45', notes: 'Spices Restock Order' },
    { time: '21:00:20', notes: 'Quick Convenience Sale' },
    { time: '21:25:50', notes: 'Late Night Household' },
    { time: '21:45:00', notes: 'Closing Register Sale' }
  ];

  // Schedule for 23-09-2026 (Wednesday - Today) - 18 invoices up to 15:45
  const sep23Schedule = [
    { time: '08:10:20', notes: 'Early Morning Milk Delivery' },
    { time: '08:35:50', notes: 'Bread & Breakfast Dairy' },
    { time: '09:05:15', notes: 'Daily Cooking Essentials' },
    { time: '09:30:40', notes: 'Rice & Wheat Flour Purchase' },
    { time: '10:00:10', notes: 'Morning Pantry Restock' },
    { time: '10:30:35', notes: 'Tea, Coffee & Biscuits' },
    { time: '11:00:00', notes: 'Walk-in Grocery Basket' },
    { time: '11:30:25', notes: 'Spices & Cooking Oil Run' },
    { time: '12:00:45', notes: 'Midday Essentials' },
    { time: '12:30:10', notes: 'Lunchtime Shopper Order' },
    { time: '13:00:30', notes: 'Snack Basket Purchase' },
    { time: '13:30:15', notes: 'Dal & Pulses Quick Pick' },
    { time: '14:00:40', notes: 'Afternoon Counter Sale' },
    { time: '14:25:00', notes: 'Cleaning & Wash Supplies' },
    { time: '14:50:20', notes: 'Beverages & Soft Drinks' },
    { time: '15:10:45', notes: 'Tea Time Grocery Run' },
    { time: '15:28:10', notes: 'Current Trend Walk-in' },
    { time: '15:42:30', notes: 'Afternoon Retail Top-up' }
  ];

  let totalCreated = 0;
  let totalRevenue = 0;

  async function processBatch(schedule, dateStr) {
    console.log(`\n======================================================`);
    console.log(`Generating ${schedule.length} Invoices for ${dateStr}`);
    console.log(`======================================================`);
    
    for (let i = 0; i < schedule.length; i++) {
      const itemConfig = schedule[i];
      const invNum = `INV-2026-0${nextSeq++}`;
      const basket = PRODUCT_BASKETS[(i + (dateStr.endsWith('22') ? 5 : (dateStr.endsWith('23') ? 11 : 0))) % PRODUCT_BASKETS.length];

      const isRegular = (i % 3 === 0);
      let cust = null;
      if (isRegular) {
        cust = REGULAR_CUSTOMERS[i % REGULAR_CUSTOMERS.length];
      } else {
        const name = WALKIN_NAMES[i % WALKIN_NAMES.length];
        cust = {
          customer_id: null,
          customer_name: name,
          customer_phone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
          customer_email: `${name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`
        };
      }

      const payMethods = ['UPI', 'UPI', 'Cash', 'UPI', 'Card', isRegular ? 'Khata' : 'UPI'];
      const paymentMethod = payMethods[i % payMethods.length];
      const paymentStatus = paymentMethod === 'Khata' ? 'PENDING' : 'PAID';

      const payload = {
        date: dateStr,
        time: itemConfig.time,
        invoice_number: invNum,
        customer_id: cust.customer_id,
        customer_name: cust.customer_name,
        customer_phone: cust.customer_phone,
        customer_email: cust.customer_email,
        items: basket,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: itemConfig.notes
      };

      try {
        const res = await request(`${API_BASE}/invoices`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }, JSON.stringify(payload));

        const inv = res.invoice;
        totalCreated++;
        totalRevenue += Number(inv.total_amount || 0);
        console.log(`[${totalCreated}] ${dateStr} ${itemConfig.time} | ${inv.invoice_number} | ${cust.customer_name} | ₹${inv.total_amount} | ${paymentMethod}`);
      } catch (err) {
        console.error(`Failed to create invoice ${invNum} on ${dateStr}:`, err.message);
      }
    }
  }

  await processBatch(sep21Schedule, '2026-09-21');
  await processBatch(sep22Schedule, '2026-09-22');
  await processBatch(sep23Schedule, '2026-09-23');

  console.log('\n======================================================');
  console.log(`SUMMARY: Successfully created ${totalCreated} invoices across Sep 21 - Sep 23!`);
  console.log(`Total Billing Volume Generated: ₹${Math.round(totalRevenue).toLocaleString('en-IN')}`);
  console.log(`======================================================\n`);
}

seedInvoices().catch(console.error);
