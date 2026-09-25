const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { simulateStockHistory } = require('./stockHistory');

// Indian festival & national holiday calendar for 2026
const FESTIVALS_2026 = {
  '2026-01-01': { name: "New Year's Day Celebrations", multiplier: 1.6 },
  '2026-01-14': { name: 'Makar Sankranti / Pongal Festival', multiplier: 1.75 },
  '2026-01-15': { name: 'Kanuma / Post-Sankranti Feast', multiplier: 1.4 },
  '2026-01-26': { name: 'Republic Day Holiday Shopping', multiplier: 1.5 },
  '2026-02-15': { name: 'Maha Shivratri Pooja Preparations', multiplier: 1.45 },
  '2026-03-03': { name: 'Holi Festive Shopping Rush', multiplier: 1.85 },
  '2026-03-04': { name: 'Holi Celebrations & Feasts', multiplier: 1.6 },
  '2026-03-19': { name: 'Ugadi / Gudi Padwa New Year Shopping', multiplier: 1.75 },
  '2026-03-20': { name: 'Eid-ul-Fitr Grand Celebrations', multiplier: 1.8 },
  '2026-04-14': { name: 'Tamil New Year / Baisakhi / Vishu', multiplier: 1.55 },
  '2026-05-01': { name: 'May Day Public Holiday', multiplier: 1.3 },
  '2026-06-16': { name: 'Eid-ul-Adha (Bakrid) Feast Prep', multiplier: 1.75 },
  '2026-06-17': { name: 'Bakrid Festival Holiday', multiplier: 1.5 },
  '2026-08-15': { name: 'Independence Day Mega Sale', multiplier: 1.7 },
  '2026-08-28': { name: 'Raksha Bandhan Sweets & Snacks Rush', multiplier: 1.85 },
  '2026-08-29': { name: 'Raksha Bandhan Celebrations', multiplier: 1.6 },
  '2026-09-01': { name: 'Ganesh Chaturthi Pooja & Modak Rush', multiplier: 1.9 },
  '2026-09-02': { name: 'Ganesh Chaturthi Festive Feast', multiplier: 1.7 }
};

// 8 Retail Categories
const CATEGORIES_MASTER = [
  { id: 'cat_grain', name: 'Grains, Atta & Pulses', code: 'GRAN', description: 'Staple food grains, whole wheat flour, basmati rice, lentils and pulses' },
  { id: 'cat_oil', name: 'Edible Oils & Pure Ghee', code: 'OIL', description: 'Refined cooking oils, mustard oil, groundnut oil and pure cow ghee' },
  { id: 'cat_dairy', name: 'Dairy, Milk & Eggs', code: 'DIRY', description: 'Fresh toned milk, curd, paneer, butter, cheese, and farm fresh eggs' },
  { id: 'cat_snack', name: 'Snacks, Biscuits & Sweets', code: 'SNAK', description: 'Packaged cookies, savory namkeens, chips, instant noodles, and sweets' },
  { id: 'cat_bev', name: 'Beverages, Tea & Coffee', code: 'BEV', description: 'Premium leaf teas, roast coffee, malt drinks, fruit juices and sodas' },
  { id: 'cat_care', name: 'Personal Care & Hygiene', code: 'CARE', description: 'Soaps, shampoos, oral care, skin creams and daily grooming essentials' },
  { id: 'cat_spice', name: 'Spices, Masalas & Condiments', code: 'SPIC', description: 'Pure ground spices, blended curry powders, whole spices and pickles' },
  { id: 'cat_clean', name: 'Cleaning & Household', code: 'CLEAN', description: 'Detergent powders, dishwash liquids, floor cleaners and home supplies' }
];

// 5 Dedicated Suppliers
const SUPPLIERS_MASTER = [
  {
    id: 'sup_001',
    name: 'Metro FMCG & Packaged Goods Wholesalers',
    contact_person: 'Vikas Gupta',
    phone: '+91 98111 22233',
    email: 'vikas.gupta@metrofmcg.in',
    lead_time_days: 2,
    address: 'Wholesale Depot 4, Outer Ring Road Logistics Park, Hyderabad',
    logo_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'sup_002',
    name: 'Sri Krishna Grain & Pulses Milling Co.',
    contact_person: 'Krishna Murthy',
    phone: '+91 98222 33344',
    email: 'krishna.murthy@srikrishnagrains.in',
    lead_time_days: 3,
    address: 'APMC Grain Market Yard, Guntur, AP',
    logo_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'sup_003',
    name: 'Heritage Dairy & Cold Chain Supplies',
    contact_person: 'Suresh Reddy',
    phone: '+91 98333 44455',
    email: 'suresh.reddy@heritagedairy.co.in',
    lead_time_days: 1,
    address: 'Cold Storage Unit 12, IDA Uppal, Hyderabad',
    logo_url: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'sup_004',
    name: 'Godrej & Dabur Personal Care Distributors',
    contact_person: 'Anita Desai',
    phone: '+91 98444 55566',
    email: 'anita.desai@carelogistics.in',
    lead_time_days: 4,
    address: 'Plot 45, Patancheru Industrial Estate, Hyderabad',
    logo_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'sup_005',
    name: 'Everest & MDH Spices & Condiments Hub',
    contact_person: 'Rajesh Mahajan',
    phone: '+91 98555 66677',
    email: 'rajesh.mahajan@spicehub.in',
    lead_time_days: 3,
    address: 'Begum Bazaar Spice Corridor, Old City, Hyderabad',
    logo_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&auto=format&fit=crop&q=80'
  }
];

// 5 Regular Customers with Khata Ledger Balances
const CUSTOMERS_MASTER = [
  {
    id: 'cust_001',
    name: 'Ramesh Sharma',
    phone: '+91 98765 43210',
    email: 'ramesh.sharma@gmail.com',
    tier: 'Gold',
    address: 'Flat 302, Sai Balaji Enclave, Madhapur, Hyderabad',
    pending_amount: 1450,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'cust_002',
    name: 'Sunita Patel',
    phone: '+91 98234 56789',
    email: 'sunita.patel@outlook.com',
    tier: 'Platinum',
    address: 'Villa 14, Green Meadows, Kondapur, Hyderabad',
    pending_amount: 0,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'cust_003',
    name: 'Anand Rao',
    phone: '+91 97123 45678',
    email: 'anand.rao@yahoo.com',
    tier: 'Silver',
    address: 'House No. 12-4-56, Kukatpally Housing Board, Hyderabad',
    pending_amount: 2850,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'cust_004',
    name: 'Priya Sundaram',
    phone: '+91 99456 78901',
    email: 'priya.sundaram@gmail.com',
    tier: 'Gold',
    address: 'Plot 88, Telecom Nagar, Gachibowli, Hyderabad',
    pending_amount: 650,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'cust_005',
    name: 'Mohammed Farooq',
    phone: '+91 98876 54321',
    email: 'm.farooq@gmail.com',
    tier: 'Silver',
    address: 'Door 5-9-102, Tolichowki Main Road, Hyderabad',
    pending_amount: 0,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80'
  }
];

