"""Expense anomaly detection.

The previous implementation had three problems that guaranteed a fixed rate of
false alarms and missed the cases it existed to catch:

* ``IsolationForest(contamination=0.1)`` forces roughly 10% of *any* input to
  be labelled anomalous, whatever the distribution looks like.
* It was combined with ``z > 2.0`` under an ``or``, so either rule could fire
  independently — two chances to be wrong, no way to reason about the rate.
* It was fit and scored on the identical array, so there was no baseline the
  points were actually unusual *relative to*.

Here a single decision rule is used: a **MAD-based robust z-score**, computed
leave-one-out so a point never contributes to its own baseline. MAD is chosen
over mean/standard deviation precisely because the values being tested are
outliers — a standard deviation would be inflated by the very point under
suspicion.

Series with a real trend are detrended first, so a gradually rising electricity
bill is not reported as an anomaly every month.
"""

from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from app.config import ISOLATION_FOREST_MIN_N, MIN_ANOMALY_OBSERVATIONS

ROBUST_Z_THRESHOLD = 3.5
MAD_SCALE = 0.6745
MIN_RELATIVE_SPREAD = 0.05  # assumed natural variation when MAD collapses to 0
TREND_MIN_N = 8

METHOD_BY_SIZE = {
    "robust_z_loo": "Leave-one-out MAD z-score on raw levels.",
    "robust_z_loo_detrended": "Leave-one-out MAD z-score on Theil-Sen residuals.",
    "insufficient_baseline": "Too few prior observations in this category to score.",
}


def _mad(values: np.ndarray) -> float:
    if values.size == 0:
        return 0.0
    median = float(np.median(values))
    return float(np.median(np.abs(values - median)))


def _theil_sen(x: np.ndarray, y: np.ndarray) -> tuple:
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


def _category_baseline(amounts: np.ndarray, positions: np.ndarray):
    """Return ``(values_for_scoring, method)`` for a category.

    Detrends when the series is long enough for the fit to be meaningful and
    the trend clearly dominates the residual spread.
    """
    n = len(amounts)
    if n >= TREND_MIN_N:
        slope, intercept = _theil_sen(positions, amounts)
        residuals = amounts - (intercept + slope * positions)
        spread = _mad(residuals) / MAD_SCALE
        total_change = abs(slope) * float(positions[-1] - positions[0])
        if spread > 0 and total_change > 2.0 * spread:
            return residuals, "robust_z_loo_detrended"
    return amounts, "robust_z_loo"


def _score_point(value: float, others: np.ndarray) -> Dict[str, float]:
    """Robust z of ``value`` against ``others`` (which excludes it)."""
    if others.size == 0:
        return {"z": 0.0, "median": value, "spread": 0.0}

    median = float(np.median(others))
    mad = _mad(others)
    spread = mad / MAD_SCALE if mad > 0 else 0.0

    # With a collapsed MAD, assume a floor of natural variation rather than
    # dividing by zero and reporting infinite confidence.
    floor = max(abs(median) * MIN_RELATIVE_SPREAD, 1e-6)
    spread = max(spread, floor)

    return {
        "z": float((value - median) / spread),
        "median": median,
        "spread": spread,
    }


