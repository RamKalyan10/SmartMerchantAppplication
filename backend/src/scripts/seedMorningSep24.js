const axios = require('axios');

async function seedSep24() {
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'onr1@gmail.com',
    password: 'password123'
  });
  const token = loginRes.data.token;
  const headers = { Authorization: 'Bearer ' + token };

  const baskets = [
    [{ product_id: 'prd_dry_01', quantity: 2 }, { product_id: 'prd_snk_01', quantity: 1 }],
    [{ product_id: 'prd_dry_02', quantity: 1 }, { product_id: 'prd_bev_01', quantity: 1 }],
    [{ product_id: 'prd_grn_04', quantity: 1 }, { product_id: 'prd_oil_01', quantity: 1 }],
    [{ product_id: 'prd_grn_01', quantity: 1 }, { product_id: 'prd_spc_01', quantity: 1 }],
    [{ product_id: 'prd_bev_01', quantity: 1 }, { product_id: 'prd_snk_02', quantity: 2 }],
    [{ product_id: 'prd_dry_05', quantity: 2 }, { product_id: 'prd_grn_12', quantity: 1 }],
    [{ product_id: 'prd_cln_01', quantity: 1 }, { product_id: 'prd_cln_03', quantity: 1 }],
    [{ product_id: 'prd_snk_03', quantity: 2 }, { product_id: 'prd_bev_05', quantity: 1 }],
    [{ product_id: 'prd_oil_06', quantity: 1 }, { product_id: 'prd_spc_02', quantity: 2 }],
    [{ product_id: 'prd_dry_03', quantity: 1 }, { product_id: 'prd_snk_04', quantity: 1 }]
  ];

  const times = ['08:15:20', '08:45:10', '09:20:30', '10:05:40', '10:40:15', '11:15:50', '11:55:00', '12:30:25', '13:10:45', '13:45:10'];
  const names = ['Kavitha Nair', 'Ramesh Sharma', 'Deepak Verma', 'Sanjay Kulkarni', 'Sunita Patel', 'Priya Sundaram', 'Arun Joshi', 'Suresh Naidu', 'Mohammed Farooq', 'Anand Rao'];
  const methods = ['UPI', 'Cash', 'UPI', 'UPI', 'Card', 'UPI', 'Cash', 'UPI', 'UPI', 'Card'];

  let count = 0;
  for (let i = 0; i < baskets.length; i++) {
    const payload = {
      date: '2026-09-24',
      time: times[i],
      customer_name: names[i],
      customer_phone: '+91 98' + Math.floor(10000000 + Math.random() * 89999999),
      customer_email: names[i].toLowerCase().replace(/\s+/g, '.') + '@gmail.com',
      items: baskets[i],
      payment_method: methods[i],
      payment_status: 'PAID',
      notes: 'Morning Retail Sale'
    };
    const res = await axios.post('http://localhost:5000/api/invoices', payload, { headers });
    count++;
    console.log('[' + count + '] ' + res.data.invoice.invoice_number + ' | ' + names[i] + ' | ₹' + res.data.invoice.total_amount);
  }
  console.log('Successfully added Sep 24 morning invoices!');
}

seedSep24().catch(console.error);
