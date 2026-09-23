-- ========================================================
-- Smart Merchant PostgreSQL Database Schema
-- Multi-Tenant & Multi-Role Enterprise Schema
-- ========================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Staff',
    phone VARCHAR(50),
    avatar TEXT,
    business_name VARCHAR(255) DEFAULT 'Smart Merchant Enterprise',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    lead_time_days INTEGER DEFAULT 3,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRODUCTS & INVENTORY
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    category_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(255),
    supplier_id VARCHAR(64) REFERENCES suppliers(id) ON DELETE SET NULL,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 10,
    unit VARCHAR(50) DEFAULT 'Pcs',
    image_url TEXT,
    lead_time_days INTEGER DEFAULT 3,
    barcode VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar TEXT,
    address TEXT,
    tier VARCHAR(50) DEFAULT 'Silver',
    total_spent NUMERIC(14, 2) DEFAULT 0.00,
    pending_amount NUMERIC(14, 2) DEFAULT 0.00,
    orders_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. INVOICES / ORDERS
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    store_id VARCHAR(64),
    customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    date VARCHAR(64),
    time VARCHAR(64),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) DEFAULT 0.00,
    tax NUMERIC(12, 2) DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    payment_status VARCHAR(50) DEFAULT 'Paid',
    items_count INTEGER DEFAULT 0,
    items JSONB,
    cashier_id VARCHAR(64),
    cashier_name VARCHAR(255),
    billed_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. INVOICE LINE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id VARCHAR(64) PRIMARY KEY,
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. INVENTORY TRANSACTIONS / AUDIT LOG
-- `type` carries the default because `adjustStock` originally wrote only
-- `adjustment_type`, so every manual adjustment violated this NOT NULL and the
-- insert failed silently inside db.js's `.catch()`. The column stays NOT NULL;
-- it just no longer depends on the caller remembering it.
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'ADJUSTMENT', -- 'OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT', 'RETURN'
    adjustment_type VARCHAR(50),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id VARCHAR(100),
    reason TEXT,
    notes TEXT,
    created_by VARCHAR(255),
    adjusted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8b. PURCHASE ORDERS
-- A RESTOCK row records only that goods arrived. The order behind it is what
-- makes `lead_time_days` measurable (expected_at - ordered_at) rather than a
-- declared constant nothing can check.
CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    supplier_id VARCHAR(64),
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(12, 2) DEFAULT 0,
    ordered_at DATE NOT NULL,
    expected_at DATE,
    received_at DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ORDERED', -- 'ORDERED', 'RECEIVED', 'CANCELLED'
    trigger VARCHAR(50),
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_product ON purchase_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- 9. EXPENSE CATEGORIES & EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
    vendor VARCHAR(255),
    logged_by VARCHAR(255),
    date VARCHAR(64),
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. MARKETING CAMPAIGNS & PROMOTIONS
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    target_segment VARCHAR(100),
    channels TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. ROLE CAPABILITIES & PERMISSION MATRIX
CREATE TABLE IF NOT EXISTS role_capabilities (
    id VARCHAR(64) PRIMARY KEY,
    capability VARCHAR(255) NOT NULL,
    staff BOOLEAN DEFAULT FALSE,
    manager BOOLEAN DEFAULT FALSE,
    admin BOOLEAN DEFAULT FALSE,
    owner BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0
);

-- Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