def detect_anomalies(
    expenses: Sequence[Dict[str, Any]],
    store_id: str = "unknown",
    z_threshold: Optional[float] = None,
) -> Dict[str, Any]:
    """Score each expense against its category's own history.

    ``z_threshold`` lets the caller set sensitivity; it defaults to the
    configured value. It is clamped to a sane band so a bad setting cannot
    disable detection entirely or flag everything.
    """
    if not expenses:
        return {
            "anomalies": [],
            "total_anomalies_detected": 0,
            "model_info": {"method": "none", "reason": "no expenses supplied"},
        }

    if z_threshold is None:
        threshold = ROBUST_Z_THRESHOLD
    else:
        try:
            threshold = float(np.clip(float(z_threshold), 1.5, 6.0))
        except (TypeError, ValueError):
            threshold = ROBUST_Z_THRESHOLD

    # Group indices by category, ordered by date so trend fits are meaningful.
    by_category: Dict[str, List[int]] = {}
    for idx, expense in enumerate(expenses):
        by_category.setdefault(str(expense.get("category", "General")), []).append(idx)

    scored: Dict[int, Dict[str, Any]] = {}
    category_summary: Dict[str, Any] = {}

    for category, indices in by_category.items():
        ordered = sorted(
            indices,
            key=lambda i: str(expenses[i].get("date") or ""),
        )
        amounts = np.array(
            [float(expenses[i].get("amount") or 0.0) for i in ordered], dtype=float
        )
        n = len(amounts)

        if n < MIN_ANOMALY_OBSERVATIONS:
            for i in ordered:
                scored[i] = {
                    "robust_z": 0.0,
                    "percentile": 0.0,
                    "median": float(np.median(amounts)) if n else 0.0,
                    "spread": 0.0,
                    "method": "insufficient_baseline",
                    "baseline_n": n,
                    "is_anomaly": False,
                }
            category_summary[category] = {
                "n_observations": n,
                "method": "insufficient_baseline",
                "note": (
                    f"Needs {MIN_ANOMALY_OBSERVATIONS} observations to establish a "
                    f"baseline; has {n}."
                ),
            }
            continue

        positions = np.arange(n, dtype=float)
        scoring_values, method = _category_baseline(amounts, positions)
        full_median = float(np.median(scoring_values))
        full_spread = max(
            _mad(scoring_values) / MAD_SCALE,
            max(abs(full_median) * MIN_RELATIVE_SPREAD, 1e-6),
        )

        for local_idx, global_idx in enumerate(ordered):
            others = np.delete(scoring_values, local_idx)
            stats = _score_point(scoring_values[local_idx], others)

            # Empirical percentile of the observed amount within its category.
            percentile = float(np.mean(scoring_values <= scoring_values[local_idx]) * 100.0)

            scored[global_idx] = {
                "robust_z": round(stats["z"], 3),
                "percentile": round(percentile, 1),
                "median": stats["median"],
                "spread": stats["spread"],
                "method": method,
                "baseline_n": n - 1,
                "is_anomaly": bool(abs(stats["z"]) > threshold),
            }

        category_summary[category] = {
            "n_observations": n,
            "method": method,
            "median": round(full_median, 2),
            "robust_spread": round(full_spread, 2),
            "detrended": method.endswith("detrended"),
        }

    isolation_forest_available = False
    try:
        from sklearn.ensemble import IsolationForest

        for category, indices in by_category.items():
            if len(indices) < ISOLATION_FOREST_MIN_N:
                continue
            amounts = np.array(
                [float(expenses[i].get("amount") or 0.0) for i in indices], dtype=float
            ).reshape(-1, 1)
            forest = IsolationForest(random_state=42, contamination="auto")
            forest.fit(amounts)
            # Reported as corroboration only; the decision rule above stands alone.
            for local_idx, global_idx in enumerate(indices):
                scored[global_idx]["iforest_flag"] = int(forest.predict(amounts[local_idx : local_idx + 1])[0])
            isolation_forest_available = True
    except Exception:
        isolation_forest_available = False

    results: List[Dict[str, Any]] = []
    for idx, expense in enumerate(expenses):
        info = scored.get(idx, {})
        amount = float(expense.get("amount") or 0.0)
        is_anomaly = bool(info.get("is_anomaly"))
        median = float(info.get("median", amount))
        spread = float(info.get("spread", 0.0))
        z = float(info.get("robust_z", 0.0))
        percentile = float(info.get("percentile", 0.0))
        method = info.get("method", "insufficient_baseline")
        baseline_n = int(info.get("baseline_n", 0))

        low = max(median - 2.0 * spread, 0.0)
        high = median + 2.0 * spread

        if method == "insufficient_baseline":
            reason = (
                f"Not scored: only {baseline_n} prior {expense.get('category')} "
                f"records, below the {MIN_ANOMALY_OBSERVATIONS} needed for a baseline."
            )
        elif is_anomaly:
            direction = "above" if z > 0 else "below"
            pct_diff = ((amount - median) / median * 100.0) if median else 0.0
            reason = (
                f"{abs(z):.1f} robust deviations {direction} the {expense.get('category')} "
                f"median of ₹{median:,.0f} ({pct_diff:+.0f}%); "
                f"{percentile:.0f}th percentile of {baseline_n + 1} records."
            )
        else:
            reason = (
                f"Within normal range for {expense.get('category')} "
                f"(₹{low:,.0f}–₹{high:,.0f}); {percentile:.0f}th percentile."
            )

        results.append(
            {
                "id": expense.get("id"),
                "date": expense.get("date"),
                "category": expense.get("category", "General"),
                "amount": amount,
                "expected_range": f"₹{low:,.0f} - ₹{high:,.0f}",
                "anomaly_score": round(percentile / 100.0, 3),
                "is_anomaly": is_anomaly,
                "reason": reason,
                "robust_z": round(z, 3),
                "percentile": round(percentile, 1),
                "baseline_n": baseline_n,
                "method": method,
            }
        )

    total = sum(1 for r in results if r["is_anomaly"])
    scorable = [r for r in results if r["method"] != "insufficient_baseline"]

    return {
        "anomalies": results,
        "total_anomalies_detected": total,
        "model_info": {
            "method": "leave_one_out_mad_robust_z",
            "threshold_z": threshold,
            "scored": len(scorable),
            "unscored": len(results) - len(scorable),
            "isolation_forest_used": isolation_forest_available,
            "categories": category_summary,
            "note": (
                "Flag rate is not fixed: it depends on how far each value sits "
                "from its category's own median. Isolation Forest, when available, "
                "is reported as corroboration and does not override the z-score."
            ),
        },
    }
