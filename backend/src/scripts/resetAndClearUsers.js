require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function resetAndClearUsers() {
  console.log('========================================================');
  console.log('🔄 PostgreSQL Schema Setup & Users Reset');
  console.log('========================================================');

  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'smart_merchant'
  });

  try {
    console.log('Connecting to PostgreSQL database "smart_merchant"...');
    await pool.query('SELECT 1');
    console.log(' Connected to PostgreSQL.');

    // 1. Apply full schema.sql to ensure all tables, constraints and indexes exist in public schema
    console.log('Applying complete schema.sql to public schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');
    await pool.query(schemaSql);
    console.log(' Schema applied successfully!');

    // 2. Clear all users in PostgreSQL
    console.log('Clearing all existing users from PostgreSQL...');
    await pool.query('TRUNCATE TABLE users CASCADE;');
    console.log(' Cleared "users" table in PostgreSQL (0 users remaining).');

    // 3. Clear all users in merchant_db.json
    const dbFilePath = path.join(__dirname, '../../data/merchant_db.json');
    if (fs.existsSync(dbFilePath)) {
      const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
      dbData.users = [];
      fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');
      console.log(' Cleared users from local merchant_db.json file.');
    }

    // 4. List all tables in public schema and their row counts
    console.log('\n--- Current Tables in public Schema ---');
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    for (const row of tableRes.rows) {
      const cntRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      console.log(`Table: ${row.table_name.padEnd(25)} | Rows: ${cntRes.rows[0].count}`);
    }

    console.log('\n========================================================');
    console.log(' Ready for fresh user registration!');
    console.log('========================================================');
  } catch (err) {
    console.error('Error during setup:', err);
  } finally {
    await pool.end();
  }
}

resetAndClearUsers();
