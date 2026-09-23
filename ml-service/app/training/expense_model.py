"""Expense forecasting.

An honesty problem first: this store has 24 expense records across 7
categories, roughly 5 observations each. That is not enough to fit a seasonal
time-series model, and pretending otherwise would produce confident-looking
noise.

What is defensible at n~5 is robust estimation with shrinkage:

* Recurring costs (rent, payroll) are near-deterministic — carry the level
  forward.
* Variable costs get a Theil-Sen slope, but only when the fitted change is
  large relative to the residual spread. Otherwise the series is treated as
  flat, because a slope through five noisy points is usually an artefact.
* The estimated **growth rate** is shrunk toward zero in proportion to sample
  size. Shrinking the *level* across categories would be wrong — rent and
  electricity have genuinely different magnitudes — but shrinking the rate of
  change toward "no change" is the standard small-sample correction.

Every category reports its ``n_observations`` and chosen ``method`` so the
basis of the number is visible rather than implied.
"""

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from app.config import MIN_EXPENSE_OBSERVATIONS

DAYS_PER_MONTH = 30.44
SHRINKAGE_K = 4.0          # growth is halved in influence at n = K
FIXED_CV_THRESHOLD = 0.25  # below this, treat the cost as recurring


def _robust_std(values: np.ndarray) -> float:
    """MAD scaled to be comparable with a standard deviation."""
    if values.size == 0:
        return 0.0
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))
    if mad <= 0:
        # Degenerate spread; fall back to a mean-absolute-deviation estimate.
        mad = float(np.mean(np.abs(values - median)))
    return mad / 0.6745 if mad > 0 else 0.0


def _theil_sen(x: np.ndarray, y: np.ndarray) -> Tuple[float, float]:
    """Median-of-pairwise-slopes fit. Robust to a single outlier at small n."""
    n = len(x)
    if n < 2:
        return 0.0, float(y[0]) if n else 0.0

    slopes = []
    for i in range(n):
        for j in range(i + 1, n):
            if x[j] != x[i]:
                slopes.append((y[j] - y[i]) / (x[j] - x[i]))
    slope = float(np.median(slopes)) if slopes else 0.0
    intercept = float(np.median(y - slope * x))
    return slope, intercept


def _estimate_category(amounts: np.ndarray, months: np.ndarray) -> Dict[str, Any]:
    """Raw (unshrunk) level, growth and dispersion for a single category."""
    n = len(amounts)
    level = float(np.median(amounts))
    if level <= 0:
        level = float(np.mean(amounts))

    mean = float(np.mean(amounts))
    cv = (_robust_std(amounts) / mean) if mean > 0 else 0.0
    is_fixed = cv < FIXED_CV_THRESHOLD and n >= 3

    method = "carried_forward"
    growth = 0.0

    if n >= 4 and not is_fixed:
        slope, intercept = _theil_sen(months, amounts)
        residuals = amounts - (intercept + slope * months)
        spread = _robust_std(residuals)
        total_change = abs(slope) * float(months[-1] - months[0])
        # Only trust a trend that dominates the noise around it.
        if spread > 0 and total_change > 2.0 * spread:
            growth = slope / level if level > 0 else 0.0
            method = "theil_sen_trend"
        else:
            method = "robust_level_flat"

    return {
        "level": level,
        "raw_growth": float(growth),
        "method": method,
        "is_fixed": bool(is_fixed),
        "cv": round(float(cv), 3),
        "n_observations": int(n),
        "spread": _robust_std(amounts),
    }


