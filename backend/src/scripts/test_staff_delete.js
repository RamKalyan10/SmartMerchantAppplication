require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

async function testStaffLifecycle() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'smart_merchant'
  });

  try {
    console.log('--- 1. Login as Store Owner ---');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'onr1@gmail.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    console.log('--- 2. Fetch Initial Staff List ---');
    const initStaff = await axios.get('http://localhost:5000/api/auth/staff', { headers });
    console.log('Initial Staff:', initStaff.data.staff.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, salary: u.salary })));

    console.log('\n--- 3. Create Temporary Staff ---');
    const createRes = await axios.post('http://localhost:5000/api/auth/staff', {
      name: 'Temp Cashier Trainee',
      email: 'trainee_cashier@dwdmstore.com',
      password: 'password123',
      role: 'Staff',
      phone: '+91 99887 11223'
    }, { headers });
    const newStaffId = createRes.data.staff.id;
    console.log(`Created Staff Member [${newStaffId}]:`, createRes.data.staff.name);

    // Wait a brief tick for background PG sync
    await new Promise(r => setTimeout(r, 500));

    const pgBefore = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [newStaffId]);
    console.log('PostgreSQL lookup before delete:', pgBefore.rows);

    console.log('\n--- 4. Delete Staff Member via API ---');
    const delRes = await axios.delete(`http://localhost:5000/api/auth/staff/${newStaffId}`, { headers });
    console.log('API Delete Response:', delRes.data);

    // Wait a brief tick for background PG sync
    await new Promise(r => setTimeout(r, 500));

    const pgAfter = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [newStaffId]);
    console.log('PostgreSQL lookup after delete (should be empty):', pgAfter.rows);

    const apiAfter = await axios.get('http://localhost:5000/api/auth/staff', { headers });
    console.log('Staff list after delete:', apiAfter.data.staff.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));

    if (pgAfter.rows.length === 0 && !apiAfter.data.staff.some(u => u.id === newStaffId)) {
      console.log('\n✅ PASSED: Staff member successfully and permanently deleted from both In-Memory JSON and PostgreSQL DB.');
    } else {
      console.error('\n❌ FAILED: Staff record was not deleted from PostgreSQL database.');
    }
  } catch (err) {
    console.error('Test Error:', err.response?.data || err.message);
  } finally {
    await pool.end();
  }
}

testStaffLifecycle();
