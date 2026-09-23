"""End-to-end verification of the rewritten ML pipeline.

Run from ``ml-service``::

    python verify_pipeline.py

Loads the real seeded store from ``backend/data/merchant_db.json``, drives
every model with exactly the payload the backend controller builds, and reports
what each model actually learned. Prints PASS/FAIL per check and exits non-zero
if any check fails.

The two checks worth understanding:

* **Leakage invariance.** The supervised features at origin ``t`` must be a
  function of ``y[:t]`` alone. This is verified directly by overwriting
  everything *after* ``t`` with garbage and confirming the feature vector is
  byte-identical. A shuffle test is reported alongside, but it is a weaker
  signal — permuting the series also inflates the MASE denominator, so a
  shuffled run can score below 1.0 without any leakage existing.
* **MASE < 1.0.** The model must beat seasonal-naive on this store's own data.
  If it does not, the model is not working and this script says so.
"""

import json
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.registry import get_registry  # noqa: E402
from app.preprocessing.features import origin_features  # noqa: E402
from app.preprocessing.series import build_daily_series, gap_stats  # noqa: E402
from app.recommendation.inventory_rules import compute_inventory_recommendations  # noqa: E402
from app.training import anomaly_model, catalog_model, demand_model  # noqa: E402
from app.training import sales_model  # noqa: E402
from app.training.trainer import classify_catalog, forecast_expenses, predict_sales  # noqa: E402

STORE = "store_dwdm_001"
DB_PATH = Path(__file__).resolve().parent.parent / "backend" / "data" / "merchant_db.json"
MS_PER_DAY = 86400000

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")


def fmt(value, places=2):
    if value is None:
        return "n/a"
    try:
        return f"{float(value):.{places}f}"
    except (TypeError, ValueError):
        return str(value)


# ---------------------------------------------------------------------------
# Load the real store and rebuild the controller's payloads
# ---------------------------------------------------------------------------