// Comprehensive 88-Product Retail Master (Initial Stock 25-35 units)
const PRODUCTS_MASTER = [
  // --- 1. Grains, Atta & Pulses (12 products) ---
  { id: 'prd_grn_01', name: 'Daawat Super Basmati Rice (1 Kg)', sku: 'GRN-RICE-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 92, selling_price: 118, unit: 'Kg', min_stock_level: 15, stock_quantity: 32, lead_time_days: 3, barcode: '8901030000001', description: 'Aged long-grain royal fragrant basmati rice', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_02', name: 'India Gate Classic Basmati (5 Kg)', sku: 'GRN-RICE-02', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 490, selling_price: 599, unit: 'Bags', min_stock_level: 12, stock_quantity: 28, lead_time_days: 3, barcode: '8901030000002', description: 'Extra long traditional basmati rice bag', image_url: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_03', name: 'Sona Masoori Raw Rice (5 Kg)', sku: 'GRN-SONA-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 260, selling_price: 320, unit: 'Bags', min_stock_level: 20, stock_quantity: 35, lead_time_days: 3, barcode: '8901030000003', description: 'Lightweight easy digestible premium table rice', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_04', name: 'Aashirvaad Superior MP Sharbati Atta (5 Kg)', sku: 'GRN-ATTA-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 215, selling_price: 265, unit: 'Bags', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000004', description: '100% pure stone-ground chakki wheat flour', image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_05', name: 'Fortune Chakki Fresh Atta (10 Kg)', sku: 'GRN-ATTA-02', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 395, selling_price: 485, unit: 'Bags', min_stock_level: 15, stock_quantity: 30, lead_time_days: 3, barcode: '8901030000005', description: 'High fiber golden wheat flour value pack', image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_06', name: 'Tata Sampann Unpolished Toor Dal (1 Kg)', sku: 'GRN-TOOR-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 138, selling_price: 168, unit: 'Packets', min_stock_level: 20, stock_quantity: 35, lead_time_days: 3, barcode: '8901030000006', description: 'Naturally unpolished high-protein pigeon peas', image_url: 'https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_07', name: 'Tata Sampann Moong Dal Dhuli (1 Kg)', sku: 'GRN-MOON-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 122, selling_price: 150, unit: 'Packets', min_stock_level: 18, stock_quantity: 30, lead_time_days: 3, barcode: '8901030000007', description: 'Skinless yellow split moong lentils', image_url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_08', name: 'Tata Sampann Chana Dal (1 Kg)', sku: 'GRN-CHAN-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 78, selling_price: 98, unit: 'Packets', min_stock_level: 18, stock_quantity: 32, lead_time_days: 3, barcode: '8901030000008', description: 'Rich Bengal gram split dal', image_url: 'https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_09', name: 'Tata Sampann Urad Dal White (1 Kg)', sku: 'GRN-URAD-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 130, selling_price: 160, unit: 'Packets', min_stock_level: 15, stock_quantity: 28, lead_time_days: 3, barcode: '8901030000009', description: 'Whole washed urad dal for idli & dosa', image_url: 'https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_10', name: 'Kabuli Chana Big White (1 Kg)', sku: 'GRN-KABL-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 135, selling_price: 165, unit: 'Packets', min_stock_level: 12, stock_quantity: 26, lead_time_days: 3, barcode: '8901030000010', description: 'Large grain chickpeas for chole curry', image_url: 'https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_11', name: 'Rajma Chitra Organic (1 Kg)', sku: 'GRN-RAJM-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 145, selling_price: 180, unit: 'Packets', min_stock_level: 12, stock_quantity: 25, lead_time_days: 3, barcode: '8901030000011', description: 'Selected high-flavor kidney beans', image_url: 'https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_grn_12', name: 'Poha Thick Premium (1 Kg)', sku: 'GRN-POHA-01', cat_code: 'GRAN', category_id: 'cat_grain', category_name: 'Grains, Atta & Pulses', supplier_id: 'sup_002', cost_price: 48, selling_price: 62, unit: 'Packets', min_stock_level: 20, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000012', description: 'Nutritious flattened rice flakes for breakfast', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80' },

  // --- 2. Edible Oils & Pure Ghee (10 products) ---
  { id: 'prd_oil_01', name: 'Fortune Sunlite Refined Sunflower Oil (1 L Pouch)', sku: 'OIL-SUN-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 118, selling_price: 142, unit: 'Pouches', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000013', description: 'Light non-sticky cooking oil enriched with vitamins', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_02', name: 'Fortune Sunlite Sunflower Oil Jar (5 L)', sku: 'OIL-SUN-05', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 590, selling_price: 715, unit: 'Cans', min_stock_level: 10, stock_quantity: 26, lead_time_days: 2, barcode: '8901030000014', description: 'Family cooking oil canister with ergonomic handle', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_03', name: 'Saffola Gold Pro Healthy Blend Oil (1 L Pouch)', sku: 'OIL-SAF-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 145, selling_price: 175, unit: 'Pouches', min_stock_level: 20, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000015', description: 'Dual-seed blend with LOSORB technology', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_04', name: 'Fortune Kachi Ghani Mustard Oil (1 L Bottle)', sku: 'OIL-MUST-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 135, selling_price: 165, unit: 'Bottles', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000016', description: 'Cold pressed strong pungent mustard oil', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_05', name: 'Amul Pure Cow Ghee Tin (1 L)', sku: 'OIL-GHEE-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_003', cost_price: 520, selling_price: 640, unit: 'Tins', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000017', description: 'Rich aromatic traditional golden cow ghee', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_06', name: 'Amul Pure Ghee Pouch (500 ml)', sku: 'OIL-GHEE-50', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_003', cost_price: 270, selling_price: 330, unit: 'Pouches', min_stock_level: 20, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000018', description: 'Granular fresh clarified butter pouch', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_07', name: 'Patanjali Cow Ghee Jar (1 L)', sku: 'OIL-GHEE-02', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 510, selling_price: 625, unit: 'Jars', min_stock_level: 12, stock_quantity: 25, lead_time_days: 2, barcode: '8901030000019', description: 'Ayurvedic pure cow milk ghee', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_08', name: 'Dhara Filtered Groundnut Oil (1 L)', sku: 'OIL-GNUT-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 168, selling_price: 205, unit: 'Pouches', min_stock_level: 15, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000020', description: 'Aromatic traditional peanut oil for deep frying', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_09', name: 'Figaro Extra Virgin Olive Oil (500 ml)', sku: 'OIL-OLV-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 480, selling_price: 590, unit: 'Bottles', min_stock_level: 8, stock_quantity: 25, lead_time_days: 3, barcode: '8901030000021', description: 'Spanish cold extracted pure virgin olive oil', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_oil_10', name: 'KLF Coconad Pure Coconut Oil (500 ml Bottle)', sku: 'OIL-COCO-01', cat_code: 'OIL', category_id: 'cat_oil', category_name: 'Edible Oils & Pure Ghee', supplier_id: 'sup_001', cost_price: 140, selling_price: 175, unit: 'Bottles', min_stock_level: 15, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000022', description: '100% edible roasted coconut oil', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },

  // --- 3. Dairy, Milk & Eggs (10 products) ---
  { id: 'prd_dry_01', name: 'Amul Taaza Homogenised Milk (1 L Tetra)', sku: 'DRY-MILK-01', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 56, selling_price: 70, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 1, barcode: '8901030000023', description: 'UHT treated long life toned milk', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_02', name: 'Amul Gold Full Cream Milk (1 L Tetra)', sku: 'DRY-MILK-02', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 66, selling_price: 82, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 1, barcode: '8901030000024', description: 'Creamy high fat rich milk for desserts', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_03', name: 'Amul Pasteurised Butter (500g Block)', sku: 'DRY-BTR-01', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 228, selling_price: 275, unit: 'Blocks', min_stock_level: 18, stock_quantity: 30, lead_time_days: 1, barcode: '8901030000025', description: 'Iconic salted table butter brick', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_04', name: 'Amul Pasteurised Butter (100g Pack)', sku: 'DRY-BTR-02', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 46, selling_price: 58, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 1, barcode: '8901030000026', description: 'Fresh salted butter small box', image_url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_05', name: 'Amul Fresh Paneer (200g Block)', sku: 'DRY-PAN-01', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 72, selling_price: 92, unit: 'Packs', min_stock_level: 20, stock_quantity: 30, lead_time_days: 1, barcode: '8901030000027', description: 'Soft creamy malai cottage cheese', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_06', name: 'Amul Processed Cheese Cubes (200g)', sku: 'DRY-CHS-01', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 110, selling_price: 135, unit: 'Boxes', min_stock_level: 15, stock_quantity: 28, lead_time_days: 1, barcode: '8901030000028', description: 'Individually wrapped creamy cheese cubes', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_07', name: 'Amul Cheese Slices (200g / 10 Slices)', sku: 'DRY-CHS-02', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 115, selling_price: 145, unit: 'Packs', min_stock_level: 15, stock_quantity: 28, lead_time_days: 1, barcode: '8901030000029', description: 'Sandwich melt processed cheese slices', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_08', name: 'Farm Fresh White Table Eggs (Tray of 30)', sku: 'DRY-EGG-30', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 155, selling_price: 195, unit: 'Trays', min_stock_level: 15, stock_quantity: 32, lead_time_days: 1, barcode: '8901030000030', description: 'Farm graded clean nutritious hen eggs', image_url: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_09', name: 'Farm Fresh White Eggs (Pack of 6)', sku: 'DRY-EGG-06', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 36, selling_price: 48, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 1, barcode: '8901030000031', description: 'Egg crate small consumer pack', image_url: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_dry_10', name: 'Amul Masti Dahi / Curd Tub (400g)', sku: 'DRY-DAHI-01', cat_code: 'DIRY', category_id: 'cat_dairy', category_name: 'Dairy, Milk & Eggs', supplier_id: 'sup_003', cost_price: 32, selling_price: 42, unit: 'Tubs', min_stock_level: 20, stock_quantity: 30, lead_time_days: 1, barcode: '8901030000032', description: 'Thick pasteurised probiotic plain dahi', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80' },

  // --- 4. Snacks, Biscuits & Sweets (12 products) ---
  { id: 'prd_snk_01', name: 'Maggi 2-Minute Masala Noodles (Pack of 4, 280g)', sku: 'SNK-MAGI-04', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 44, selling_price: 56, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000033', description: 'Classic Indian spice blend instant noodles', image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_02', name: 'Maggi 2-Minute Masala Noodles Family Pack (560g)', sku: 'SNK-MAGI-08', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 84, selling_price: 105, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000034', description: '8-in-1 family value pack instant noodles', image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_03', name: 'Parle-G Original Glucose Biscuits (800g Super Saver)', sku: 'SNK-PARL-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 68, selling_price: 85, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000035', description: 'The nation staple tea-time energy biscuits', image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_04', name: 'Britannia Good Day Butter Cookies (600g Multipack)', sku: 'SNK-GDAY-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 105, selling_price: 135, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000036', description: 'Rich butter cookies with delightful smiles', image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_05', name: 'Britannia Marie Gold Biscuits (1 Kg Family Pack)', sku: 'SNK-MARI-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 112, selling_price: 140, unit: 'Packs', min_stock_level: 20, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000037', description: 'Crisp light tea companion tea biscuits', image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_06', name: 'Oreo Original Vanilla Creme Cookies (300g)', sku: 'SNK-OREO-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 68, selling_price: 88, unit: 'Packs', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000038', description: 'Rich chocolate cookie sandwich with vanilla creme', image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_07', name: 'Haldiram All In One Namkeen (400g Pouch)', sku: 'SNK-HALD-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 90, selling_price: 115, unit: 'Pouches', min_stock_level: 20, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000039', description: 'Crunchy sweet-tangy signature mixed namkeen', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_08', name: 'Haldiram Bhujia Sev (400g Pouch)', sku: 'SNK-HALD-02', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 88, selling_price: 110, unit: 'Pouches', min_stock_level: 20, stock_quantity: 34, lead_time_days: 2, barcode: '8901030000040', description: 'Crispy spicy tepary bean and chickpea snack', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_09', name: 'Lay India Magic Masala Potato Chips (115g)', sku: 'SNK-LAYS-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 38, selling_price: 50, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000041', description: 'Crunchy sliced potato chips with spicy masala', image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_10', name: 'Kurkure Masala Munch (140g Family Pack)', sku: 'SNK-KURK-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 36, selling_price: 48, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000042', description: 'Tedha par mera hai crunchy corn puffs', image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_11', name: 'Cadbury Dairy Milk Silk Chocolate (150g)', sku: 'SNK-CADB-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 140, selling_price: 175, unit: 'Bars', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000043', description: 'Smooth melting creamy chocolate bar', image_url: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_snk_12', name: 'Haldiram Gulab Jamun Tin (1 Kg)', sku: 'SNK-SWET-01', cat_code: 'SNAK', category_id: 'cat_snack', category_name: 'Snacks, Biscuits & Sweets', supplier_id: 'sup_001', cost_price: 195, selling_price: 245, unit: 'Tins', min_stock_level: 12, stock_quantity: 26, lead_time_days: 2, barcode: '8901030000044', description: 'Traditional khoya dumplings in sugar syrup', image_url: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400&auto=format&fit=crop&q=80' },

  // --- 5. Beverages, Tea & Coffee (12 products) ---
  { id: 'prd_bev_01', name: 'Tata Tea Gold Leaf Tea (500g Pouch)', sku: 'BEV-TEA-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 245, selling_price: 310, unit: 'Pouches', min_stock_level: 20, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000045', description: 'Exquisite aroma with gently rolled long leaves', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_02', name: 'Tata Tea Premium Desh Ki Chai (1 Kg Pouch)', sku: 'BEV-TEA-02', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 390, selling_price: 485, unit: 'Pouches', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000046', description: 'Rich taste with medium and large tea grains', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_03', name: 'Red Label Natural Care Tea (500g Pouch)', sku: 'BEV-TEA-03', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 260, selling_price: 325, unit: 'Pouches', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000047', description: 'Ayurvedic 5 herbs blend immunity tea', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_04', name: 'Bru Instant Coffee Jar (100g Glass Jar)', sku: 'BEV-COF-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 185, selling_price: 235, unit: 'Jars', min_stock_level: 18, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000048', description: '70% coffee 30% chicory roasted blend', image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_05', name: 'Nescafe Classic Instant Coffee Jar (100g)', sku: 'BEV-COF-02', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 260, selling_price: 320, unit: 'Jars', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000049', description: '100% pure roasted coffee granules', image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_06', name: 'Bournvita Health Drink Jar (1 Kg)', sku: 'BEV-HLT-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 340, selling_price: 425, unit: 'Jars', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000050', description: 'Malt chocolate nutritional drink with inner strength', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_07', name: 'Horlicks Classic Malt Nutrition Jar (1 Kg)', sku: 'BEV-HLT-02', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 350, selling_price: 435, unit: 'Jars', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000051', description: 'Clinically proven malted wheat nourishment', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_08', name: 'Frooti Mango Drink Pet Bottle (1.2 L)', sku: 'BEV-JUC-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 52, selling_price: 68, unit: 'Bottles', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000052', description: 'Real alphonso mango pulp beverage', image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_09', name: 'Real Activ Mixed Fruit Juice (1 L Tetra)', sku: 'BEV-JUC-02', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 98, selling_price: 125, unit: 'Packs', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000053', description: '100% juice with no added sugar', image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_10', name: 'Coca-Cola Original Taste Bottle (1.25 L)', sku: 'BEV-SDA-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 36, selling_price: 48, unit: 'Bottles', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000054', description: 'Sparkling refreshing cola carbonated beverage', image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_11', name: 'Thums Up Charged Carbonated Can (300 ml)', sku: 'BEV-SDA-02', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 30, selling_price: 40, unit: 'Cans', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000055', description: 'Taste the thunder strong carbonated cola', image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_bev_12', name: 'Bisleri Mineral Water Bottle (1 L)', sku: 'BEV-WTR-01', cat_code: 'BEV', category_id: 'cat_bev', category_name: 'Beverages, Tea & Coffee', supplier_id: 'sup_001', cost_price: 14, selling_price: 20, unit: 'Bottles', min_stock_level: 30, stock_quantity: 40, lead_time_days: 1, barcode: '8901030000056', description: 'Purified mineral enriched bottled drinking water', image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80' },

  // --- 6. Personal Care & Hygiene (12 products) ---
  { id: 'prd_car_01', name: 'Dettol Original Bathing Soap (Pack of 3 x 125g)', sku: 'CAR-SOAP-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 118, selling_price: 148, unit: 'Packs', min_stock_level: 20, stock_quantity: 35, lead_time_days: 4, barcode: '8901030000057', description: 'Antibacterial germ protection body cleansing soap', image_url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_02', name: 'Lifebuoy Total 10 Soap (Pack of 4 x 100g)', sku: 'CAR-SOAP-02', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 92, selling_price: 118, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 4, barcode: '8901030000058', description: 'Advanced silver shield antibacterial bar', image_url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_03', name: 'Dove Cream Beauty Bathing Bar (3 x 100g)', sku: 'CAR-SOAP-03', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 165, selling_price: 210, unit: 'Packs', min_stock_level: 15, stock_quantity: 28, lead_time_days: 4, barcode: '8901030000059', description: '1/4th moisturizing cream formulation for soft skin', image_url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_04', name: 'Colgate Strong Teeth Toothpaste (200g Value Pack)', sku: 'CAR-PAST-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 88, selling_price: 115, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 4, barcode: '8901030000060', description: 'Amino power calcium protection oral toothpaste', image_url: 'https://images.unsplash.com/photo-1559591937-e1032b4b455b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_05', name: 'Close-Up Red Hot Gel Toothpaste (150g)', sku: 'CAR-PAST-02', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 76, selling_price: 98, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 4, barcode: '8901030000061', description: 'Zinc mouthwash antibacterial freshness gel', image_url: 'https://images.unsplash.com/photo-1559591937-e1032b4b455b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_06', name: 'Oral-B Sensitive Soft Toothbrush (Buy 2 Get 1)', sku: 'CAR-BRSH-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 68, selling_price: 90, unit: 'Packs', min_stock_level: 20, stock_quantity: 30, lead_time_days: 4, barcode: '8901030000062', description: 'End-rounded extra soft gum friendly bristles', image_url: 'https://images.unsplash.com/photo-1559591937-e1032b4b455b?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_07', name: 'Head & Shoulders Anti-Dandruff Shampoo (340 ml)', sku: 'CAR-SHMP-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 245, selling_price: 310, unit: 'Bottles', min_stock_level: 15, stock_quantity: 28, lead_time_days: 4, barcode: '8901030000063', description: 'Clinically proven smooth & silky dandruff control', image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_08', name: 'Clinic Plus Strong & Long Shampoo (340 ml Bottle)', sku: 'CAR-SHMP-02', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 165, selling_price: 215, unit: 'Bottles', min_stock_level: 18, stock_quantity: 32, lead_time_days: 4, barcode: '8901030000064', description: 'Milk protein nourishment daily hair wash', image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_09', name: 'Parachute 100% Pure Coconut Hair Oil (300 ml)', sku: 'CAR-HOIL-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 110, selling_price: 140, unit: 'Bottles', min_stock_level: 20, stock_quantity: 35, lead_time_days: 4, barcode: '8901030000065', description: '5-stage filtered pure edible hair oil', image_url: 'https://images.unsplash.com/photo-1608248597359-07f23a9d4536?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_10', name: 'Dettol Liquid Handwash Refill Pouch (675 ml)', sku: 'CAR-HAND-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 88, selling_price: 115, unit: 'Pouches', min_stock_level: 20, stock_quantity: 32, lead_time_days: 4, barcode: '8901030000066', description: '10x better germ protection liquid refill', image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_11', name: 'Pond White Beauty Face Cream (50g Tub)', sku: 'CAR-FACE-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 140, selling_price: 175, unit: 'Tubs', min_stock_level: 12, stock_quantity: 26, lead_time_days: 4, barcode: '8901030000067', description: 'Spot-less glow brightening day cream', image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_car_12', name: 'Whisper Choice Wings Sanitary Pads (20 Pads XL)', sku: 'CAR-HYGN-01', cat_code: 'CARE', category_id: 'cat_care', category_name: 'Personal Care & Hygiene', supplier_id: 'sup_004', cost_price: 115, selling_price: 145, unit: 'Packs', min_stock_level: 18, stock_quantity: 30, lead_time_days: 4, barcode: '8901030000068', description: 'All-night lock protection extra long pads', image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80' },

  // --- 7. Spices, Masalas & Condiments (10 products) ---
  { id: 'prd_spc_01', name: 'Everest Turmeric Powder Haldi (500g)', sku: 'SPC-TURM-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 110, selling_price: 140, unit: 'Packets', min_stock_level: 20, stock_quantity: 35, lead_time_days: 3, barcode: '8901030000069', description: 'High curcumin bright aromatic Salem turmeric', image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_02', name: 'Everest Tikhalal Red Chilli Powder (500g)', sku: 'SPC-CHIL-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 175, selling_price: 220, unit: 'Packets', min_stock_level: 20, stock_quantity: 35, lead_time_days: 3, barcode: '8901030000070', description: 'Vibrant red color and authentic fiery pungency', image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_03', name: 'Everest Coriander Powder Dhaniya (500g)', sku: 'SPC-CORI-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 105, selling_price: 135, unit: 'Packets', min_stock_level: 20, stock_quantity: 32, lead_time_days: 3, barcode: '8901030000071', description: 'Freshly ground green coriander seeds aroma', image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_04', name: 'MDH Garam Masala (100g Box)', sku: 'SPC-GAR-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 72, selling_price: 92, unit: 'Boxes', min_stock_level: 20, stock_quantity: 32, lead_time_days: 3, barcode: '8901030000072', description: 'Royal blend of 15 whole roasted spices', image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_05', name: 'MDH Chana Masala (100g Box)', sku: 'SPC-CHNA-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 68, selling_price: 88, unit: 'Boxes', min_stock_level: 18, stock_quantity: 30, lead_time_days: 3, barcode: '8901030000073', description: 'Authentic Amritsari spicy chickpea masala', image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_06', name: 'Tata Salt Vacuum Evaporated Iodized (1 Kg)', sku: 'SPC-SALT-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_001', cost_price: 22, selling_price: 28, unit: 'Packets', min_stock_level: 30, stock_quantity: 40, lead_time_days: 2, barcode: '8901030000074', description: 'Desh Ka Namak pure iodised table salt', image_url: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_07', name: 'Madhur Pure Refined Sugar (1 Kg Pouch)', sku: 'SPC-SUGR-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_002', cost_price: 45, selling_price: 58, unit: 'Packets', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000075', description: 'Sulphur-free sparkling white crystal sugar', image_url: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_08', name: 'Maggi Hot & Sweet Tomato Chilli Sauce (1 Kg Bottle)', sku: 'SPC-SAUC-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_001', cost_price: 125, selling_price: 160, unit: 'Bottles', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000076', description: 'Its different signature sweet & fiery sauce', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_09', name: 'Kissan Fresh Tomato Ketchup (950g Squeezo)', sku: 'SPC-SAUC-02', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_001', cost_price: 110, selling_price: 145, unit: 'Bottles', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000077', description: '100% real juicy farm fresh ripe tomatoes', image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_spc_10', name: 'Priya Mango Pickle with Garlic (300g Jar)', sku: 'SPC-PCKL-01', cat_code: 'SPIC', category_id: 'cat_spice', category_name: 'Spices, Masalas & Condiments', supplier_id: 'sup_005', cost_price: 85, selling_price: 110, unit: 'Jars', min_stock_level: 18, stock_quantity: 32, lead_time_days: 3, barcode: '8901030000078', description: 'South Indian authentic spicy mustard raw mango pickle', image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80' },

  // --- 8. Cleaning & Household Essentials (10 products) ---
  { id: 'prd_cln_01', name: 'Surf Excel Easy Wash Detergent Powder (1 Kg Pouch)', sku: 'CLN-DET-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 115, selling_price: 145, unit: 'Pouches', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000079', description: 'Superfine fabric stain removal detergent powder', image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_02', name: 'Surf Excel Matic Top Load Liquid Detergent (1 L)', sku: 'CLN-DET-02', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 180, selling_price: 230, unit: 'Bottles', min_stock_level: 18, stock_quantity: 30, lead_time_days: 2, barcode: '8901030000080', description: 'Machine wash liquid leaves no residue on clothes', image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_03', name: 'Ariel Complete Detergent Powder (2 Kg Bag)', sku: 'CLN-DET-03', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 290, selling_price: 365, unit: 'Bags', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000081', description: 'Tough stain fighter enzymatic technology', image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_04', name: 'Rin Detergent Bar (Pack of 4 x 250g)', sku: 'CLN-SOAP-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 76, selling_price: 96, unit: 'Packs', min_stock_level: 20, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000082', description: 'Bright white shine laundry cleaning bar', image_url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_05', name: 'Vim Dishwash Gel Lemon Refill Pouch (750 ml)', sku: 'CLN-DSH-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 110, selling_price: 140, unit: 'Pouches', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000083', description: 'Degreasing lemon power concentrated dish gel', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_06', name: 'Vim Dishwash Bar with Polycoat (300g)', sku: 'CLN-DSH-02', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 24, selling_price: 32, unit: 'Bars', min_stock_level: 30, stock_quantity: 40, lead_time_days: 2, barcode: '8901030000084', description: 'Anti-soggy long lasting dish wash soap bar', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_07', name: 'Lizol Disinfectant Floor Cleaner Citrus (2 L Bottle)', sku: 'CLN-FLR-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 290, selling_price: 365, unit: 'Bottles', min_stock_level: 15, stock_quantity: 28, lead_time_days: 2, barcode: '8901030000085', description: 'Kills 99.9% germs leaving pleasant citrus fragrance', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_08', name: 'Harpic Power Plus Toilet Cleaner Original (1 L)', sku: 'CLN-TOI-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 155, selling_price: 198, unit: 'Bottles', min_stock_level: 20, stock_quantity: 32, lead_time_days: 2, barcode: '8901030000086', description: '10x max clean limescale and stain remover liquid', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_09', name: 'GoodKnight Gold Flash Liquid Mosquito Vaporizer (45ml x 2)', sku: 'CLN-MOS-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_004', cost_price: 118, selling_price: 150, unit: 'Packs', min_stock_level: 18, stock_quantity: 30, lead_time_days: 4, barcode: '8901030000087', description: 'Dual flash mode instant mosquito protection refill', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' },
  { id: 'prd_cln_10', name: 'Scotch-Brite Heavy Duty Scrub Pad (Pack of 3)', sku: 'CLN-SCRB-01', cat_code: 'CLEAN', category_id: 'cat_clean', category_name: 'Cleaning & Household', supplier_id: 'sup_001', cost_price: 42, selling_price: 55, unit: 'Packs', min_stock_level: 25, stock_quantity: 35, lead_time_days: 2, barcode: '8901030000088', description: 'Stain cutter non-rust durable utensil scrubber', image_url: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80' }
];

async function seedDatabase(options = {}) {
  console.log('========================================================');
  console.log('🌱 Smart Merchant - Calibrated Retail Dataset Seeder');
  console.log('   (From 2026-01-05 to 2026-09-19: 258 Days Simulation)');
  console.log('========================================================');

  const ownerPasswordHash = await bcrypt.hash('onr123', 10);
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const storeId = 'store_dwdm_001';

  // 1. Clear database collections (Clean Slate)
  [
    'categories',
    'suppliers',
    'products',
    'customers',
    'invoices',
    'invoice_items',
    'inventory_transactions',
    'purchase_orders',
    'expenses',
    'expense_categories',
    'marketing_campaigns',
    'role_capabilities'
  ].forEach(table => {
    if (db.data[table]) db.data[table] = [];
  });

  // 2. Users: Only Store Owner and a Cashier (salary 12000)
  db.data.users = [
    {
      id: 'usr_owner_001',
      store_id: storeId,
      name: 'Store Owner',
      email: 'onr1@gmail.com',
      password: ownerPasswordHash,
      role: 'Owner',
      phone: '+91 99887 76655',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store'
    },
    {
      id: 'usr_csh_001',
      store_id: storeId,
      name: 'Ravi Kumar',
      email: 'cashier1@dwdmstore.com',
      password: defaultPasswordHash,
      role: 'Staff',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      business_name: 'Smart Merchant Store',
      salary: 12000
    }
  ];

  // 3. Seed Role Capabilities
  const roleCapabilities = [
    { id: 'cap_1', capability: 'Create & Print POS Invoices', staff: true, manager: true, admin: true, owner: true, display_order: 1 },
    { id: 'cap_2', capability: 'View Product Catalog & Inventory Levels', staff: true, manager: true, admin: true, owner: true, display_order: 2 },
    { id: 'cap_3', capability: 'Adjust Stock & Log Restock Shipments', staff: false, manager: true, admin: true, owner: true, display_order: 3 },
    { id: 'cap_4', capability: 'Log Operational & Supplier Expenses', staff: false, manager: true, admin: true, owner: true, display_order: 4 },
    { id: 'cap_5', capability: 'Create & Edit Products, SKUs & Categories', staff: false, manager: false, admin: true, owner: true, display_order: 5 },
    { id: 'cap_6', capability: 'Full Financials, Profit Margins & Role Assignment', staff: false, manager: false, admin: false, owner: true, display_order: 6 }
  ];
  roleCapabilities.forEach(cap => db.table('role_capabilities').insert(cap, false));

  // 4. Seed Categories
  CATEGORIES_MASTER.forEach(cat => {
    db.table('categories').insert({ ...cat, store_id: storeId }, false);
  });

  // 5. Seed Suppliers (5 Suppliers)
  SUPPLIERS_MASTER.forEach(sup => {
    db.table('suppliers').insert({ ...sup, store_id: storeId }, false);
  });

  // 6. Seed Customers (5 Customers)
  CUSTOMERS_MASTER.forEach(cust => {
    db.table('customers').insert({ ...cust, store_id: storeId, total_spent: 0, orders_count: 0 }, false);
  });

  // 7. Seed Products (88 Products)
  PRODUCTS_MASTER.forEach(prod => {
    db.table('products').insert({ ...prod, store_id: storeId }, false);
  });

  // 8. Generate Realistic POS Invoices (2026-01-05 to 2026-09-23)
  // Calibrated to 22-27 daily invoices for a realistic retail monthly net profit of ₹60k - ₹80k
  const startDate = new Date('2026-01-05T00:00:00Z');
  const endDate = new Date('2026-09-23T00:00:00Z');
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  console.log(`Generating invoices across ${totalDays} days (${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)})...`);

  const walkinNames = [
    'Walk-in Customer', 'Cash Retail Customer', 'Local Resident',
    'Walk-in Shopper', 'Counter Customer', 'Neighborhood Buyer'
  ];

  let invoiceNumberSeq = 10001;
  const customerSpendMap = {};
  const products = PRODUCTS_MASTER;

  for (let d = 0; d < totalDays; d++) {
    const currDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = currDate.toISOString().slice(0, 10);
    const dayOfWeek = currDate.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const dayOfMonth = currDate.getUTCDate();
    const isPaydayWindow = (dayOfMonth >= 1 && dayOfMonth <= 6);
    const festivalInfo = FESTIVALS_2026[dateStr];

    // Calculate daily invoice count (target 22 to 27 invoices per day, calibrated for ~₹60k-80k monthly net profit)
    let dailyTarget = 22 + Math.floor(Math.random() * 6); // 22 to 27 (avg 24.5)
    if (festivalInfo) {
      dailyTarget = Math.round(dailyTarget * (festivalInfo.multiplier > 1.4 ? 1.25 : 1.15));
    } else if (isWeekend) {
      dailyTarget = Math.min(27, dailyTarget + 2);
    } else if (isPaydayWindow) {
      dailyTarget = Math.min(26, dailyTarget + 1);
    }

    for (let i = 0; i < dailyTarget; i++) {
      const invId = `INV-2026-${String(invoiceNumberSeq++).padStart(6, '0')}`;
      const hour = 8 + Math.floor(Math.random() * 14); // 8 AM to 10 PM
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const invTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      const createdAt = `${dateStr}T${invTime}.000Z`;

      // Realistic retail basket distribution for neighborhood grocery:
      // Calibrated for ~₹380 - ₹440 avg basket size
      const basketRand = Math.random();
      let targetBasketLines = 1;
      let targetQtyMax = 1;

      if (basketRand < 0.70) {
        targetBasketLines = 1 + (Math.random() < 0.35 ? 1 : 0); // 1 to 2 lines
        targetQtyMax = 1;
      } else if (basketRand < 0.92) {
        targetBasketLines = 2 + Math.floor(Math.random() * 2); // 2 to 3 lines
        targetQtyMax = 1;
      } else {
        targetBasketLines = 3 + Math.floor(Math.random() * 2); // 3 to 4 lines
        targetQtyMax = 2;
      }

      // Pick unique items for this basket
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      const selectedProds = shuffled.slice(0, targetBasketLines);

      const items = [];
      let subtotal = 0;

      for (const p of selectedProds) {
        let qty = 1;
        if (targetQtyMax > 1 && Math.random() < 0.25) {
          qty = 2;
        }
        // If high priced item (> ₹300 like 5L oil or 1L ghee), keep quantity to 1
        if (p.selling_price > 300) qty = 1;

        const lineTotal = p.selling_price * qty;
        subtotal += lineTotal;

        items.push({
          product_id: p.id,
          product_name: p.name,
          sku: p.sku,
          unit_price: p.selling_price,
          cost_price: p.cost_price,
          quantity: qty,
          unit: p.unit,
          category_id: p.category_id,
          category_name: p.category_name,
          total_amount: lineTotal
        });

        // Cap individual invoice at ~₹2,000 max
        if (subtotal > 2000) break;
      }

      // Ensure minimum ₹50 per invoice
      if (subtotal < 50 && items.length > 0) {
        items[0].quantity = Math.max(items[0].quantity, Math.ceil(50 / items[0].unit_price));
        items[0].total_amount = items[0].unit_price * items[0].quantity;
        subtotal = items.reduce((sum, it) => sum + it.total_amount, 0);
      }

      // Volume discount on baskets >= ₹1,200
      let discount = 0;
      if (subtotal >= 2000) {
        discount = Math.round(subtotal * 0.04);
      } else if (subtotal >= 1200) {
        discount = Math.round(subtotal * 0.02);
      }

      const tax = Math.round((subtotal - discount) * 0.05); // 5% GST
      const grandTotal = subtotal - discount + tax;

      // Customer mapping: ~35% regular customers, ~65% walk-ins
      const isRegular = Math.random() < 0.35;
      let customerId = null;
      let customerName = walkinNames[Math.floor(Math.random() * walkinNames.length)];
      let customerPhone = '';
      let customerEmail = '';

      if (isRegular) {
        const regCust = CUSTOMERS_MASTER[Math.floor(Math.random() * CUSTOMERS_MASTER.length)];
        customerId = regCust.id;
        customerName = regCust.name;
        customerPhone = regCust.phone;
        customerEmail = regCust.email;

        if (!customerSpendMap[regCust.id]) customerSpendMap[regCust.id] = { total: 0, count: 0 };
        customerSpendMap[regCust.id].total += grandTotal;
        customerSpendMap[regCust.id].count += 1;
      }

      // Payment method
      const payRand = Math.random();
      let paymentMethod = 'UPI';
      if (payRand < 0.58) paymentMethod = 'UPI';
      else if (payRand < 0.85) paymentMethod = 'Cash';
      else if (payRand < 0.95) paymentMethod = 'Card';
      else if (isRegular) paymentMethod = 'Khata';
      else paymentMethod = 'UPI';

      const paymentStatus = (paymentMethod === 'Khata') ? 'PENDING' : 'PAID';

      const invoiceRecord = {
        id: invId,
        invoice_number: invId,
        store_id: storeId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        date: dateStr,
        time: invTime,
        created_at: createdAt,
        items: items,
        subtotal: subtotal,
        discount: discount,
        tax: tax,
        total_amount: grandTotal,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        cashier_id: i % 3 === 0 ? 'usr_owner_001' : 'usr_csh_001',
        cashier_name: i % 3 === 0 ? 'Store Owner' : 'Ravi Kumar (Cashier)',
        billed_by: i % 3 === 0 ? 'Store Owner' : 'Ravi Kumar (Cashier)',
        notes: festivalInfo ? festivalInfo.name : (isWeekend ? 'Weekend Retail Rush' : 'Daily Walk-in Sale')
      };

      db.table('invoices').insert(invoiceRecord, false);

      // Also populate invoice_items table for relational integrity
      items.forEach((it, idx) => {
        db.table('invoice_items').insert({
          id: `${invId}_item_${idx + 1}`,
          invoice_id: invId,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_amount,
          created_at: createdAt
        }, false);
      });
    }
  }

  // Update customer totals
  Object.keys(customerSpendMap).forEach(cId => {
    db.table('customers').update(cId, {
      total_spent: Math.round(customerSpendMap[cId].total),
      orders_count: customerSpendMap[cId].count
    }, false);
  });

  // 9. Generate Monthly and Operational Retail Shop Expenses across Jan to Sep 2026
  console.log('Generating comprehensive retail store expenses (Rent, ₹12k Cashier Salary, Power, Dead-stock write-offs)...');
  const expenseRecords = [];
  let expSeq = 1;

  const months = [
    { ym: '2026-01', power: 4200, freight: 2400, bags: 1800, maint: 1200, deadStock: 1450 },
    { ym: '2026-02', power: 4400, freight: 2600, bags: 1900, maint: 1100, deadStock: 1600 },
    { ym: '2026-03', power: 4900, freight: 3200, bags: 2400, maint: 1500, deadStock: 2100 }, // Holi/Ugadi surge
    { ym: '2026-04', power: 5400, freight: 2800, bags: 2100, maint: 1400, deadStock: 1750 }, // Summer cooler load
    { ym: '2026-05', power: 5800, freight: 2900, bags: 2200, maint: 1600, deadStock: 1900 }, // Peak summer power
    { ym: '2026-06', power: 5300, freight: 4200, bags: 2300, maint: 1800, deadStock: 2400 }, // Bakrid freight surge
    { ym: '2026-07', power: 4700, freight: 2700, bags: 2000, maint: 1300, deadStock: 1650 },
    { ym: '2026-08', power: 4800, freight: 3400, bags: 2500, maint: 1500, deadStock: 2200 }, // Independence & Raksha Bandhan
    { ym: '2026-09', power: 4600, freight: 3100, bags: 2400, maint: 1400, deadStock: 2500 }  // Ganesh Chaturthi & Sep stock loss
  ];

  months.forEach(m => {
    // 1st of month: Commercial Store Rent
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-01`,
      expense_date: `${m.ym}-01`,
      category: 'Rent',
      amount: 25000,
      description: `Store retail premises lease (${m.ym})`,
      payment_method: 'Bank Transfer',
      vendor: 'Shree Balaji Commercial Properties',
      logged_by: 'Store Owner'
    });

    // 2nd of month: Internet & POS Billing Cloud SaaS
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-02`,
      expense_date: `${m.ym}-02`,
      category: 'Software & Internet',
      amount: 1500,
      description: 'JioFiber Business Gigabit + Smart Merchant POS Cloud Server',
      payment_method: 'UPI',
      vendor: 'JioFiber / Cloud POS Services',
      logged_by: 'Store Owner'
    });

    // 3rd of month: Staff Salary (Cashier ₹12,000)
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-03`,
      expense_date: `${m.ym}-03`,
      category: 'Staff Salary',
      amount: 12000,
      description: `Monthly salary disbursement for Ravi Kumar (Cashier) - ₹12,000`,
      payment_method: 'Bank Transfer',
      vendor: 'Ravi Kumar (Cashier)',
      logged_by: 'Store Owner'
    });

    // 4th of month: Water & Sanitation
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-04`,
      expense_date: `${m.ym}-04`,
      category: 'Water & Utilities',
      amount: 800,
      description: 'Commercial water supply & sanitation charges',
      payment_method: 'UPI',
      vendor: 'Hyderabad Municipal Water Board',
      logged_by: 'Store Owner'
    });

    // 5th of month: Electricity & Power Bill
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-05`,
      expense_date: `${m.ym}-05`,
      category: 'Electricity',
      amount: m.power,
      description: `Store lighting, chiller cold storage & air circulation billing (${m.ym})`,
      payment_method: 'NetBanking',
      vendor: 'TSSPDCL Commercial Power Supply',
      logged_by: 'Store Owner'
    });

    // 10th of month: Packaging Materials & Carry Bags
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-10`,
      expense_date: `${m.ym}-10`,
      category: 'Packaging & Bags',
      amount: m.bags,
      description: 'Biodegradable shopping bags, billing paper rolls & packing cartons',
      payment_method: 'Cash',
      vendor: 'Sri Sai Packaging Traders',
      logged_by: 'Ravi Kumar'
    });

    // 15th of month: Wholesale Transport & Logistics Freight
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-15`,
      expense_date: `${m.ym}-15`,
      category: 'Transport & Logistics',
      amount: m.freight,
      description: 'Wholesale mandi logistics, supplier delivery freight & unloading labor',
      payment_method: 'UPI',
      vendor: 'City Cargo Express Logistics',
      logged_by: 'Store Owner'
    });

    // 20th of month: Store Maintenance & Sanitation Deep Clean
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-20`,
      expense_date: `${m.ym}-20`,
      category: 'Maintenance & Repairs',
      amount: m.maint,
      description: 'Display racks upkeep, pest control inspection & chiller coil servicing',
      payment_method: 'Cash',
      vendor: 'Apex Facility Management Services',
      logged_by: 'Store Owner'
    });

    // 28th of month: Dead Stock & Damaged Goods Loss Write-off (Expenditure that earns zero)
    expenseRecords.push({
      id: `exp_${String(expSeq++).padStart(3, '0')}`,
      store_id: storeId,
      date: `${m.ym}-28`,
      expense_date: `${m.ym}-28`,
      category: 'Dead Stock & Spoilage Write-off',
      amount: m.deadStock,
      description: `Spoiled perishable items, expired batch write-off and handling breakages for ${m.ym}`,
      payment_method: 'Internal Journal Entry',
      vendor: 'Store Inventory Loss Account',
      logged_by: 'Store Owner'
    });
  });

  expenseRecords.forEach(exp => {
    db.table('expenses').insert(exp, false);
  });

  // 10. Supply-side Stock Ledger & Demand-Driven Replenishment Walk
  console.log('Simulating demand-driven stock history, purchase orders, and inventory ledger...');
  const { transactions, purchaseOrders, finalStock, notes } = simulateStockHistory({
    products: db.table('products').find(p => p.store_id === storeId),
    invoices: db.table('invoices').find(i => i.store_id === storeId),
    suppliers: db.table('suppliers').find(s => s.store_id === storeId),
    storeId: storeId
  });

  transactions
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .forEach(t => db.table('inventory_transactions').insert(t, false));

  purchaseOrders
    .slice()
    .sort((a, b) => a.ordered_at.localeCompare(b.ordered_at) || a.id.localeCompare(b.id))
    .forEach(p => db.table('purchase_orders').insert(p, false));

  finalStock.forEach((stock, productId) => {
    db.table('products').update(productId, { stock_quantity: stock }, false);
  });

  notes.forEach(n => console.log(`   ${n}`));

  // 11. Adjust ending stock for 6 products to ensure realistic low-stock alerts
  const lowStockCandidates = ['prd_grn_04', 'prd_oil_01', 'prd_dry_03', 'prd_snk_01', 'prd_bev_01', 'prd_car_04'];
  lowStockCandidates.forEach(id => {
    const prod = db.table('products').findOne(p => p.id === id);
    if (prod) {
      const lowQty = Math.max(3, Math.min(prod.min_stock_level - 2, 8));
      db.table('products').update(id, { stock_quantity: lowQty }, false);
    }
  });

  db.save();
  console.log('========================================================');
  console.log(`✅ Seeding Complete!`);
  console.log(`   - Users: ${db.table('users').count()} (Owner + Cashier ₹12k)`);
  console.log(`   - Customers: ${db.table('customers').count()}`);
  console.log(`   - Suppliers: ${db.table('suppliers').count()}`);
  console.log(`   - Products: ${db.table('products').count()}`);
  console.log(`   - Invoices: ${db.table('invoices').count()} across 258 days`);
  console.log(`   - Expenses: ${db.table('expenses').count()} records`);
  console.log(`   - Inventory Ledger: ${db.table('inventory_transactions').count()} entries`);
  console.log(`   - Purchase Orders: ${db.table('purchase_orders').count()} orders`);
  console.log('========================================================');
}

module.exports = { seedDatabase };
