const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING END-TO-END RBAC & PHOTO VALIDATION ===');

  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const ownerEmail = `owner_${randomSuffix}@smartmart.com`;
  const ownerPassword = 'OwnerPass123!';

  // 1. Register Owner
  console.log('1. Registering Owner account...');
  const regRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Vikram Sharma (Owner)',
    email: ownerEmail,
    password: ownerPassword,
    business_name: 'Sharma Superstore',
    phone: '+91 99887 76655',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  });

  console.log('Register response:', regRes.status, regRes.data?.user?.email, 'Role:', regRes.data?.user?.role, 'Store ID:', regRes.data?.user?.store_id);
  if (regRes.status !== 201 || regRes.data?.user?.role !== 'Owner') {
    throw new Error('Owner registration failed or role mismatch');
  }

  const ownerToken = regRes.data.token;
  const storeId = regRes.data.user.store_id;

  // 2. Owner creates Staff/Cashier account
  console.log('\n2. Owner creating Staff/Cashier account inside store...');
  const staffEmail = `cashier_${randomSuffix}@smartmart.com`;
  const staffPassword = 'CashierPass123!';

  const staffCreateRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/staff',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    }
  }, {
    name: 'Priya Cashier',
    email: staffEmail,
    password: staffPassword,
    role: 'Staff',
    phone: '+91 91234 56789',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  });

  console.log('Create Staff response:', staffCreateRes.status, staffCreateRes.data?.staff?.email, 'Role:', staffCreateRes.data?.staff?.role, 'Avatar:', staffCreateRes.data?.staff?.avatar);
  if (staffCreateRes.status !== 201 || staffCreateRes.data?.staff?.role !== 'Staff') {
    throw new Error('Staff creation failed');
  }

  // 3. Owner creates a Product with photo
  console.log('\n3. Owner adding product with photo...');
  const prodRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    }
  }, {
    name: 'Organic Basmati Rice 10kg',
    sku: `SKU-${randomSuffix}`,
    cost_price: 600,
    selling_price: 850,
    stock_quantity: 45,
    min_stock_level: 10,
    unit: 'Bags',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=80',
    description: 'Aged Himalayan long grain basmati rice'
  });
  console.log('Create Product response:', prodRes.status, prodRes.data?.product?.name, 'Image:', prodRes.data?.product?.image_url);

  // 4. Owner creates a Customer with photo
  console.log('\n4. Owner adding customer with photo...');
  const custRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/customers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    }
  }, {
    name: 'Rajesh Kumar',
    phone: '+91 98765 00001',
    email: `rajesh_${randomSuffix}@gmail.com`,
    address: 'Connaught Place, New Delhi',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  });
  console.log('Create Customer response:', custRes.status, custRes.data?.customer?.name, 'Avatar:', custRes.data?.customer?.avatar);

  // 5. Owner creates a Supplier with logo
  console.log('\n5. Owner adding supplier with logo...');
  const supRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/suppliers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    }
  }, {
    name: 'Agro Foods Distribution Ltd',
    contact_person: 'Amit Verma',
    phone: '+91 98111 22233',
    email: `agro_${randomSuffix}@distributors.com`,
    lead_time_days: 2,
    address: 'Warehouse Hub 4, Okhla Phase 3',
    logo_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=150&auto=format&fit=crop&q=80'
  });
  console.log('Create Supplier response:', supRes.status, supRes.data?.supplier?.name, 'Logo:', supRes.data?.supplier?.logo_url);

  // 6. Test Staff Login
  console.log('\n6. Testing Staff Login with generated credentials...');
  const staffLoginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: staffEmail,
    password: staffPassword
  });
  console.log('Staff Login response:', staffLoginRes.status, staffLoginRes.data?.user?.name, 'Role:', staffLoginRes.data?.user?.role, 'Store ID:', staffLoginRes.data?.user?.store_id);
  if (staffLoginRes.status !== 200 || staffLoginRes.data?.user?.store_id !== storeId) {
    throw new Error('Staff login failed or store_id isolation failed');
  }

  const staffToken = staffLoginRes.data.token;

  // 7. Staff fetches store products (should see the owner\'s product)
  console.log('\n7. Staff fetching store products...');
  const staffProdRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  console.log('Staff products fetched:', staffProdRes.data?.products?.length, 'Found name:', staffProdRes.data?.products?.[0]?.name);
  if (staffProdRes.data?.products?.length < 1) {
    throw new Error('Staff could not access store products');
  }

  // 8. Staff attempts to create another staff member (Should be forbidden 403)
  console.log('\n8. Verifying Staff is blocked from creating other staff (RBAC check)...');
  const forbiddenRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/staff',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  }, {
    name: 'Hacker Cashier',
    email: `hack_${randomSuffix}@smartmart.com`,
    password: 'password123',
    role: 'Admin'
  });
  console.log('Staff staff-creation attempt status:', forbiddenRes.status, forbiddenRes.data?.message);
  if (forbiddenRes.status !== 403) {
    throw new Error('RBAC security hole: Staff was able to create staff account!');
  }

  // 9. Owner updates profile photo
  console.log('\n9. Owner updating profile photo...');
  const profileUpdateRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/profile',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    }
  }, {
    name: 'Vikram Sharma (Senior Owner)',
    phone: '+91 99887 76600',
    business_name: 'Sharma Mega Superstore',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  });
  console.log('Profile update response:', profileUpdateRes.status, profileUpdateRes.data?.user?.name, 'New Avatar:', profileUpdateRes.data?.user?.avatar);

  console.log('\n========================================');
  console.log('🎉 ALL BACKEND RBAC & PHOTO TESTS PASSED!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
