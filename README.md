# Smart Merchant 🚀
### Enterprise Full-Stack AI Merchant Management, POS & Predictive Business Intelligence Platform

[![Vercel Deployment](https://img.shields.io/badge/Frontend-Vercel%20Live-brightgreen?logo=vercel&style=for-the-badge)](https://smart-merchant-appplication.vercel.app/)
[![Render API](https://img.shields.io/badge/Backend-Render%20Live-blue?logo=render&style=for-the-badge)](https://smart-merchant-appplication.onrender.com/api/health)
[![Supabase Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&style=for-the-badge)](https://supabase.com)
[![Firebase Auth](https://img.shields.io/badge/Auth-Firebase%20%2B%20JWT-FFA611?logo=firebase&style=for-the-badge)](https://firebase.google.com/)
[![Machine Learning](https://img.shields.io/badge/ML%20Engine-Scikit--learn%20%2B%20FastAPI-F7931E?logo=scikit-learn&style=for-the-badge)](https://scikit-learn.org/)

**Smart Merchant** is an end-to-end retail and business intelligence platform designed for small and medium-sized enterprises (SMEs). It unites real-time POS operations, automated multi-level inventory tracking, financial ledger management, and forward-looking AI demand forecasting into a single cohesive interface.

---

## 🌐 Live Cloud Deployments

| Component | Platform | Live URL / Endpoint | Status |
|---|---|---|---|
| **Web Application** | Vercel | [https://smart-merchant-appplication.vercel.app](https://smart-merchant-appplication.vercel.app) | 🟢 Live & Operational |
| **REST Backend API** | Render | [https://smart-merchant-appplication.onrender.com/api](https://smart-merchant-appplication.onrender.com/api/health) | 🟢 Live (Cloudflare Protected) |
| **Relational Database** | Supabase | PostgreSQL 16 (IPv4 Transaction & Session Pooler) | 🟢 Active |
| **Authentication** | Firebase & Backend | Google OAuth, Phone OTP, Email/Password & 6-Digit SMTP OTP | 🟢 Operational |

---

## 🏗️ Monorepo Architecture

The repository is organized into distinct application layers:

```
DWDMLab/
├── app/                  # Mobile Application subsystem (iOS / Android / Flutter / React Native)
├── frontend/             # React 18 + Vite + Tailwind CSS + Lucide + Recharts (Vercel Root)
├── backend/              # Express.js REST API + PostgreSQL Pooler + JWT Auth + RBAC (Render Root)
├── ml-service/           # Python 3.10+ FastAPI + Scikit-Learn Predictive Pipeline
├── diagnose.py           # Multi-target data and financial consistency diagnostic tool
├── HANDOFF.md            # Comprehensive architecture, credential guide & system state
├── package.json          # Root monorepo orchestrator
├── setup.bat             # One-click multi-environment dependency installer
└── start_all.bat         # Concurrent local development runner (all subsystems)
```

---

## 🌟 Key Platform Capabilities

### 1. High-Speed Point of Sale (POS) & Invoicing
- Instant GST-compliant invoice generation with itemized tax calculations.
- Automatic inventory depletion and real-time transaction ledger creation.
- Direct customer PDF and digital summary delivery via WhatsApp and Email.

### 2. AI & Machine Learning Predictive Analytics
- **Sales Volume Projections:** Quantile Gradient Boosting regression for 7-day, 14-day, and 30-day horizons.
- **Demand Forecasting:** Croston intermittent demand and pooled regression to predict stockout velocity.
- **Automated Reorder Recommendations:** Calculates Safety Stock, Lead Time Buffer, and Economic Order Quantities (EOQ).
- **Product Classification:** Unsupervised KMeans clustering for customer segmentation and product velocity tiers.

### 3. Inventory & Supplier Lifecycle Management
- Multi-warehouse stock tracking with critical low-stock threshold alerts.
- Purchase order management with supplier fulfillment status and batch tracking.
- Per-unit COGS (Cost of Goods Sold) calculations ensuring authentic profit margins.

### 4. Comprehensive Customer Relationship Management (CRM)
- Customer profiles with transaction histories, purchase frequency, and lifetime spend.
- **Installment & Partial Repayments:** Directly record customer repayments, auto-allocate across oldest unpaid invoices (FIFO) or specific invoices, and update ledger balances.
- **Instant Branded Receipts & WhatsApp Delivery:** Generate official repayment receipts (`REC-...`) and share receipts directly to customer WhatsApp with one click.
- **Invoice Status Lifecycle:** Supports `PAID`, `PARTIAL`, and `PENDING/UNPAID` statuses with live balance tracking.

### 5. Multi-Provider Enterprise Authentication & RBAC
- **Google OAuth Sign-In:** Native Firebase popup integration.
- **Email & Password Authentication:** Argon2/Bcrypt hash verification with custom JWT issued per store partition.
- **6-Digit Email OTP:** Integrated with Gmail SMTP (`nodemailer`) for passwordless recovery.
- **Role-Based Access Control (RBAC):** Strict permissions dividing `Owner`, `Admin`, `Manager`, and `Staff` access tiers.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **Python:** v3.9+ (with `pip`)
- **Git**

### Installation

Clone the repository and install all dependencies in one command:

```bash
# Clone repository
git clone https://github.com/RamKalyan10/SmartMerchantAppplication.git
cd SmartMerchantAppplication

# Windows automated setup
setup.bat
```

*Or manually install each service:*
```bash
# 1. Backend
cd website/backend && npm install

# 2. Frontend
cd ../frontend && npm install

# 3. ML Service (Optional for local inference)
cd ../ml-service && pip install -r requirements.txt
```

### Running Locally

Launch all subsystems concurrently:
```bash
start_all.bat
```

Services will be accessible at:
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:5000/api](http://localhost:5000/api)
- **ML Intelligence Server:** [http://localhost:8000](http://localhost:8000)

---

## 🔒 Security & Environment Variables

All sensitive credentials and database connection strings are managed securely via environment files (`.env`) and are excluded from version control via `.gitignore`. 

Refer to `website/backend/.env.example` and `website/frontend/.env.example` for environment variable templates.

---

## 👨‍💻 Author & Maintainer

**Thirandi Ram kalyan**  
Smart Merchant Platform Architecture & Development
