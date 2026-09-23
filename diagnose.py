"""Diagnose the two numbers that look wrong on the dashboard.

Run from the project root:

    python diagnose.py

Stdlib only - no install, no running services needed. It reads the same
merchant_db.json the backend reads and reproduces the exact arithmetic from
backend/src/controllers/analyticsController.js and forecastController.js.

Answers:
  1. Why the confidence score is 0.
  2. Why net profit comes out negative, and on which days / in which windows.
"""

import json
import os
from collections import defaultdict
from datetime import date, datetime, timedelta

DB = os.path.join("backend", "data", "merchant_db.json")
STORE = "store_dwdm_001"

# Mirrors DAYS_PER_MONTH in forecastController.js
DAYS_PER_MONTH = 30.44


def load():
    with open(DB, "r", encoding="utf-8") as fh:
        db = json.load(fh)
    invoices = [i for i in db.get("invoices", []) if i.get("store_id") == STORE]
    expenses = [e for e in db.get("expenses", []) if e.get("store_id") == STORE]
    return invoices, expenses


def day_of(row):
    d = row.get("date")
    if d:
        return str(d)[:10]
    ca = row.get("created_at")
    return str(ca)[:10] if ca else None


def cost_of(invoice_list):
    """Same as costOf() in analyticsController.js: per-unit cost x quantity."""
    total = 0.0
    for inv in invoice_list:
        for it in inv.get("items") or []:
            total += float(it.get("cost_price") or 0) * float(it.get("quantity") or 1)
    return total


def rupees(x):
    return f"{x:,.0f}"


def rule(title):
    print()
    print(title)
    print("-" * len(title))


