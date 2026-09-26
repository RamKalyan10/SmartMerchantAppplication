const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;
let pgConnected = false;
let connectionError = null;

function createPgPool() {
  const connectionString = process.env.DATABASE_URL;
  const config = connectionString
    ? { connectionString }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'smart_merchant',
        password: process.env.PGPASSWORD,
        port: parseInt(process.env.PGPORT || '5432', 10),
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000
      };

  return new Pool(config);
}

async function initPostgres() {
  try {
    pool = createPgPool();
    // Test connection
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), version()');
    pgConnected = true;
    connectionError = null;
    console.log(`✅ PostgreSQL Connected to database [${res.rows[0].current_database}]`);
    
    // Execute DDL Schema automatically to create all tables
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ PostgreSQL Schema tables and indexes verified/created.');
    }
    client.release();
    return true;
  } catch (err) {
    pgConnected = false;
    connectionError = err.message;
    console.warn(`ℹ️ PostgreSQL connection notice: ${err.message}. Using high-speed embedded local storage engine.`);
    return false;
  }
}

function getPool() {
  return pool;
}

function isPgConnected() {
  return pgConnected;
}

function getPgStatus() {
  return {
    connected: pgConnected,
    engine: pgConnected ? 'PostgreSQL' : 'Embedded JSON Store (Fast Local Engine)',
    database: pgConnected ? (process.env.PGDATABASE || 'smart_merchant') : 'merchant_db.json',
    error: connectionError
  };
}

module.exports = {
  initPostgres,
  getPool,
  isPgConnected,
  getPgStatus
};
