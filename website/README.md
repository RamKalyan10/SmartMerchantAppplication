# Smart Merchant 🚀
### Full-Stack AI-Powered Merchant Management & Business Intelligence Platform

Smart Merchant bridges the gap between everyday business operations and forward-looking data science for small and medium-sized enterprises (SMEs).

```
Business Operations → Data/Analytics → ML Predictions → Actionable Business Decisions
```

Instead of using disparate notebooks for sales, Excel for expenses, separate billing software, and intuition for replenishment, Smart Merchant unifies the entire lifecycle into a single proactive platform.

---

## 🌟 The Core Story & Innovation

| Question | Traditional POS / Software | Smart Merchant (AI Engine) |
|---|---|---|
| **What happened?** | "We sold 150 bags of rice last month." | Aggregates real-time sales, category turnover, and cashflow. |
| **What is likely to happen?** | *Manual guessing / blind intuition* | **"Demand for rice is projected at 180 units next week (+22% spike)."** |
| **What should I do?** | *Reactive when stock runs out* | **"Current stock (60) is insufficient. Recommended purchase: 120 units before lead time."** |

---

## 🏗️ Architecture & Pipeline

```
                    MERCHANT
                       │
                       ▼
              ┌─────────────────┐
              │   React + Vite  │ (Glassmorphic Dark Dashboard, POS, Recharts)
              └────────┬────────┘
                       │ REST API
                       ▼
              ┌─────────────────┐
              │  Node / Express │ (Business Rules, Invoicing, Stock Depletion, RBAC)
              └────────┬────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
 ┌──────────────┐              ┌──────────────┐
 │  PostgreSQL  │              │   FastAPI    │
 │   Database   │◄─────────────┤  ML Service  │
 └──────────────┘ Data Extract └──────┬───────┘
                                      │
                                      ▼
                        ┌────────────────────────────────────────┐
                        │ Machine Learning Models                │
                        │ • Sales Forecast (quantile GBM)        │
                        │ • Demand Velocity (pooled GBM/Croston) │
                        │ • Catalog Classifier (KMeans)          │
                        │ • Expense Anomaly (robust MAD z-score) │
                        │ • Reorder & Safety Stock ((s, S) + EOQ)│
                        │ • Profit Projections (real COGS)       │
                        └────────────────────────────────────────┘
```

---

## 🧠 Machine Learning Components

Every model below is trained on the store's own invoice and expense history. When a store does not yet have enough history for a model, the API returns an explicit `insufficient_data` payload naming the shortfall (`n_available` / `n_required`) — no endpoint fabricates data to have something to predict from.

1. **Sales Revenue Forecasting** (`/ml/sales/predict`):
   - **Direct multi-horizon quantile gradient boosting** — one model per quantile (0.025 / 0.5 / 0.975) with `horizon` as an input feature. Every horizon is predicted from *observed* history, so multi-step error does not compound the way a recursive model's does.
   - Features: lags (1/7/14/28), rolling mean and standard deviation (7/14/28) — all shifted so no feature can contain the value being predicted — weekly and annual Fourier harmonics, day-of-week and payday flags, and a year-keyed Indian festival calendar.
   - The 95% prediction interval is read directly off the outer quantile models, so the bounds widen with horizon because the model says so, not because a formula was applied.
2. **Product Demand Prediction** (`/ml/demand/predict`):
   - Per-SKU method selection by sales density. **Croston with the Syntetos-Boylan correction** for intermittent SKUs (the standard treatment when a product sells on a minority of days), and a **pooled global gradient boosting model** across all SKUs for dense ones — pooling is what makes per-SKU learning viable at ~139 days of history.
   - Returns a genuine dispersion estimate per SKU, which the safety-stock calculation depends on.
3. **Inventory Reorder & Safety Stock Engine** (`/ml/inventory/recommend`):
   - Periodic-review **(s, S)** policy: $s = \bar{d}L + z\sigma\sqrt{L}$ and $S = \bar{d}(L+R) + z\sigma\sqrt{L+R}$, using each product's real `lead_time_days` and respecting `min_stock_level` as a floor.
   - **EOQ** ($\sqrt{2DS/H}$) is reported alongside as a cost-optimal lot size for comparison, deliberately kept separate from the (s, S) quantity.
   - Classifies each line as Out of Stock / Critical Shortage / Low Stock / Adequate / Overstocked from the calculated reorder point.
