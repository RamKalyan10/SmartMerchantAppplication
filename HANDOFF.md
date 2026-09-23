# HANDOFF — Smart Merchant ML Pipeline

**Written:** 2026-09-18
**Status:** Code complete. **Nothing has been executed. Zero runtime verification.**

You are picking up a rewritten ML pipeline. The previous agent could write files but
**could not run any command that executes code** — the tooling's safety classifier was
down, so `python`, `node`, and every subprocess call were rejected. Only read-only
commands (`ls`, `cd`, `cat`, `wc`) worked.

That is the single most important fact in this document. Everything below is code that
has been reasoned about and reviewed, but never run even once. **Expect it to fail on
first execution. That is normal and expected here, not a sign something is deeply wrong.**
Your first job is to run it, read the traceback, and fix what breaks.

---

## 0. What the project is

`DWDMLab` is a "Smart Merchant" retail management app: React frontend (port 3000),
Express backend (port 5000), FastAPI ML service (port 8000). Single seeded store,
`store_dwdm_001`.

Data lives in `backend/data/merchant_db.json` (a JSON "database": `users`, `products`,
`categories`, `customers`, `suppliers`, `invoices` with nested `items[]`, `expenses`,
plus several empty tables). Real facts about it, already verified:

| | |
|---|---|
| Invoices | ~2,140, continuous daily series **2026-05-15 → 2026-09-30**, ~15/day |
| Day coverage | 139 of 139 days have sales — **there are no zero-sales days** |
| Products | 46 across 8 categories, each with real `lead_time_days` and `min_stock_level` |
| Line items | nested in `invoice.items[]`, carrying `cost_price` + `unit_price` + `quantity` → **real COGS is computable** |
| Expenses | **24 records, 7 categories, ~5 each** — very thin |
| Empty tables | `invoice_items`, `expense_categories`, `staff`, `marketing_campaigns` |

Python 3.14.3 on Windows. `python` is on PATH.

---

## 1. RUN THIS FIRST

```bash
cd ml-service
python verify_pipeline.py
```

This is the whole verification suite (~500 lines, at `ml-service/verify_pipeline.py`).
It loads the real store, rebuilds the exact payloads the backend controller builds,
drives every model, and prints PASS/FAIL per check. Non-zero exit = something failed.

**If it crashes on import or a TypeError, that is the expected first outcome.** Fix it and
re-run. Do not rewrite the script to make it pass.

### What the checks mean

| Check | Bar | What failure means |
|---|---|---|
| `walk-forward backtest ran` | folds > 0 | Not enough history for the fold logic |
| **`MASE < 1.0 (beats seasonal-naive)`** | **must pass** | **The forecaster is no better than repeating last week. This is a real failure. See §4.** |
| `lower <= point <= upper on every day` | all days | Quantile crossing — the 2.5/50/97.5 models disagree in order |
| `interval widens with horizon` | last5 > first5 | Intervals are not responding to horizon |
| **`features at origin t ignore everything after t`** | **must pass** | **Target leakage. This is the exact bug the rewrite exists to kill.** |
| `accuracy degrades when the series is shuffled` | sMAPE up ≥20% or +2pts | Leakage surviving. Weak signal — see §4. |
| `Croston selected for sparse SKUs` | ≥1 SKU | Density threshold wrong for this data |
| `sparse SKUs carry non-zero demand std` | ≥1 | The old `std=0` collapse is back |
| `every requested SKU gets a row back` | len equal | A SKU was silently dropped from output |
| `safety stock is non-zero for at least one SKU` | ≥1 | Safety stock collapsed to its floor |
| `EOQ computed where cost data exists` | ≥1 | Cost data not reaching the model |
| `classification is deterministic` | two runs equal | KMeans label assignment is non-deterministic |
| `never-sold products classified DEAD STOCK` | subset | The `999 → 0` coercion bug is back |
| `flag rate is not a fixed ~10%` | ≠ 10% | Contamination forcing is back |
| `COGS ratio came from invoice line items` | measured | `cogs_ratio` is not reaching `business_rules` |
| `sales model registered` | present | Registry write/read broken |

