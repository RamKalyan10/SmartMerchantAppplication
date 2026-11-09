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
    const existingInvoicesCount = db.table('invoices').find().length;
    if (existingInvoicesCount === 0) {
      console.log('Database empty. Seeding initial dataset...');
      await seedDatabase();
    } else {
      console.log(`Database already populated (${existingInvoicesCount} invoices). Skipping reseed.`);
    }

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Smart Merchant Backend Server running on port ${PORT}`);
      console.log(`📡 Base API URL: http://localhost:${PORT}/api`);
      console.log(`💡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);

      // Sync any unsynced records to PostgreSQL in the background so port binding isn't delayed
      db.syncAllToPostgres().catch((err) => {
        console.warn('Background PostgreSQL sync notice:', err.message);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