4. **Catalog Requirement Classification** (`/ml/catalog/classify`):
   - **KMeans** over time-normalised features measured from invoices: units per day, revenue per day, gross margin, recency, 28-day-over-28-day velocity trend, and active-day ratio.
   - Clusters are ranked by a composite vitality score and mapped to `HIGH DEMAND` / `MEDIUM DEMAND` / `LOW DEMAND` / `SLOW MOVING` / `DEAD STOCK`, with a recency gate so an actively-selling SKU can never be labelled dead stock. Deterministic (fixed `random_state`), and a label may legitimately go unused if no segment matches it.
5. **Expense Anomaly Detection** (`/ml/expense/anomalies`):
   - **Leave-one-out MAD robust z-score** ($z = 0.6745(x - \text{median})/\text{MAD}$), so a point never contributes to its own baseline and the very outliers being tested cannot inflate the spread. Series with a real trend are detrended first, so a gradually rising electricity bill is not flagged every month.
   - Isolation Forest runs only when a category has ≥20 observations, with `contamination="auto"`, and is reported as corroboration that never overrides the z-score.
   - The flag rate is a *result*, not a setting: it depends on how far each value sits from its category's own median.
6. **Expense Forecasting** (`/ml/expense/predict`):
   - At ~5 observations per category the honest approach is robust estimation: recurring costs are carried forward, variable costs get a Theil-Sen slope only when the fitted change dominates the residual spread, and the estimated **growth rate is shrunk toward the pooled rate** in proportion to sample size ($w = n/(n+k)$).
   - Each category reports its `n_observations`, `method`, and a `baseline_strength` of strong / moderate / **weak**.
7. **Profit Prediction & Executive Insights** (`/ml/insights/summary`):
   - COGS is computed from the **real `cost_price` × `quantity` on each invoice line item**. When a store has no line-item costs the fallback ratio is applied *and flagged* in `model_info.cogs_basis` as `assumed_default`, so it is never presented as measured.
   - Synthesises sales projections, stockout risk, overstock, and expense anomalies into prioritised recommendations.

### Evaluation and honesty

- **Walk-forward (expanding window) backtesting** with leak-free fold boundaries: because the model is direct multi-horizon, each fold trains only on rows whose *target index* precedes the test window.
- **MASE against a seasonal-naive baseline** is the primary metric — `MASE < 1.0` means the model beats the naive benchmark on that store's data. Backtest MAE / RMSE / sMAPE / MASE are persisted with each model and exposed at **`GET /ml/metrics`**, alongside `trained_at`, `n_samples`, and library versions.
- **`confidence` is derived from those backtest metrics**, not hardcoded — a model that fails to beat seasonal-naive reports a low score rather than a confident-looking one.
- Models are cached per store in a **content-addressed registry** (fingerprint of the data, TTL, atomic writes, per-key training locks), so training happens once per data change rather than once per request.
- Every response carries a `model_info` block describing its own basis.
- If the Python service is unreachable, the Node backend returns a **labelled** degraded response (`degraded: true`, `method`) instead of silently substituting different numbers. Sales falls back to seasonal-naive computed from the caller's real history; the models that cannot be honestly approximated return an empty result marked `Unavailable`.

---

## 💻 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js, Express, JWT Authentication, Role-Based Access Control (RBAC)
- **Database**: PostgreSQL / Relational Schema Storage Engine with auto-seeding
- **Machine Learning**: Python 3.10+, FastAPI, Scikit-learn, Pandas, NumPy, Uvicorn

---

## 🚀 Quick Start Guide

### 1. Start the Python ML Service
```bash
cd ml-service
pip install -r requirements.txt
python run.py
```
> The FastAPI ML Service will start on `http://localhost:8000`. Models are trained on demand from your real store history and cached in `ml-service/artifacts/`; inspect what was trained and how accurately it backtested at `http://localhost:8000/ml/metrics`.

### 2. Start the Node.js Backend API
```bash
cd backend
npm install
npm start
```
> The Express API will start on `http://localhost:5000/api` and seed the database with realistic merchant enterprise data.

### 3. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
> Access the web dashboard at `http://localhost:3000`.

---

## 👥 Role-Based Access Control (RBAC)

The system comes pre-configured with 4 granular roles:
- **Owner**: Full system access, net profit margins, financial forecasting, and staff role assignment.
- **Admin**: Product catalog management, inventory control, and customer directory.
- **Manager**: Inventory stock adjustments, warehouse restocks, and operational expense logging.
- **Staff**: POS Invoice generation and product catalog lookup.

*Use the **Simulate Role (RBAC)** dropdown in the top navbar to instantly test and showcase role permissions in real-time.*