def main():
    invoices, expenses = load()
    today = date.today()

    for inv in invoices:
        inv["_d"] = day_of(inv)
    for exp in expenses:
        exp["_d"] = day_of(exp)

    inv_dates = sorted(d for d in (i["_d"] for i in invoices) if d)
    exp_dates = sorted(d for d in (e["_d"] for e in expenses) if d)

    print("=" * 72)
    print("STORE DATA AS THE BACKEND SEES IT")
    print("=" * 72)
    print(f"today (system clock)      : {today.isoformat()}")
    print(f"invoices                  : {len(invoices)}   {inv_dates[0]} -> {inv_dates[-1]}")
    print(f"expenses                  : {len(expenses)}   {exp_dates[0]} -> {exp_dates[-1]}")
    with_items = sum(1 for i in invoices if i.get("items"))
    print(f"  invoices with line items: {with_items}")
    print(f"  invoices WITHOUT items  : {len(invoices) - with_items}"
          "   <- revenue counted, COGS = 0 for these")

    rev_all = sum(float(i.get("total_amount") or 0) for i in invoices)
    cogs_all = cost_of(invoices)
    exp_all = sum(float(e.get("amount") or 0) for e in expenses)
    gross_all = rev_all - cogs_all
    print()
    print(f"ALL TIME revenue          : {rupees(rev_all)}")
    print(f"ALL TIME COGS             : {rupees(cogs_all)}"
          f"   ({cogs_all / rev_all * 100:.1f}% of revenue)")
    print(f"ALL TIME gross profit     : {rupees(gross_all)}"
          f"   ({gross_all / rev_all * 100:.1f}% margin)")
    print(f"ALL TIME expenses         : {rupees(exp_all)}")
    print(f"ALL TIME net profit       : {rupees(gross_all - exp_all)}")

    # ---------------------------------------------------------------- 1
    rule("1. THE GAP AT THE END OF THE SERIES  (drives the confidence score)")
    last_inv = date.fromisoformat(inv_dates[-1])
    gap = (today - last_inv).days
    print(f"last invoice date : {last_inv.isoformat()}")
    print(f"today             : {today.isoformat()}")
    print(f"GAP               : {gap} days with no invoices at all")
    print()
    print("forecastController.buildHistory() sets")
    print("    endKey = max(lastObservedKey, todayKey)")
    print(f"          = max({last_inv.isoformat()}, {today.isoformat()})"
          f" = {today.isoformat()}")
    print("and completeDailySeries() zero-fills every calendar day from the first")
    print("invoice to endKey. So the series handed to the model ends with:")
    print()
    for n in range(gap, 0, -1):
        d = today - timedelta(days=n - 1)
        print(f"    {d.isoformat()}  amount = 0   <- fabricated zero")
    print()
    print("The model has never seen a zero-revenue day in training, so lag_1,")
    print("lag_7 and the 7-day rolling mean at the forecast origin are all ~0.")

    # ---------------------------------------------------------------- 2
    rule("2. CONFIDENCE")
    print("confidence comes from ml-service/app/evaluation/metrics.py:")
    print("    score = max(0, 1 - smape/100)          # 0 when smape >= 100")
    print("    score *= 0.5 + 0.5*clip(1-log(mase)/log(3), 0, 1)")
    print()
    print("and is 0.0 outright when the backtest has no finite sMAPE.")
    print()
    print("sMAPE is computed by evaluation/metrics.py:smape() as")
    print("    2*|y_pred - y_true| / (|y_true| + |y_pred|)")
    print("A zero-actual day scores:")
    print("    2*|p - 0| / (0 + |p|) = 2.0  ->  200%")
    print("Zero-denominator pairs are dropped, but 0-actual-vs-positive-prediction")
    print("is NOT dropped - it is the worst possible score.")
    print()
    print("Walk-forward config: BACKTEST_FOLDS=4, MIN_TRAIN_DAYS=21,")
    print("SALES_HORIZON=30. The final fold's test targets are the LAST days of")
    print(f"the series, which includes those {gap} zero days.")
    print()
    print("Two independent ways to land at exactly 0:")
    print("  a) ML service RUNNING  -> confidence_from_metrics() sees a sMAPE")
    print("     inflated by 200% zero-days; if it averages >= 100, score = 0.")
    print("  b) ML service DOWN     -> backend/src/services/mlClient.js line 179")
    print("     hardcodes `confidence: 0` in the seasonal-naive fallback.")
    print()
    print("In case (b) the fallback also predicts from the zero tail:")
    print("    Sep 19 -> reference Sep 12 -> real revenue")
    print("    Sep 20 -> reference Sep 13 -> 0")
    print("    Sep 21 -> reference Sep 14 -> 0   ... every later day is 0")
    print("So a degraded sales forecast shows ~1 real day then 0 for the rest.")

    # ---------------------------------------------------------------- 3
    rule("3. EXPENSE TIMING  (drives the daily net-profit dips)")
    by_cat = defaultdict(list)
    for e in expenses:
        by_cat[e.get("category", "?")].append((e["_d"], float(e.get("amount") or 0)))
    print(f"{'category':<24}{'n':>3}  {'total':>10}  amounts by date")
    for cat, rows in sorted(by_cat.items(), key=lambda kv: -sum(a for _, a in kv[1])):
        rows.sort()
        tot = sum(a for _, a in rows)
        shown = ", ".join(f"{d[5:]}={rupees(a)}" for d, a in rows)
        print(f"{cat:<24}{len(rows):>3}  {rupees(tot):>10}  {shown}")
    print()
    print("Every month puts Rent + Staff Salary + Electricity + Transport on the")
    print("2nd/3rd/5th/7th as SINGLE-DAY lumps, against revenue that arrives")
    print("smoothly every day. That is a cash-flow shape, not a loss.")

    # ---------------------------------------------------------------- 4
    rule("4. PER-DAY NET PROFIT  (last 45 days - this is the chart line)")
    per_day_rev = defaultdict(float)
    per_day_cogs = defaultdict(float)
    per_day_cnt = defaultdict(int)
    for inv in invoices:
        per_day_rev[inv["_d"]] += float(inv.get("total_amount") or 0)
        per_day_cogs[inv["_d"]] += cost_of([inv])
        per_day_cnt[inv["_d"]] += 1
    per_day_exp = defaultdict(float)
    for e in expenses:
        per_day_exp[e["_d"]] += float(e.get("amount") or 0)

    print(f"{'date':<12}{'inv':>4}{'revenue':>11}{'cogs':>10}"
          f"{'gross':>10}{'expense':>10}{'NET':>11}")
    start = today - timedelta(days=45)
    worst = []
    d = start
    while d <= today:
        k = d.isoformat()
        rev, cogs, exp = per_day_rev[k], per_day_cogs[k], per_day_exp[k]
        net = rev - cogs - exp
        if rev or exp:
            flag = "   <== NEGATIVE" if net < 0 else ""
            print(f"{k:<12}{per_day_cnt[k]:>4}{rupees(rev):>11}{rupees(cogs):>10}"
                  f"{rupees(rev - cogs):>10}{rupees(exp):>10}{rupees(net):>11}{flag}")
        if net < 0:
            worst.append((k, net))
        d += timedelta(days=1)
    print()
    if worst:
        print("Negative days in this range:")
        for k, net in worst:
            exp = per_day_exp[k]
            print(f"  {k}  net {rupees(net)}   (expense that day: {rupees(exp)})")
    else:
        print("No negative days in the last 45 days.")

    # ---------------------------------------------------------------- 5
    rule("5. NET PROFIT PER DASHBOARD PERIOD  (what the KPI card shows)")
    print("Reproduces getExecutiveOverview(). Note the preset branch filters")
    print("with `>= cutoff` and NO upper bound - a second bug, listed at the end.")
    print()
    print(f"{'period':<28}{'window':<26}{'revenue':>11}{'cogs':>10}"
          f"{'expense':>10}{'NET':>11}{'margin':>9}")

    def report(label, lo, hi):
        invs = [i for i in invoices if lo <= i["_d"] <= hi] if hi else \
               [i for i in invoices if i["_d"] >= lo]
        exps = [e for e in expenses if lo <= e["_d"] <= hi] if hi else \
               [e for e in expenses if e["_d"] >= lo]
        rev = sum(float(i.get("total_amount") or 0) for i in invs)
        cogs = cost_of(invs)
        exp = sum(float(e.get("amount") or 0) for e in exps)
        net = rev - cogs - exp
        margin = (net / rev * 100) if rev else 0.0
        win = f"{lo[5:]} -> {hi[5:] if hi else 'open'}"
        print(f"{label:<28}{win:<26}{rupees(rev):>11}{rupees(cogs):>10}"
              f"{rupees(exp):>10}{rupees(net):>11}{margin:>8.1f}%")
        return net

    for n in (7, 14, 30):
        lo = (today - timedelta(days=n - 1)).isoformat()
        report(f"Past {n} Days (preset)", lo, None)
    report("Overall / All Time", inv_dates[0], None)
    report("Custom 2026-09-01..09-12", "2026-09-01", "2026-09-12")

    print()
    print("Windows that DO go negative (short windows containing the lump):")
    for label, lo, hi in (
        ("Sep 1 -> Sep 7", "2026-09-01", "2026-09-07"),
        ("Aug 1 -> Aug 7", "2026-08-01", "2026-08-07"),
        ("Jul 1 -> Jul 7", "2026-07-01", "2026-07-07"),
        ("Jun 1 -> Jun 7", "2026-06-01", "2026-06-07"),
    ):
        invs = [i for i in invoices if lo <= i["_d"] <= hi]
        exps = [e for e in expenses if lo <= e["_d"] <= hi]
        rev = sum(float(i.get("total_amount") or 0) for i in invs)
        cogs = cost_of(invs)
        exp = sum(float(e.get("amount") or 0) for e in exps)
        net = rev - cogs - exp
        print(f"  {label:<16} revenue {rupees(rev):>9}  cogs {rupees(cogs):>9}"
              f"  gross {rupees(rev - cogs):>9}  expense {rupees(exp):>8}"
              f"  NET {rupees(net):>9}")

    # ---------------------------------------------------------------- 6
    rule("6. THE MISSING UPPER BOUND (real bug, separate from the above)")
    print("analyticsController.js, preset branch (line ~62):")
    print("    invoices.filter(inv => (... ) >= periodCutoffStr)")
    print("    expenses.filter(exp => (... ) >= periodCutoffStr)")
    print("compared with the custom-range branch, which correctly uses")
    print("    d >= start_date && d <= end_date")
    print()
    print("Effect: a preset window is unbounded above, so it includes any record")
    print("dated in the future as well as every expense past the cutoff. In the")
    print("current data it is latent (no invoice is dated after the last one),")
    print("but the KPI cards and getSalesTimeSeries() disagree whenever it bites,")
    print("because the chart builds exactly `days` buckets ending today.")

    print()
    print("=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print(f"confidence = 0   <- series ends {last_inv}, app clock says {today}.")
    print(f"                   {gap} zero-filled days poison the backtest (sMAPE 200%")
    print("                   per zero day) and, if the ML service is down, the")
    print("                   fallback literally returns `confidence: 0`.")
    print()
    print("negative net   <- fixed costs land as single-day lumps on the 2nd/3rd")
    print("profit            of each month; daily gross profit is smaller than the")
    print("                  lump, so those DAYS and any ~week-long window covering")
    print("                  them show a loss. Full months are solidly profitable.")
    print()
    print("Fix the gap and both symptoms lose their main driver: re-seed the")
    print("invoices so the series ends on today's date, or stop extending")
    print("endKey past the last observed day.")


if __name__ == "__main__":
    main()