### Then the service-level checks

```bash
# Start the ML service (keep it running)
cd ml-service && python run.py

# In another shell:
curl http://localhost:8000/ml/metrics          # backtest MAE/RMSE/sMAPE/MASE per model
curl http://localhost:8000/health              # should report models_cached > 0
```

Then the full stack: `start_all.bat` (or `npm run start:ml`, `npm run start:backend`,
`npm run dev:frontend`). Open `http://localhost:3000`, log in, go to **Forecasting**.

---

## 2. What was built (design intent)

Six models, replacing hardcoded arithmetic and if/else thresholds.

### 2.1 Sales revenue — `app/training/sales_model.py`
Direct multi-horizon **quantile gradient boosting**. Training rows are
`(features known at t, y[t+h])` for `h ∈ 1..30`, with `horizon` as a feature. Three models
train, one per quantile (0.025 / 0.5 / 0.975) — so the prediction band is the model's own
quantiles, not a `±%` formula. Features (`app/preprocessing/features.py`): lags 1/7/14/28,
rolling mean+std 7/14/28 **all `.shift(1)`**, weekly + annual Fourier terms, payday flag,
festival flag, trend index, horizon.

### 2.2 Demand per SKU — `app/training/demand_model.py`
Two estimators, chosen per SKU by density (`DEMAND_DENSE_THRESHOLD = 0.35`):
- **Croston/SBA** for intermittent SKUs. Compound-arrival variance `Var = (1/p)·E[size²]`
  so a sparse SKU gets a non-zero σ (the old code fed three identical averages into
  `np.std` and always got 0, collapsing safety stock).
- **Pooled GBM** across all SKUs (M5-style) for dense SKUs. ~46 SKUs × 139 days ≈ 6,400
  rows, enough to learn category/price/calendar effects. `category_rate` is computed once
  in `_category_rates()` and passed to **both** training and serving — deriving it
  separately in each path was a train/serve skew bug that was caught and fixed.

### 2.3 Inventory policy — `app/recommendation/inventory_rules.py`
Periodic review (s, S): `ROP = d̄·L + z·σ·√L`, `S = d̄·(L+R) + z·σ·√(L+R)`, using each
product's **real** `lead_time_days`. EOQ computed where cost data exists, reported for
comparison only. `min_stock_level` per product is a floor. Acklam's rational
approximation gives the inverse normal CDF without a scipy dependency.

### 2.4 Catalog segmentation — `app/training/catalog_model.py`
KMeans over 6 time-normalised features (`units_per_day`, `revenue_per_day`,
`recency_days`, `velocity_trend`, `gross_margin_pct`, `active_days_ratio`), clustered on
standardised values, labels assigned by ranking centroids under a fixed sort with a
**shrinking label pool** (an earlier version produced duplicate labels; fixed).
Improvement over the old code: `days_in_inventory` was hardcoded to 30, making the
"units per month" normalisation a no-op.

### 2.5 Expense forecasting — `app/training/expense_model.py`
**Honesty problem first:** 24 records / 7 categories ≈ 5 points each. That cannot support
a seasonal time-series model. So: robust level estimation (median), Theil-Sen slope only
when the fitted change dominates the residual spread, and the **growth rate** shrunk
toward the pooled rate with `w = n/(n+k)`. Shrinking the *rate* is correct at small n;
shrinking the *level* would be wrong (rent and electricity differ genuinely). Every
category reports `n_observations`, `method`, and `baseline_strength` so the basis is visible.

### 2.6 Expense anomalies — `app/training/anomaly_model.py`
Single decision rule: **MAD-based robust z** (`0.6745·(x−median)/MAD`), **leave-one-out**
so a point never contributes to its own baseline. Detrended with Theil-Sen first when the
series has a real trend, so a rising electricity bill is not flagged monthly.
`IsolationForest` runs only when a category has ≥20 records (`ISOLATION_FOREST_MIN_N`),
with `contamination="auto"`, and is reported as **corroboration only** — it never
overrides the z-score. Reports an empirical **percentile** instead of an uncalibrated
`score_samples` magnitude.

