require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function updatePassword() {
  const newPassword = 'onr123';
  const email = 'onr1@gmail.com';

  console.log(`Hashing new password "${newPassword}" for ${email}...`);
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);
  console.log(`Generated hash: ${newHash}`);

  // 1. Update merchant_db.json
  const dbPath = path.join(__dirname, '../data/merchant_db.json');
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(raw);
    let jsonUpdated = false;
    if (Array.isArray(db.users)) {
      for (const u of db.users) {
        if (u.email === email) {
          u.password = newHash;
          jsonUpdated = true;
          console.log(`Updated user ${email} in merchant_db.json`);
        }
      }
    }
    if (jsonUpdated) {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      console.log('Saved merchant_db.json successfully.');
    } else {
      console.warn(`User ${email} not found in merchant_db.json`);
    }
  }

  // 2. Update PostgreSQL if available
  const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'smart_merchant',
    password: process.env.PGPASSWORD || 'postgres',
    port: parseInt(process.env.PGPORT || '5432', 10),
  });

  try {
    const res = await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name, email, password;', [newHash, email]);
    if (res.rows.length > 0) {
      console.log(`Updated user in PostgreSQL:`, res.rows[0]);
    } else {
      console.log(`No user found in PostgreSQL with email ${email} to update.`);
    }
  } catch (err) {
    console.error('PostgreSQL update error:', err.message);
  } finally {
    await pool.end();
  }

  // Verify bcrypt
  const isMatch = await bcrypt.compare(newPassword, newHash);
  console.log(`Verification: bcrypt.compare("${newPassword}", hash) -> ${isMatch}`);
}

updatePassword();