def forecast_expenses(
    history: Optional[Sequence[Dict[str, Any]]],
    forecast_months: int = 1,
    store_id: str = "unknown",
) -> Dict[str, Any]:
    """Forecast total expense and per-category breakdown."""
    months_ahead = max(int(forecast_months), 1)

    def _insufficient(message: str) -> Dict[str, Any]:
        return {
            "status": "insufficient_data",
            "model": "expense",
            "n_available": 0,
            "n_required": MIN_EXPENSE_OBSERVATIONS,
            "unit": "records",
            "message": message,
            "total_predicted_expense": 0.0,
            "category_breakdown": [],
        }

    if not history:
        return _insufficient("No expense history supplied.")

    frame = pd.DataFrame(history)
    if "amount" not in frame.columns or "category" not in frame.columns:
        return _insufficient("Expense records must carry 'category' and 'amount'.")

    frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce").fillna(0.0)
    if "date" in frame.columns:
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    else:
        frame["date"] = pd.NaT

    # Pass 1 — raw estimates, so the pooled shrinkage target is unshrunk.
    raw: Dict[str, Dict[str, Any]] = {}
    for category, group in frame.groupby("category"):
        group = group.sort_values("date")
        amounts = group["amount"].to_numpy(dtype=float)
        dates = group["date"]
        if dates.notna().all() and len(dates) > 1:
            months = ((dates - dates.iloc[0]).dt.days.to_numpy(dtype=float)) / DAYS_PER_MONTH
        else:
            months = np.arange(len(amounts), dtype=float)
        raw[str(category)] = _estimate_category(amounts, months)

    total_n = sum(e["n_observations"] for e in raw.values())
    global_growth = (
        sum(e["raw_growth"] * e["n_observations"] for e in raw.values()) / total_n
        if total_n > 0
        else 0.0
    )

    # Pass 2 — shrink each category's growth toward the pooled rate.
    breakdown: List[Dict[str, Any]] = []
    for category, est in raw.items():
        n = est["n_observations"]
        weight = n / (n + SHRINKAGE_K) if n > 0 else 0.0
        growth = weight * est["raw_growth"] + (1.0 - weight) * global_growth
        growth = float(np.clip(growth, -0.25, 0.25))

        method = est["method"]
        if abs(growth) < 0.005:
            growth = 0.0
            if method == "theil_sen_trend":
                method = "robust_level_flat"

        level = est["level"]
        projected = max(level * (1.0 + growth) * months_ahead, 0.0)

        # Floor the interval so certainty is never implied, and inflate it for
        # small samples rather than reporting a spuriously tight range.
        relative = (est["spread"] / level) if level > 0 else 0.0
        inflation = 1.0 + max(0, MIN_EXPENSE_OBSERVATIONS - n) / max(n, 1)
        relative = float(np.clip(relative * inflation, 0.05, 1.5))
        width = projected * relative

        strength = (
            "strong" if n >= 10 else ("moderate" if n >= MIN_EXPENSE_OBSERVATIONS else "weak")
        )

        breakdown.append(
            {
                "category": category,
                "predicted_amount": round(projected, 2),
                "interval_low": round(max(projected - width, 0.0), 2),
                "interval_high": round(projected + width, 2),
                "monthly_growth_pct": round(growth * 100.0, 2),
                "n_observations": n,
                "method": method,
                "cost_type": "fixed" if est["is_fixed"] else "variable",
                "baseline_strength": strength,
                "share_pct": 0.0,
            }
        )

    total = sum(item["predicted_amount"] for item in breakdown)
    for item in breakdown:
        item["share_pct"] = round((item["predicted_amount"] / (total + 1e-9)) * 100.0, 1)
    breakdown.sort(key=lambda x: x["predicted_amount"], reverse=True)

    n_min = min((b["n_observations"] for b in breakdown), default=0)
    weak = [b["category"] for b in breakdown if b["baseline_strength"] == "weak"]

    return {
        "total_predicted_expense": round(total, 2),
        "forecast_months": months_ahead,
        "category_breakdown": breakdown,
        "model_info": {
            "method": "robust_level_with_shrunk_growth",
            "n_categories": len(breakdown),
            "min_observations_per_category": int(n_min),
            "pooled_growth_per_month_pct": round(global_growth * 100.0, 2),
            "low_confidence_categories": weak,
            "note": (
                "Growth estimates are shrunk toward the pooled rate in proportion "
                "to sample size; categories marked 'weak' have too few "
                "observations for a reliable trend."
            ),
        },
    }
