const { seedDatabase } = require('../seeds/seedData');

(async () => {
  try {
    console.log('Starting full database refresh with rich daily essentials and seasonal invoices...');
    await seedDatabase(true);
    console.log('Reseed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Reseed error:', err);
    process.exit(1);
  }
})();
