/**
 * Seed Realistic Invoices for 21st and 22nd of September 2026.
 * Submits through Express backend API to maintain live database and inventory integrity.
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

// Popular product list with healthy stock
const PRODUCT_BASKETS = [
  // Breakfast / Daily Dairy
  [{ product_id: 'prd_dry_01', quantity: 2 }, { product_id: 'prd_snk_01', quantity: 2 }],
  [{ product_id: 'prd_dry_02', quantity: 1 }, { product_id: 'prd_bev_01', quantity: 1 }],
  [{ product_id: 'prd_dry_05', quantity: 1 }, { product_id: 'prd_grn_04', quantity: 1 }],
  [{ product_id: 'prd_dry_03', quantity: 1 }, { product_id: 'prd_grn_12', quantity: 2 }],

  // Staple groceries
  [{ product_id: 'prd_grn_03', quantity: 1 }, { product_id: 'prd_grn_06', quantity: 1 }, { product_id: 'prd_spc_01', quantity: 1 }],
  [{ product_id: 'prd_grn_04', quantity: 1 }, { product_id: 'prd_oil_01', quantity: 1 }],
  [{ product_id: 'prd_grn_01', quantity: 1 }, { product_id: 'prd_grn_07', quantity: 1 }, { product_id: 'prd_spc_02', quantity: 1 }],
  [{ product_id: 'prd_grn_06', quantity: 1 }, { product_id: 'prd_grn_08', quantity: 1 }],
  [{ product_id: 'prd_oil_01', quantity: 2 }, { product_id: 'prd_spc_03', quantity: 1 }],
  [{ product_id: 'prd_oil_06', quantity: 1 }, { product_id: 'prd_grn_10', quantity: 1 }],

  // Tea, Snacks & Confectionery
  [{ product_id: 'prd_bev_01', quantity: 1 }, { product_id: 'prd_snk_02', quantity: 2 }],
  [{ product_id: 'prd_bev_02', quantity: 1 }, { product_id: 'prd_snk_04', quantity: 1 }],
  [{ product_id: 'prd_snk_03', quantity: 3 }, { product_id: 'prd_snk_05', quantity: 1 }],
  [{ product_id: 'prd_bev_05', quantity: 2 }, { product_id: 'prd_snk_01', quantity: 1 }],

  // Home care & Personal care
  [{ product_id: 'prd_cln_01', quantity: 1 }, { product_id: 'prd_cln_03', quantity: 1 }],
  [{ product_id: 'prd_car_01', quantity: 2 }, { product_id: 'prd_car_04', quantity: 1 }],
  [{ product_id: 'prd_cln_02', quantity: 1 }, { product_id: 'prd_dry_01', quantity: 1 }],
  [{ product_id: 'prd_spc_04', quantity: 1 }, { product_id: 'prd_spc_05', quantity: 1 }, { product_id: 'prd_spc_06', quantity: 1 }]
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
  'Pooja Sen', 'Manoj Tiwari', 'Rekha Agarwal', 'Girish Nambiar'
];

async function run() {
  console.log('Logging in as Store Owner...');
  const loginRes = await request(`${API_BASE}/auth/login`, { method: 'POST' }, JSON.stringify({
    email: 'onr1@gmail.com',
    password: 'onr123'
  }));
  const token = loginRes.token;
  console.log('Authenticated successfully. Token acquired.');

  // Check current invoices to find sequence number
  const existingInvoicesRes = await request(`${API_BASE}/invoices`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const existingList = existingInvoicesRes.invoices || [];
  console.log(`Found ${existingList.length} existing invoices in database.`);

  let maxSeq = 16576;
  existingList.forEach(i => {
    if (i.invoice_number && i.invoice_number.startsWith('INV-2026-')) {
      const num = parseInt(i.invoice_number.split('-')[2], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  let nextSeq = maxSeq + 1;
  console.log(`Starting invoice sequence from: INV-2026-0${nextSeq}`);

  // Invoices for September 21, 2026 (Monday)
  const sep21Invoices = [
    { time: '08:35:12', notes: 'Morning Milk & Bread' },
    { time: '09:04:45', notes: 'Daily Essentials Walk-in' },
    { time: '09:42:18', notes: 'Weekly Atta & Grains Order' },
    { time: '10:15:00', notes: 'Breakfast Grocery Basket' },
    { time: '10:50:33', notes: 'Residential Regular' },
    { time: '11:22:15', notes: 'Cooking Oils & Masala Restock' },
    { time: '11:58:40', notes: 'Lunch Hour Walk-in' },
    { time: '12:30:22', notes: 'Spices and Dal Restock' },
    { time: '13:05:50', notes: 'Afternoon Retail Sale' },
    { time: '13:45:10', notes: 'Local Resident Top-up' },
    { time: '14:20:05', notes: 'Tea & Snacks Basket' },
    { time: '15:10:40', notes: 'Afternoon Quick Pick' },
    { time: '15:55:12', notes: 'Household Cleaning Supplies' },
    { time: '16:35:28', notes: 'Evening Tea & Biscuits' },
    { time: '17:15:45', notes: 'After-Work Walk-in Shopper' },
    { time: '17:50:10', notes: 'Regular Monthly Ledger' },
    { time: '18:25:35', notes: 'Evening Rush Basket' },
    { time: '18:55:20', notes: 'Dinner Prep Essentials' },
    { time: '19:30:15', notes: 'Family Grocery Run' },
    { time: '20:05:40', notes: 'Night Walk-in Customer' },
    { time: '20:40:22', notes: 'Late Evening Staples' },
    { time: '21:10:15', notes: 'Pre-closing Quick Checkout' },
    { time: '21:32:50', notes: 'Closing Retail Sale' }
  ];

  // Invoices for September 22, 2026 (Tuesday - Today)
  const sep22Invoices = [
    { time: '08:20:10', notes: 'Morning Milk & Breakfast Supplies' },
    { time: '08:45:30', notes: 'Early Shopper Staples' },
    { time: '09:12:05', notes: 'Tea & Sugar Restock' },
    { time: '09:38:40', notes: 'Apartment Monthly Atta & Rice' },
    { time: '10:05:15', notes: 'Mid-Morning Pantry Run' },
    { time: '10:32:55', notes: 'Cooking Oil & Spices' },
    { time: '11:00:20', notes: 'Dairy & Curd Walk-in' },
    { time: '11:28:45', notes: 'Household Cleaning Essentials' },
    { time: '11:55:10', notes: 'Snacks & Biscuits Box' },
    { time: '12:18:30', notes: 'Lunch Hour Walk-in Sale' },
    { time: '12:42:15', notes: 'Dal & Pulses Combo' },
    { time: '13:05:40', notes: 'Midday Grocery Top-up' },
    { time: '13:18:22', notes: 'Quick Counter Purchase' },
    { time: '13:28:50', notes: 'Afternoon Retail Sale' }
  ];

  let createdCount = 0;
  let totalRevenue = 0;

  async function createBatch(list, dateStr) {
    console.log(`\n--- Creating ${list.length} invoices for ${dateStr} ---`);
    for (let i = 0; i < list.length; i++) {
      const itemConfig = list[i];
      const invNum = `INV-2026-0${nextSeq++}`;
      const basket = PRODUCT_BASKETS[(i + (dateStr === '2026-09-22' ? 7 : 0)) % PRODUCT_BASKETS.length];
      
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
        createdCount++;
        totalRevenue += Number(inv.total_amount || 0);
        console.log(`[${createdCount}] ${dateStr} ${itemConfig.time} | ${inv.invoice_number} | ${cust.customer_name} | ₹${inv.total_amount} | ${paymentMethod} (${paymentStatus})`);
      } catch (err) {
        console.error(`Error creating invoice for ${dateStr} ${itemConfig.time}:`, err.message);
      }
    }
  }

  await createBatch(sep21Invoices, '2026-09-21');
  await createBatch(sep22Invoices, '2026-09-22');

  console.log('\n====================================================');
  console.log(`Successfully generated ${createdCount} invoices across Sep 21 and Sep 22!`);
  console.log(`Total Billing Volume Added: ₹${Math.round(totalRevenue).toLocaleString('en-IN')}`);
  console.log('====================================================\n');
}

run().catch(console.error);
