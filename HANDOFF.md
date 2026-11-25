# HANDOFF — Smart Merchant Full-Stack Platform

**Last Updated:** 2026-11-25  
**Maintainer:** Thirandi Ram kalyan  
**Platform Status:** Fully Implemented, Verified & Deployed Live in Production  

---

## 1. Executive Summary & Live Deployments

Smart Merchant has transitioned from an initial prototype to a fully verified, production-grade cloud application deployed across modern managed infrastructure:

- **Web Application (Vercel):** [https://smart-merchant-appplication.vercel.app](https://smart-merchant-appplication.vercel.app)
- **Backend API (Render Web Service):** [https://smart-merchant-appplication.onrender.com/api](https://smart-merchant-appplication.onrender.com/api/health)
- **Database Engine (Supabase PostgreSQL):** Hosted on AWS `ap-northeast-2` with IPv4 session & transaction pooling.
- **Authentication Providers (Firebase & Backend):** Google Sign-In, Email/Password, 6-Digit Email OTP, and SMS Phone OTP.

---

## 2. Monorepo Repository Structure

The codebase is organized into dedicated subsystem directories:

```
DWDMLab/
├── app/                  # Mobile Application layer (iOS / Android / Flutter / React Native)
│   └── .gitkeep
├── website/              # Full Web Application and Services
│   ├── backend/          # Node.js + Express REST API Server
│   │   ├── src/          # Controllers, routes, middleware, and database adapters
│   │   ├── .env          # Backend environment configuration (git ignored)
│   │   └── package.json
│   ├── frontend/         # React 18 + Vite + Tailwind CSS Single Page Application
│   │   ├── src/          # Pages, components, contexts (Auth, Theme, Toast), and services
│   │   ├── .env          # Frontend configuration pointing to cloud API (git ignored)
│   │   └── vite.config.js
│   └── ml-service/       # Python 3.10+ Machine Learning Predictive Engine
│       ├── api/          # FastAPI inference endpoints
│       ├── models/       # Scikit-learn serialized models (.joblib)
│       └── prediction/   # Pipeline forecasting modules
├── diagnose.py           # Diagnostic script for database and financial integrity
├── HANDOFF.md            # This document
├── package.json          # Root monorepo script coordinator
├── setup.bat             # Automated multi-service dependency installer
└── start_all.bat         # Concurrent local development runner
```

---

## 3. Database Architecture & Seeded Data State

### Database Engine: Supabase PostgreSQL 16
The database is accessed via connection pooling:
- **Connection Host:** `aws-1-ap-northeast-2.pooler.supabase.com:5432`
- **SSL:** Enabled (`PGSSL=true`)

### Live Production Records (as of November 2026):
| Table | Records | Details |
|---|---|---|
| `users` | 2 | Store Owner (`tramkalyanrahul@gmail.com`) + Staff accounts |
| `categories` | 8 | Packaged Foods, Beverages, Dairy, Personal Care, Household, Spices, Staples, Snacks |
| `products` | 88 | Comprehensive retail product catalog with active barcodes and stock levels |
| `invoices` | 7,862 | Daily transactions covering **2026-01-01 through 2026-11-25** |
| `customers` | 5 | CRM profiles with customer purchase frequency and pending dues |
| `suppliers` | 5 | Commercial vendor records with contact details and purchase orders |
| `expenses` | ~300 | Categorized operating costs (Rent, Salaries, Utilities, Logistics) |

---

## 4. Authentication Architecture & Verified Credentials

### Default Owner Account:
- **Email:** `tramkalyanrahul@gmail.com`
- **Role:** `Owner`
- **Store Partition ID:** `store_3ARkiW0rCQPuLIFNCalRLrMcOjn1`
- **Password:** Verified with Bcrypt

### Multi-Provider Authentication Flow:
1. **Backend PostgreSQL + Custom JWT:**
   - Validates credentials against the PostgreSQL `users` table.
   - Generates signed JWT (`HS256`, 7-day expiry) containing `store_id`, `role`, and `user_id`.
2. **Google OAuth (Firebase Auth):**
   - Whitelisted domain: `smart-merchant-appplication.vercel.app`.
   - Automatic account synchronization with the backend via `/api/auth/firebase-sync`.
3. **6-Digit Email OTP:**
   - Powered by Nodemailer connected to Gmail SMTP (`tramkalyanrahul@gmail.com`).
   - Secure numeric OTP generation with 10-minute validity.

---

## 5. Machine Learning Models & Capabilities

The ML service (`website/ml-service`) provides real-time predictive intelligence:
- **Sales Volume Projections:** Linear Regression & Quantile GBM (`sales_model.joblib`).
- **Demand Forecasting:** KNN Regression & Croston intermittent demand model (`demand_model.joblib`).
- **Catalog Velocity Classification:** Decision Tree Classifier (`catalog_model.joblib`).
- **Inventory Stockout Prediction:** Logistic Regression (`inventory_model.joblib`).
- **Operating Expense Regression:** Multiple linear regression with seasonality (`expense_model.joblib`).
- **Customer Segmentation:** K-Means clustering for customer RFM analysis (`clustering_model.joblib`).

---

## 6. Cloud Deployment Instructions

### Vercel (Frontend SPA):
- **Framework Preset:** Vite
- **Root Directory:** `website/frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_URL=https://smart-merchant-appplication.onrender.com/api`

### Render (Backend Web Service):
- **Environment:** Node.js
- **Root Directory:** `website/backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `PORT=5000`
  - `NODE_ENV=production`
  - `DATABASE_URL=postgresql://...`
  - `PGSSL=true`
  - `JWT_SECRET=...`
  - `GMAIL_USER=...`
  - `GMAIL_APP_PASSWORD=...`

---

## 7. Verification Checklist

- [x] All 7,862 invoices and transaction records seeded and verified in PostgreSQL.
- [x] Backend API responsive and healthy on Render cloud hosting.
- [x] Frontend successfully built and deployed on Vercel.
- [x] Customer card layouts optimized with clean non-overlapping grids.
- [x] BaseURL self-healing active for both local and production environments.
- [x] All credentials safely stored in `.env` and excluded from git version control.