def load_store():
    with open(DB_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def day_key(value):
    if not value:
        return None
    text = str(value)
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return None


def build_history(db):
    invoices = [i for i in db["invoices"] if i.get("store_id") == STORE]
    today = pd.Timestamp.now().normalize().strftime("%Y-%m-%d")

    daily = {}
    sku_daily = {}
    sku_stats = {}
    line_revenue = 0.0
    line_cost = 0.0

    for invoice in invoices:
        key = day_key(invoice.get("date"))
        if not key:
            continue
        entry = daily.setdefault(key, {"date": key, "amount": 0.0, "order_count": 0, "quantity": 0.0})
        entry["amount"] += float(invoice.get("total_amount") or 0)
        entry["order_count"] += 1

        for item in invoice.get("items") or []:
            pid = item.get("product_id")
            if not pid:
                continue
            qty = float(item.get("quantity") or 0)
            price = float(item.get("unit_price") or 0)
            cost = float(item.get("cost_price") or 0)
            line_total = float(item.get("total_amount") if item.get("total_amount") is not None else price * qty)

            entry["quantity"] += qty
            sku_daily.setdefault(pid, {})
            sku_daily[pid][key] = sku_daily[pid].get(key, 0.0) + qty

            stats = sku_stats.setdefault(pid, {"units": 0.0, "revenue": 0.0, "cost": 0.0, "last": None})
            stats["units"] += qty
            stats["revenue"] += line_total
            stats["cost"] += cost * qty
            if stats["last"] is None or key > stats["last"]:
                stats["last"] = key

            line_revenue += line_total
            line_cost += cost * qty

    keys = sorted(daily)
    first_key = keys[0] if keys else None
    observed_last = keys[-1] if keys else None
    end_key = observed_last if (observed_last and observed_last > today) else today

    span = 0
    if first_key:
        span = (pd.Timestamp(end_key) - pd.Timestamp(first_key)).days + 1

    return {
        "invoices": invoices,
        "daily": daily,
        "sku_daily": sku_daily,
        "sku_stats": sku_stats,
        "first_key": first_key,
        "end_key": end_key,
        "observation_days": span,
        "cogs_ratio": (line_cost / line_revenue) if line_revenue > 0 else None,
    }


def complete_series(history):
    out = []
    start = pd.Timestamp(history["first_key"])
    end = pd.Timestamp(history["end_key"])
    for stamp in pd.date_range(start, end, freq="D"):
        key = stamp.strftime("%Y-%m-%d")
        row = history["daily"].get(key)
        out.append(dict(row) if row else {"date": key, "amount": 0.0, "order_count": 0, "quantity": 0.0})
    return out


def window_units(sku_map, end_key, offset, span):
    if not sku_map:
        return 0.0
    end = pd.Timestamp(end_key)
    total = 0.0
    for step in range(span):
        key = (end - pd.Timedelta(days=offset + step)).strftime("%Y-%m-%d")
        total += sku_map.get(key, 0.0)
    return total


def demand_items(db, history):
    items = []
    for prod in [p for p in db["products"] if p.get("store_id") == STORE]:
        sku_map = history["sku_daily"].get(prod["id"])
        sparse = (
            [{"date": d, "units": u} for d, u in sorted(sku_map.items()) if u > 0]
            if sku_map
            else []
        )
        items.append(
            {
                "product_id": prod["id"],
                "product_name": prod.get("name"),
                "category": prod.get("category_name") or "General",
                "current_stock": float(prod.get("stock_quantity") or 0),
                "unit_price": float(prod.get("selling_price") or 0),
                "cost_price": float(prod["cost_price"]) if prod.get("cost_price") is not None else None,
                "lead_time_days": prod.get("lead_time_days") or 3,
                "min_stock_level": prod.get("min_stock_level"),
                "sales_history": sparse,
            }
        )
    return items


def catalog_items(db, history):
    rows = []
    for prod in [p for p in db["products"] if p.get("store_id") == STORE]:
        stats = history["sku_stats"].get(prod["id"], {"units": 0.0, "revenue": 0.0, "last": None})
        sku_map = history["sku_daily"].get(prod["id"])
        recency = None
        if stats["last"]:
            recency = (pd.Timestamp(history["end_key"]) - pd.Timestamp(stats["last"])).days
        rows.append(
            {
                "product_id": prod["id"],
                "product_name": prod.get("name"),
                "category": prod.get("category_name") or "General",
                "total_units_sold": int(stats["units"]),
                "revenue_generated": float(stats["revenue"]),
                "last_sale_days_ago": recency,
                "unit_price": float(prod.get("selling_price") or 0),
                "cost_price": float(prod["cost_price"]) if prod.get("cost_price") is not None else None,
                "active_days": len(sku_map) if sku_map else 0,
                "units_last_28d": window_units(sku_map, history["end_key"], 0, 28),
                "units_prior_28d": window_units(sku_map, history["end_key"], 28, 28),
                "days_in_inventory": history["observation_days"],
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def main():
    db = load_store()
    history = build_history(db)
    series_payload = complete_series(history)

    products = [p for p in db["products"] if p.get("store_id") == STORE]
    expenses = [e for e in db["expenses"] if e.get("store_id") == STORE]

    print("=" * 78)
    print("DATA REALITY")
    print("=" * 78)
    print(f"  invoices        : {len(history['invoices'])}")
    print(f"  window          : {history['first_key']} -> {history['end_key']}  ({history['observation_days']} days)")
    print(f"  daily rows sent : {len(series_payload)} (calendar-complete)")
    print(f"  products        : {len(products)}")
    print(f"  expenses        : {len(expenses)}")
    print(f"  measured COGS   : {fmt((history['cogs_ratio'] or 0) * 100)}% of line revenue")
    non_zero = sum(1 for row in series_payload if row["amount"] > 0)
    print(f"  days with sales : {non_zero} / {len(series_payload)}")

    daily_frame = build_daily_series(series_payload, "date", ("amount",))
    print(f"  gap stats       : {gap_stats(daily_frame)}")

    print()
    print("=" * 78)
    print("1. SALES FORECAST")
    print("=" * 78)
    forecast = predict_sales(days=30, history_records=series_payload, store_id=STORE)
    if forecast.get("status") == "insufficient_data":
        check("sales forecast produced", False, forecast.get("message", ""))
    else:
        info = forecast["model_info"]
        backtest = (info.get("metrics") or {}).get("backtest", {})
        model_m = backtest.get("model", {})
        base_m = backtest.get("baseline_seasonal_naive", {})

        print(f"  trained_at      : {info.get('trained_at')}")
        print(f"  n_samples       : {info.get('n_samples')}")
        print(f"  backtest folds  : {backtest.get('folds')}  ({backtest.get('n_test_points')} test points)")
        print(f"  model           : MAE {fmt(model_m.get('mae'))}  RMSE {fmt(model_m.get('rmse'))}  "
              f"sMAPE {fmt(model_m.get('smape'))}%  MASE {fmt(model_m.get('mase'), 4)}")
        print(f"  seasonal-naive  : MAE {fmt(base_m.get('mae'))}  RMSE {fmt(base_m.get('rmse'))}  "
              f"sMAPE {fmt(base_m.get('smape'))}%  MASE {fmt(base_m.get('mase'), 4)}")
        print(f"  confidence      : {forecast.get('confidence')}  (derived from the metrics above)")

        mase = model_m.get("mase")
        check("walk-forward backtest ran", (backtest.get("folds") or 0) > 0,
              f"{backtest.get('folds')} folds")
        check("MASE < 1.0 (beats seasonal-naive)", mase is not None and mase < 1.0,
              f"MASE = {fmt(mase, 4)}")

        daily = forecast["daily_forecasts"]
        ordered = all(d["lower_bound"] <= d["predicted_sales"] <= d["upper_bound"] for d in daily)
        check("lower <= point <= upper on every day", ordered, f"{len(daily)} days")

        head = np.mean([d["upper_bound"] - d["lower_bound"] for d in daily[:5]])
        tail = np.mean([d["upper_bound"] - d["lower_bound"] for d in daily[-5:]])
        check("interval widens with horizon", tail > head,
              f"first 5 days {fmt(head)} vs last 5 days {fmt(tail)}")

        print(f"  total {forecast['forecast_days']}d forecast: ₹{fmt(forecast['total_forecasted_sales'])}  "
              f"trend {fmt(forecast['trend_percentage'], 1)}% ({forecast.get('trend_basis')})")
        for row in daily[:3] + daily[-2:]:
            print(f"    {row['date']}  ₹{fmt(row['predicted_sales'])}  "
                  f"[{fmt(row['lower_bound'])} .. {fmt(row['upper_bound'])}]  {row['tag']}")

    print()
    print("=" * 78)
    print("2. LEAKAGE CHECK")
    print("=" * 78)
    frame = build_daily_series(series_payload, "date", ("amount",))
    values = frame["amount"].to_numpy(dtype=float)
    origin = len(values) - 10
    probe = pd.Series(values.copy(), index=frame.index)
    before = origin_features(probe, (1, 7, 14, 28), (7, 14, 28)).iloc[origin].to_dict()

    tampered = values.copy()
    tampered[origin + 1:] = 9_999_999.0  # everything after the origin
    after = origin_features(
        pd.Series(tampered, index=frame.index), (1, 7, 14, 28), (7, 14, 28)
    ).iloc[origin].to_dict()

    identical = all(
        (before[k] == after[k]) or (np.isnan(before[k]) and np.isnan(after[k])) for k in before
    )
    check("features at origin t ignore everything after t", identical,
          "overwrote y[t+1:] with 9,999,999 and the feature vector did not move")

    rng = random.Random(7)
    shuffled_values = values.copy()
    rng.shuffle(shuffled_values)
    shuffled = pd.DataFrame({"amount": shuffled_values}, index=frame.index)
    shuffled_artifact = sales_model.train(shuffled, STORE)
    shuffled_bt = shuffled_artifact.metrics["backtest"].get("model", {})
    real_bt = (forecast.get("model_info", {}).get("metrics") or {}).get("backtest", {}).get("model", {})
    print(f"  real series     : sMAPE {fmt(real_bt.get('smape'))}%   MAE {fmt(real_bt.get('mae'))}   "
          f"MASE {fmt(real_bt.get('mase'), 4)}")
    print(f"  shuffled series : sMAPE {fmt(shuffled_bt.get('smape'))}%   MAE {fmt(shuffled_bt.get('mae'))}   "
          f"MASE {fmt(shuffled_bt.get('mase'), 4)}")
    real_err = real_bt.get("smape") or 0.0
    shuf_err = shuffled_bt.get("smape") or 0.0
    collapsed = shuf_err > real_err * 1.2 or (shuf_err - real_err) > 2.0
    check("accuracy degrades when the series is shuffled", collapsed,
          f"sMAPE {fmt(real_err)}% -> {fmt(shuf_err)}% (a leaked model would score just as well)")

    print()
    print("=" * 78)
    print("3. DEMAND FORECAST (per SKU)")
    print("=" * 78)
    items = demand_items(db, history)
    demand = demand_model.forecast_demand(items, forecast_days=7, registry=get_registry(), store_id=STORE)
    methods = {}
    for row in demand.values():
        methods[row["method"]] = methods.get(row["method"], 0) + 1
    print(f"  SKUs modelled   : {len(demand)}")
    print(f"  methods         : {methods}")

    croston = [k for k, v in demand.items() if v["method"].startswith("croston")]
    sparse_with_std = [
        k for k in croston if demand[k]["daily_std"] > 0 and demand[k]["daily_velocity"] > 0
    ]
    check("Croston selected for sparse SKUs", bool(croston), f"{len(croston)} SKUs")
    check("sparse SKUs carry non-zero demand std", bool(sparse_with_std),
          f"{len(sparse_with_std)} of {len(croston)} Croston SKUs have std > 0")

    never_sold = [k for k, v in demand.items() if v["method"] == "no_sales_history"]
    check("every requested SKU gets a row back", len(demand) == len(items),
          f"{len(demand)} of {len(items)} items returned, {len(never_sold)} with no sales history")

    example = max(croston, key=lambda k: demand[k]["n_observations"]) if croston else None
    if example:
        row = demand[example]
        print(f"  example sparse SKU ({row['method']}): velocity {row['daily_velocity']} units/day, "
              f"std {row['daily_std']}, sold on {row['n_observations']}/{row['history_days']} days")

    print()
    print("=" * 78)
    print("4. INVENTORY POLICY")
    print("=" * 78)
    recs = compute_inventory_recommendations(
        items, forecast_days=7, registry=get_registry(), store_id=STORE
    )
    statuses = {}
    for row in recs:
        statuses[row["status"]] = statuses.get(row["status"], 0) + 1
    print(f"  status mix      : {statuses}")

    nonzero_safety = [r for r in recs if r["safety_stock"] > 0]
    check("safety stock is non-zero for at least one SKU", bool(nonzero_safety),
          f"{len(nonzero_safety)} of {len(recs)} SKUs (the old stock=2 collapse is gone)")

    eoq = [r for r in recs if r["eoq_reference"]]
    check("EOQ computed where cost data exists", bool(eoq), f"{len(eoq)} SKUs")

    critical = [r for r in recs if r["status"] in ("Critical Shortage", "Out of Stock")]
    for row in sorted(critical, key=lambda r: -r["projected_shortage"])[:4]:
        print(f"    {row['product_name'][:34]:34s} stock {row['current_stock']:>5} "
              f"ROP {row['reorder_point']:>8} order {row['recommended_order_quantity']:>5} "
              f"({row['demand_method']})")

    print()
    print("=" * 78)
    print("5. CATALOG CLASSIFICATION")
    print("=" * 78)
    cat_payload = catalog_items(db, history)
    first = classify_catalog(cat_payload, observation_days=history["observation_days"], store_id=STORE)
    second = classify_catalog(cat_payload, observation_days=history["observation_days"], store_id=STORE)

    print(f"  method          : {first['model_info'].get('method')}")
    print(f"  summary         : {first['summary']}")

    labels_a = {r["product_id"]: r["classification"] for r in first["classifications"]}
    labels_b = {r["product_id"]: r["classification"] for r in second["classifications"]}
    check("classification is deterministic", labels_a == labels_b)

    never_sold_ids = {
        row["product_id"] for row in cat_payload if row["last_sale_days_ago"] is None
    }
    dead = {pid for pid, label in labels_a.items() if label == "DEAD STOCK"}
    if never_sold_ids:
        check("never-sold products classified DEAD STOCK", never_sold_ids <= dead,
              f"{len(never_sold_ids)} never-sold, {len(never_sold_ids & dead)} labelled DEAD STOCK "
              f"(this was unreachable before: 999 was coerced to 0)")
    else:
        print("  (no never-sold products in this catalog — the 999->0 bug cannot be observed here)")

    for row in first["classifications"][:6]:
        print(f"    {row['product_name'][:34]:34s} {row['classification']:14s} "
              f"{' | '.join(row['reasons'][:2])}")

    print()
    print("=" * 78)
    print("6. EXPENSE ANOMALY DETECTION")
    print("=" * 78)
    anomalies = anomaly_model.detect_anomalies(expenses, store_id=STORE)
    info = anomalies["model_info"]
    flagged = anomalies["total_anomalies_detected"]
    print(f"  scored          : {info['scored']} of {len(anomalies['anomalies'])} records")
    print(f"  flag rate       : {flagged}/{len(anomalies['anomalies'])} "
          f"({fmt(100.0 * flagged / max(len(anomalies['anomalies']), 1), 1)}%)")
    print(f"  iforest used    : {info['isolation_forest_used']}")
    for category, summary in info["categories"].items():
        print(f"    {category:26s} n={summary['n_observations']:>2}  {summary['method']}")
    check("flag rate is not a fixed ~10%", flagged != round(0.1 * len(anomalies["anomalies"])),
          f"{flagged} flagged of {len(anomalies['anomalies'])}")
    for row in anomalies["anomalies"]:
        if row["is_anomaly"]:
            print(f"    FLAGGED {row['date']} {row['category']} ₹{fmt(row['amount'])} — {row['reason']}")

    print()
    print("=" * 78)
    print("7. EXPENSE FORECAST")
    print("=" * 78)
    exp_forecast = forecast_expenses(expenses, forecast_months=1, store_id=STORE)
    print(f"  total/month     : ₹{fmt(exp_forecast.get('total_predicted_expense'))}")
    print(f"  method          : {exp_forecast.get('model_info', {}).get('method')}")
    print(f"  weak categories : {exp_forecast.get('model_info', {}).get('low_confidence_categories')}")
    for row in exp_forecast.get("category_breakdown", []):
        print(f"    {row['category']:26s} ₹{fmt(row['predicted_amount']):>10}  "
              f"n={row['n_observations']}  {row['method']:24s} {row['baseline_strength']:8s} "
              f"[{fmt(row['interval_low'])} .. {fmt(row['interval_high'])}]")

    print()
    print("=" * 78)
    print("8. END-TO-END (the exact payload the backend sends)")
    print("=" * 78)
    from app.api.routes.insights import insights_summary  # noqa: E402
    from app.models.schemas import BusinessSyncPayload  # noqa: E402

    summary = insights_summary(
        BusinessSyncPayload(
            sales_history=series_payload,
            products=items,
            expenses=expenses,
            forecast_days=7,
            store_id=STORE,
            cogs_ratio=history["cogs_ratio"],
            history_days=history["observation_days"],
        )
    )
    model_info = summary.get("model_info", {})
    print(f"  growth          : {summary['sales_growth_predicted_pct']}%")
    print(f"  revenue         : ₹{fmt(summary['expected_revenue_next_period'])}")
    print(f"  COGS basis      : {model_info.get('cogs_basis')} at {model_info.get('cogs_ratio')}")
    print(f"  gross profit    : ₹{fmt(summary.get('expected_gross_profit'))}")
    print(f"  opex            : ₹{fmt(summary['expected_expense_next_period'])}")
    print(f"  net profit      : ₹{fmt(summary['predicted_net_profit'])}  margin {summary['profit_margin_pct']}%")
    print(f"  alerts          : {len(summary['critical_alerts'])}")
    for alert in summary["critical_alerts"]:
        print(f"    [{alert['severity']:8s}] {alert['title']}: {alert['message']}")
    print(f"  actions         :")
    for action in summary["top_recommended_actions"]:
        print(f"    - {action}")

    check("COGS ratio came from invoice line items",
          model_info.get("cogs_basis") == "measured_from_invoice_cost_prices",
          f"ratio {model_info.get('cogs_ratio')}")

    print()
    print("=" * 78)
    print("9. REGISTRY (what /ml/metrics reports)")
    print("=" * 78)
    described = get_registry().describe()
    for entry in described:
        bt = (entry.get("metrics") or {}).get("backtest", {})
        print(f"  {entry['store_id']}/{entry['model']}: n_samples={entry['n_samples']} "
              f"trained_at={entry['trained_at']} folds={bt.get('folds')} "
              f"MASE={fmt((bt.get('model') or {}).get('mase'), 4)}")
    check("sales model registered", any(e["model"] == "sales" for e in described))

    print()
    print("=" * 78)
    passed = sum(1 for _, ok in RESULTS if ok)
    failed = [name for name, ok in RESULTS if not ok]
    print(f"RESULT: {passed}/{len(RESULTS)} checks passed")
    for name in failed:
        print(f"  FAILED: {name}")
    print("=" * 78)

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
