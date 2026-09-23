const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const customerRoutes = require('./routes/customer.routes');
const supplierRoutes = require('./routes/supplier.routes');
const expenseRoutes = require('./routes/expense.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const forecastRoutes = require('./routes/forecast.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/forecast', forecastRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Merchant Backend API is operational' });
});

app.get('/api/system/db-status', (req, res) => {
  const db = require('./config/db');
  res.json(db.getStatus());
});

app.get('/api/system/public-highlights', (req, res) => {
  const db = require('./config/db');
  const invoices = db.table('invoices').find();
  const products = db.table('products').find();
  const customers = db.table('customers').find();
  const suppliers = db.table('suppliers').find();
  const status = db.getStatus();

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

  res.json({
    totalProducts: products.length,
    totalInvoices: invoices.length,
    totalCustomers: customers.length,
    totalSuppliers: suppliers.length,
    totalSales: Math.round(totalSales),
    databaseEngine: status.engine,
    databaseConnected: status.connected,
    activeTables: status.tables?.length || 12
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