### 2.7 Cross-cutting
- **`app/core/registry.py`** — `ModelRegistry`. Content-fingerprinted artifacts under
  `artifacts/{store_id}/`, TTL, `threading.RLock`, per-key training locks, atomic writes
  via temp + `os.replace`. Kills both the retrain-on-every-request behaviour and a
  shared-mutable-singleton race across FastAPI's threadpool.
- **`app/evaluation/{metrics,backtest}.py`** — MAE/RMSE/sMAPE/**MASE** and expanding-window
  walk-forward. Fold discipline matters: a row with origin `t` predicts `t + horizon`, so
  folds train only on rows whose **target index** strictly precedes the test window
  (`train_mask = target_idx < test_start`). Splitting on origin index would leak.
- **`app/api/routes/metrics.py`** — `GET /ml/metrics`, `POST /ml/models/refresh`.
- **`app/preprocessing/calendar.py`** — year-keyed festival table (2026 + 2027), replacing
  a hardcoded 2026-only dict that would apply 2026 lunar dates forever.

---

## 3. The honesty rules this codebase follows

These were explicit design decisions. **Do not violate them to make something look better.**

1. **Never fabricate data.** If history is insufficient, return
   `{"status": "insufficient_data", "n_available": X, "n_required": Y, "message": "..."}`.
   The original code silently generated 180 days of fake sales from a seeded RNG when it
   had <14 days of real history, and forecast off it unlabelled. That path is deleted.
2. **Never invent a confidence number.** The old `confidence: 0.91` was a hardcoded literal
   displayed as if measured. Confidence is now derived from backtest metrics via
   `confidence_from_metrics()`.
3. **Never present an assumption as a measurement.** When `cogs_ratio` is not supplied,
   `business_rules.py` applies `ASSUMED_COGS_RATIO = 0.74` **and flags it** in
   `model_info.cogs_basis = "assumed_default"`. Real line-item costs take precedence.
4. **One labelled degraded mode, not seven divergent fallbacks.** `backend/src/services/mlClient.js`
   used to reimplement every model with *different thresholds*, so the same store got
   different answers depending on whether Python happened to be running. It now returns
   `{degraded: true, method, degraded_reason}` and, for sales only, a genuine
   seasonal-naive repeat of the caller's own history.
5. **Don't tune a metric to pass.** See §4.

---

## 4. Two things you must NOT do

### 4.1 Do not tune MASE to get it under 1.0

The previous agent committed to this explicitly, in writing, to the user:

> *"Sales MASE must be < 1.0 to prove it beats seasonal-naive; if it isn't, the model isn't
> working and I'll say so rather than tune the number."*

If MASE ≥ 1.0, **report that**. Do not: add features until it drops, change the fold count,
switch the seasonality constant, widen `MIN_TRAIN_DAYS`, or swap the baseline. Those are
all ways of moving the goalposts. A GBM on 139 days of a single store's revenue can
legitimately fail to beat seasonal-naive — that is a real and reportable finding.

### 4.2 Do not trust MASE alone as a leakage signal

This is subtle and was caught during design. **Shuffling the series inflates the MASE
denominator** (the seasonal-naive error on a shuffled series is huge), so a leaked model
can score *below* 1.0 on a shuffled series without any leakage existing.

The trustworthy check is the **leakage invariance test** in §1: overwrite `y[t+1:]` with
9,999,999 and assert the feature vector at `t` is byte-identical. That is a direct test of
the property, not a proxy. `verify_pipeline.py` reports sMAPE on shuffled vs real as a
secondary signal — treat it as corroboration, not proof.

---

## 5. Known risk areas in the unverified code

Ranked by how likely I think a first-run failure is. **This is my honest self-assessment,
not a checklist of known bugs** — I could not run anything, so these are the places I would
look first when it breaks.

### HIGH — most likely to break

1. **`app/preprocessing/features.py` — `origin_features()` and `calendar_features()`.**
   These were rewritten wholesale and are called from `sales_model`, `demand_model`, and
   `verify_pipeline`. Signature drift between the three call sites is the single most likely
   first failure. In particular `origin_features(series, lags_tuple, rolls_tuple)` — confirm
   the argument order and that it returns a DataFrame whose `.iloc[origin]` is a feature row.
2. **`sales_model.build_supervised()` → `walk_forward_evaluate()` contract.**
   The backtest expects a `supervised` DataFrame with columns `origin_idx`, `horizon`, `y`
   plus the feature columns, and `fit_predict(X_train, y_train, X_test) -> np.ndarray`. Any
   mismatch in column names is a KeyError at fold time.
3. **`demand_model._pooled_rows()` / `_pooled_forecast()` feature-name parity.** The serving
   path does `frame.reindex(columns=list(feature_cols))`. If training produced a column the
   serving path does not build (or vice versa), you get silently-NaN features and a garbage
   — not crashing — forecast. **Check for NaNs, not just for exceptions.**
4. **Pandas 2.x API drift.** `groupby(...).sum()`, `.dt.normalize()`, `pd.date_range(...,
   freq="D")`, `Series.rolling(...).mean()` — written against pandas ≥2.1 but never run on
   Python 3.14 / whatever pandas actually resolves. Deprecation warnings are fine; errors are not.
5. **`app/core/registry.py` `get_or_train()`.** Closures capture `supervised`,
   `feature_cols` etc. by reference inside `trainer()`. If the fingerprint changes between
   the outer call and the lambda invocation you get a stale-frame train. Also check the
   `pickle` round-trip of a fitted `HistGradientBoostingRegressor` — sklearn models pickle
   fine, but verify.

### MEDIUM

6. **`app/training/anomaly_model.py` — the edits made today.** `z_threshold` was added as a
   new parameter with clamping to `[1.5, 6.0]`. Verify `threshold` (the local variable) is in
   scope at every use site — it replaced a module-level constant in two places
   (`is_anomaly` computation and `model_info.threshold_z`).
7. **`app/recommendation/inventory_rules.py` — `min_stock_floor`.** Added today. The floor
   logic now does `floor = store_floor; if min_stock is not None: floor = max(floor, float(min_stock))`.
   Verify every caller still works: `demand.py`, `inventory.py`, `insights.py`,
   `verify_pipeline.py`.
8. **`app/api/routes/insights.py`.** Calls three models, then `summary.setdefault("model_info",
   {}).update({...})`. If `generate_business_recommendations` ever returns no `model_info`
   key this silently creates one — probably fine, but it is string-keyed mutation of a dict
   return value, so check the merge actually happens.
9. **`app/models/schemas.py` — Pydantic v2 response models.** `ResponseBase` sets
   `model_config = ConfigDict(extra="allow")` specifically because Pydantic's default
   **silently drops** undeclared fields on a `response_model`, which is how the `tag` field
   built in the trainer used to vanish before reaching the client. Every response model must
   inherit `ResponseBase`. If you add a field to a model's output dict and it does not appear
   in the HTTP response, this is why.
10. **`expense_model._theil_sen`** is O(n²) over pairs — fine at n≈5, fine at n≈24, but a
    store with years of expenses would make this slow. Not urgent.

### LOW (but check)

11. `app/preprocessing/calendar.py` festival table — verify the 2026 dates are plausible and
    that `get_festival_info` returns the `(is_special, multiplier, label)` 3-tuple the
    sales model unpacks.
12. `verify_pipeline.py` imports `origin_features` and `build_daily_series` / `gap_stats` at
    module level. If those names were renamed, the script fails before any check runs.
13. `backend/src/services/mlClient.js` — `_degradedSales` does a seasonal-naive lookup with
    a gap-tolerant reference search. Check it does not go into an infinite loop or produce
    `NaN` when history has gaps.

---

## 6. Full file inventory

### Created
| Path | What |
|---|---|
| `ml-service/app/core/registry.py` | Fingerprinted model registry, TTL, locks, atomic writes, `preload()` |
| `ml-service/app/evaluation/metrics.py` | MAE/RMSE/sMAPE/MASE, `confidence_from_metrics()` |
| `ml-service/app/evaluation/backtest.py` | Expanding-window walk-forward, leak-free folds |
| `ml-service/app/preprocessing/calendar.py` | Year-keyed festival table (2026/2027) |
| `ml-service/app/preprocessing/series.py` | Daily series construction, zero-fill, `gap_stats` |
| `ml-service/app/training/sales_model.py` | Quantile GBM forecaster + `day_tag()` |
| `ml-service/app/training/demand_model.py` | Croston/SBA + pooled GBM |
| `ml-service/app/training/catalog_model.py` | KMeans segmentation |
| `ml-service/app/training/expense_model.py` | Robust level + shrunk growth |
| `ml-service/app/training/anomaly_model.py` | LOO MAD robust z |
| `ml-service/app/api/routes/metrics.py` | `GET /ml/metrics`, `POST /ml/models/refresh` |
| `ml-service/verify_pipeline.py` | **The verification suite** |
| `frontend/src/services/notifications.js` | Derives bell notifications from real model output |

### Rewritten
| Path | Change |
|---|---|
| `ml-service/app/training/trainer.py` | Was a 291-line `MLPipeline` singleton that retrained per request and fabricated data. Now a thin orchestrator over the registry. |
| `ml-service/app/preprocessing/features.py` | All rolling features now `.shift(1)`; added Fourier, payday, festival, horizon |
| `ml-service/app/recommendation/inventory_rules.py` | Real σ, real lead times, ROP/EOQ, `min_stock_floor` |
| `ml-service/app/recommendation/business_rules.py` | Real COGS from line items; `expense_anomaly_count` |
| `ml-service/app/recommendation/expense_rules.py` | Now a back-compat shim delegating to `expense_model` |
| `ml-service/app/api/routes/{sales,demand,inventory,expense,catalog,insights}.py` | Thin, wired to registry; hardcoded sample data removed |
| `ml-service/app/models/schemas.py` | `ResponseBase` with `extra="allow"`; additive fields |
| `ml-service/app/main.py` | Lifespan preloads registry, `reload=False`, registers metrics router, v2.0.0 |
| `ml-service/run.py` | `reload=False` |
| `backend/src/controllers/forecastController.js` | Single-pass `buildHistory`, real `days_in_inventory`, `999→0` fix, sparse per-SKU history, real COGS ratio, settings forwarding |
| `backend/src/services/mlClient.js` | One labelled degraded mode; all invented constants deleted |
| `README.md` | ML Components section rewritten; XGBoost claim removed |

### Frontend, edited today
| Path | Change |
|---|---|
| `components/Navbar.jsx` | Hardcoded fake notification array → live feed from `/forecast/insights` + `/forecast/expenses`; persisted read state |
| `pages/ForecastingPage.jsx` | Removed invented `*0.26` margin, `0.95` confidence, `±12%` labels, hardcoded `↑+` arrow, JSX-reimplemented day tags, `0 (Sufficient)`. Added days-of-cover column, degraded/insufficient banners, the previously-unrendered expense forecast panel, real evidence chips on catalog cards |
| `pages/SettingsPage.jsx` | ARIMA copy removed; 4 dead settings now wired |
| `pages/HelpSupportPage.jsx` | ARIMA/Holt-Winters/Isolation Forest answers replaced with what actually runs; diagnostics reads the `degraded` flag instead of assuming OK |
| `pages/ExpensesPage.jsx` | "ML Isolation Forest Monitored" → "ML Anomaly Scoring Active" |
| `components/LandingHeroSection.jsx` | "XGBoost ML Demand Forecast" → "Scikit-learn Demand Forecast" |
| `package.json` | `xgboost` keyword removed |
| `pages/DashboardPage.jsx` | ~14 fabricated values removed; real period-over-period growth badges; ML outage no longer blanks the dashboard. Full table in §8 item 9 |
| `pages/ProductsPage.jsx` | **Dead code** (unrouted). `min_stock_level \|\| 10` ×4 removed; added the missing "Reorder Alert Level" input |
| `pages/ProductsInventoryPage.jsx` | **The live catalog/inventory page.** `min_stock_level \|\| 10` ×9 removed; NaN stock-bar guard; edit prefill no longer invents a threshold |
| `pages/SuppliersPage.jsx` | `min_stock_level \|\| 10` ×3 removed |
| `backend/src/controllers/inventoryController.js` | `min_stock_level \|\| 10` ×2 removed; shared `isLowStock()` predicate |
| `backend/src/controllers/analyticsController.js` | `getExecutiveOverview` now measures the preceding equal-length window and returns real `*_change_pct` + `previous_period_*` fields; `min_stock_level \|\| 15` fixed |
| `backend/src/controllers/productController.js` | `parseOptionalNumber`; blank no longer becomes `10`; update normalises before merging; `low_stock` filter requires a real threshold; `lead_time_days` accepted from the body |

---

## 7. Settings that were dead and are now live

`SettingsPage` wrote four values to `localStorage['sm_merchant_settings']` that **nothing
read**. They now flow: frontend → query params → `forecastController.js` → ML service.

| Setting | Query param | Effect |
|---|---|---|
| `forecastHorizon` | — (frontend only) | Seeds the default horizon on Forecasting |
| `lowStockThreshold` | `min_stock_floor` | Raises every reorder point to at least N units |
| `anomalySensitivity` | `sensitivity` → `z_threshold` | `low`=4.5, `balanced`=3.5, `high`=2.0; clamped server-side to [1.5, 6.0] |
| `enableRestockSuggestions` | — (frontend only) | Hides the reorder columns |

**Watch out:** `lowStockThreshold` defaults to `15`. If a user opens Settings and saves
without clearing it, every SKU under 15 units moves from Adequate to Low Stock. That is
arithmetic, not a bug, but it will look alarming. Setting it to `0` disables the floor.

**Also note:** `ForecastingPage.jsx` reads `sm_merchant_settings` from `localStorage` at mount
(`savedSettings` at line 38, `useState` initialisers for `forecastDays` and
`showRestockSuggestions`). Changing a setting on the Settings page therefore takes effect after
a **page reload**, not live. If you want it live, lift the settings into a context or add a
`storage` event listener — but do not simply move the read outside the initialisers, because
`fetchMLPredictions` closes over `savedSettings` and would re-fetch on every render.

---

## 8. Remaining work, in order

1. **Run `verify_pipeline.py`.** Fix what breaks. Repeat until it runs to completion.
2. **Check MASE.** Report the real number. See §4.1 — do not tune it.
3. **Confirm the leakage invariance test passes.** This is the point of the whole rewrite.
4. **Start all three services** and walk the Forecasting page end to end: sales chart,
   demand table, catalog cards, expense anomalies, the expense forecast panel.
5. **Kill the ML service** (`Ctrl-C` on port 8000) and reload Forecasting. Confirm the
   amber "ML service unreachable — these are fallback estimates" banner appears and that
   no fabricated constants reappear in the UI or in `mlClient.js`.
6. **Verify `/ml/metrics`** returns real backtest numbers.
7. **Check `GET /api/forecast/insights`** returns `anomalies_detected` as a real count
   (it was hardcoded `0` until today).
8. **Frontend build check:** `cd frontend && npm run build`. Nothing in the frontend has
   been compiled — the edits today were made blind.
9. ~~**Review `AnalyticsPage.jsx`, `DashboardPage.jsx`, `InventoryPage.jsx`, `ProductsPage.jsx`**~~
   **DONE — no longer needs doing.** All four were audited. `AnalyticsPage.jsx` and
   `InventoryPage.jsx` were clean (their `|| 0` uses are CSV number formatting, not invented
   display values; neither references the ML service). `DashboardPage.jsx` and `ProductsPage.jsx`
   carried ~14 fabricated values between them — all removed. What was found and changed:

   | Where | Was | Now |
   |---|---|---|
   | `DashboardPage` stat cards | `12.5%` / `5.2%` / `18.3%` hardcoded growth badges | New `<ChangeBadge>` fed by real `revenue_change_pct` / `expense_change_pct` / `profit_change_pct` from `getExecutiveOverview`, which now measures the preceding equal-length window. Renders **nothing** when there is no predecessor or an empty one — it does not show `0%` or `+Inf%`. |
   | `DashboardPage` stat card | `?? 496` invoices | `?? 0` |
   | `DashboardPage` stat card | "Optimal" badge, unconditional | Conditional on the real `low_stock_alerts`; `—` when the overview has not loaded |
   | `DashboardPage` Net Profit | "Profitable / Revenue exceeds expenses", unconditional | "At a Loss / Expenses exceed revenue" when net profit is negative |
   | `DashboardPage` tiles | `'₹26,480'`, `'on Sep 2'`, `'₹12,350'`, `'on Aug 28'`, `avgDailyRevenue \|\| 9784`, `avgDailyExpense \|\| 1040` | `—` / "no sales in period" when the timeline is empty |
   | `DashboardPage` donut | Fallback slice `[{name:'Rent', value:10500}]`, `total_expense \|\| 31200` | "No expenses recorded in this period." and a `0` total |
   | `DashboardPage` donut caption | `Rent and Staff Salary account for X%` with a `'76.6'` fallback | Names the **actual** top two categories from `category_breakdown`, and hides the caption when there are fewer than two |
   | `DashboardPage` AI card | `'Demand for rice and dal is expected to increase by 18%…'` | Honest unavailable-state copy. This fallback fired exactly when the ML service was down — the worst moment to print a prediction. |
   | `DashboardPage` greeting | `'Rajesh'` when the account has no name | Greets without a name |
   | `DashboardPage` fetch | `Promise.all` over seven calls | The `/forecast/insights` call is now `.catch(() => ({data:null}))`, so **an ML outage no longer blanks the entire dashboard** — this was the actual behaviour behind §8 item 5 |
   | `ProductsPage` | `min_stock_level \|\| 10` in the edit prefill and three comparison sites | Comparison sites require a real threshold (`!= null`); prefill uses `?? ''` |
   | `ProductsPage` form | **No input existed for `min_stock_level` at all** — every product saved through the UI was written with a hardcoded `10`, and the merchant could not set their own | Added a "Reorder Alert Level" field, blank by default |
   | `ProductsInventoryPage` | `min_stock_level \|\| 10` ×9 (comparison sites, KPI count, threshold labels) | New `hasBreachedThreshold()` / `thresholdLabel()` helpers at the top of the file; unfetched counts fall back honestly |
   | `ProductsInventoryPage` | Edit prefill `p.min_stock_level \|\| 10`; input coerced blank to `0` so "no threshold" was unexpressible | Prefill `?? ''`; the raw string is submitted and the backend maps blank → `null` |
   | `ProductsInventoryPage` | `item.min_stock_level * 3` → `NaN` when the threshold is absent, so the stock bar width became `NaN%` | Guarded |
   | `SuppliersPage` | `min_stock_level \|\| 10` ×3 | Requires a real threshold |
   | `inventoryController.js` | `min_stock_level \|\| 10` ×2 — a **third** constant, disagreeing with `analyticsController`'s `15` and `productController`'s `10` | Shared `isLowStock()` predicate, matching the other two controllers |
   | `productController.js` | `Number(min_stock_level) \|\| 10` on create (so an explicit `0` became `10`); `req.body` verbatim on update (so a blank field erased the stored value); `\|\| 10` in the `low_stock` filter | New `parseOptionalNumber` helper: blank → `null` ("no alert level"), explicit `0` preserved. Update normalises before merging. Filter requires a real threshold. |
   | `productController.js` | `lead_time_days: 3` hardcoded on create | Accepted from the body when positive, else 3. The inventory model uses this for the reorder point, so every new product was silently getting 3 days. |
   | `analyticsController.js:78` | `min_stock_level \|\| 15` | `!= null` — the same invented-threshold bug as `DashboardPage`, with a *different* constant |

   **Two pages in `frontend/src/pages/` are dead code — do not spend time on them:**
   `ProductsPage.jsx` and `InventoryPage.jsx` are imported by nothing. `App.jsx` routes both the
   `products` (catalog) and `inventory` tabs to **`ProductsInventoryPage.jsx`**. This was not
   obvious: `ProductsPage.jsx` is a near-duplicate of the live page and greps identically. Check
   `App.jsx`'s import list before editing either. (`ProductsPage.jsx` was still corrected above,
   since it is one `import` away from being live, but the live-page fixes are the ones that matter.)

---

## 9. Debugging notes

- **Registry caching.** Artifacts persist to `ml-service/artifacts/{store_id}/*.pkl` with a
  24h TTL (`MODEL_TTL_HOURS`). If a model behaves as if it is using old data, the fingerprint
  did not change. Delete `ml-service/artifacts/` or `POST /ml/models/refresh?store_id=...`
  to force a retrain.
- **Fingerprints** are `hash(store_id, n_days, last_date, round(sum, 2))`. Any change to the
  underlying series must move the fingerprint or you get a stale cached model.
- **`fastapi` sync `def` endpoints run in a threadpool.** That is why the registry uses
  `RLock` and per-key training locks. If you add a module-level singleton anywhere, it now
  has the same race the old `trainer.py` had.
- **Thresholds worth knowing about** (all in `app/config.py`):
  `MIN_SALES_HISTORY_DAYS=28`, `MIN_DEMAND_OBSERVATIONS=7`, `MIN_EXPENSE_OBSERVATIONS=6`,
  `MIN_ANOMALY_OBSERVATIONS=5`, `ISOLATION_FOREST_MIN_N=20`, `DEMAND_DENSE_THRESHOLD=0.35`,
  `BACKTEST_FOLDS=4`, `MIN_TRAIN_DAYS=21`, `SALES_HORIZON=30`.
  `MIN_ANOMALY_OBSERVATIONS` was lowered from 8 to 5 **because 8 would have disabled anomaly
  detection entirely on this store** (5–6 records per category). Four is the leave-one-out
  MAD floor. Do not raise it back without checking the category counts.
- **The real sales minimum is 29 days, not 28.** `min_sales_days()` in `trainer.py` returns
  `max(MIN_SALES_HISTORY_DAYS, max(SALES_LAGS) + 1)` — the longest lag (28) needs a value 28
  days behind the origin.

---

## 10. Ground rules for whoever picks this up

1. **Never fabricate data to fill a gap.** Return `insufficient_data` and say why.
2. **Never invent a metric.** If it isn't measured, show `—` or omit it. Don't put a
   plausible-looking default in a fallback branch.
3. **Never claim a technology the code doesn't use.** This codebase had XGBoost, ARIMA,
   Holt-Winters and Isolation Forest advertised across nine files while xgboost was never
   imported and ARIMA never existed. Every one of those claims has now been corrected —
   **do not reintroduce them.**
4. **Never show a hardcoded number as if it were a running total.** The notification bell
   announced a ₹4,500 freight anomaly that existed in no table.
5. **If something fails, say it failed.** The value of this work is that the numbers are
   traceable to real invoices. A wrong-but-confident number is worse than an explicit error.
