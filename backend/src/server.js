require('dotenv').config();
const app = require('./app');
const db = require('./config/db');
const { seedDatabase } = require('./seeds/seedData');

const { initPostgres } = require('./config/pgClient');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Initialize PostgreSQL if available
    await initPostgres();

    // Hydrate / merge from PostgreSQL if records exist
    await db.loadFromPostgres();

    // Seed initial dataset only if database is newly initialized
    await seedDatabase();

    // Sync any unsynced records to PostgreSQL
    await db.syncAllToPostgres();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Smart Merchant Backend Server running on port ${PORT}`);
      console.log(`📡 Base API URL: http://localhost:${PORT}/api`);
      console.log(`💡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
