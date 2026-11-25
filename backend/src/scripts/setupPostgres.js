require('dotenv').config();
const { Client, Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupPostgres() {
  console.log('========================================================');
  console.log('🐘 Smart Merchant - PostgreSQL Database Initializer');
  console.log('========================================================');

  const dbHost = process.env.PGHOST || 'localhost';
  const dbPort = parseInt(process.env.PGPORT || '5432', 10);
  const dbUser = process.env.PGUSER || 'postgres';
  const dbPassword = process.env.PGPASSWORD;
  const targetDbName = process.env.PGDATABASE || 'smart_merchant';

  console.log(`Connecting to PostgreSQL server at ${dbHost}:${dbPort} as user "${dbUser}"...`);

  // Step 1: Connect to default postgres DB to check/create target DB
  const defaultClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres'
  });

  try {
    await defaultClient.connect();
    console.log(' Connected to PostgreSQL server.');

    const checkRes = await defaultClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (checkRes.rows.length === 0) {
      console.log(`Database "${targetDbName}" does not exist. Creating it now...`);
      await defaultClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(` Database "${targetDbName}" created successfully!`);
    } else {
      console.log(` Database "${targetDbName}" already exists.`);
    }
  } catch (err) {
    console.error(` Error connecting to PostgreSQL default DB:`, err.message);
    console.log('\n  Tip: Set PGPASSWORD in backend/.env or check that your PostgreSQL service is running.');
    return false;
  } finally {
    await defaultClient.end();
  }

  // Step 2: Connect to target database and apply schema
  const targetPool = new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: targetDbName
  });

  try {
    console.log(`Applying schema to "${targetDbName}"...`);
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await targetPool.query(schemaSql);
    console.log(' Schema tables, indexes, and constraints applied successfully!');

    // Step 3: Populate target database from local seed dataset if available
    const dbFilePath = path.join(__dirname, '../../data/merchant_db.json');
    if (fs.existsSync(dbFilePath)) {
      const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
      console.log('Syncing data from local seed dataset into PostgreSQL...');
      
      for (const [table, records] of Object.entries(dbData)) {
        if (Array.isArray(records) && records.length > 0) {
          for (const rec of records) {
            const keys = Object.keys(rec).filter(k => typeof rec[k] !== 'object' || rec[k] === null);
            if (keys.length === 0) continue;
            const cols = keys.map(k => `"${k}"`).join(', ');
            const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = keys.map(k => rec[k]);
            const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("id") DO UPDATE SET ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')}`;
            try {
              await targetPool.query(sql, values);
            } catch (e) {
              // Ignore non-matching schema table
            }
          }
          console.log(`  - Table "${table}": Synced ${records.length} records`);
        }
      }
    }

    console.log('\n========================================================');
    console.log(` PostgreSQL setup completed for database: ${targetDbName}`);
    console.log('========================================================');
    return true;
  } catch (err) {
    console.error(' Error executing schema:', err.message);
    return false;
  } finally {
    await targetPool.end();
  }
}

if (require.main === module) {
  setupPostgres().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = setupPostgres;
