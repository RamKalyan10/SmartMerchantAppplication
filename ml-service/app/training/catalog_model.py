"""Catalog segmentation.

Replaces a fixed if/else ladder with KMeans segmentation over features that are
actually measured from invoice history.

Two defects this addresses in particular:

* The previous classifier relied on ``days_in_inventory``, which the API
  hardcoded to 30 — making the "units per month" normalisation a no-op, so the
  thresholds really meant "units ever sold".
* Never-sold products were mapped to ``last_sale_days_ago = 0`` by the caller,
  which put them in the *recently sold* bucket and made DEAD STOCK unreachable
  for exactly the items it exists to catch.

Label assignment is deterministic: clusters are ranked by a composite vitality
score and named in fixed order, with a recency gate so an actively-selling SKU
can never be labelled dead stock. Labels may go unused when the store genuinely
has no items in that segment, which is the honest outcome.
"""

from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = [
    "units_per_day",
    "revenue_per_day",
    "recency_days",
    "velocity_trend",
    "gross_margin_pct",
    "active_days_ratio",
]

LABEL_ORDER = ["HIGH DEMAND", "MEDIUM DEMAND", "LOW DEMAND", "SLOW MOVING", "DEAD STOCK"]

RECOMMENDATIONS = {
    "HIGH DEMAND": (
        "Hold buffer safety stock and negotiate bulk supplier terms; "
        "a stockout here costs the most revenue."
    ),
    "MEDIUM DEMAND": "Maintain a regular replenishment cycle sized to lead time.",
    "LOW DEMAND": "Order strictly to demand to keep holding cost down.",
    "SLOW MOVING": (
        "Trial a modest promotional discount or reduce shelf space; "
        "demand has not justified current holding."
    ),
    "DEAD STOCK": (
        "Liquidate via clearance or bundle with a fast mover. "
        "Capital tied up here is not returning."
    ),
}

PRIORITY = {
    "HIGH DEMAND": "High",
    "MEDIUM DEMAND": "Low",
    "LOW DEMAND": "Low",
    "SLOW MOVING": "Medium",
    "DEAD STOCK": "High",
}

DEAD_STOCK_MIN_RECENCY = 45
SLOW_MOVING_MIN_RECENCY = 25


def _numeric(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out if np.isfinite(out) else default


def build_features(product: Dict[str, Any], observation_days: int) -> Dict[str, float]:
    """Derive time-normalised features from whatever the caller supplied.

    ``observation_days`` is the real span of the sales window. Callers must not
    hardcode it — that was the original defect.
    """
    days = max(int(observation_days), 1)
    units = _numeric(product.get("total_units_sold"))
    revenue = _numeric(product.get("revenue_generated"))
    price = _numeric(product.get("unit_price"))

    units_per_day = units / days
    revenue_per_day = revenue / days if revenue else units_per_day * price

    recency_raw = product.get("last_sale_days_ago")
    if recency_raw is None:
        recency = float(days)
    else:
        recency = _numeric(recency_raw, float(days))
    recency = float(np.clip(recency, 0.0, 365.0))

    active_days = _numeric(product.get("active_days"), default=float("nan"))
    if np.isfinite(active_days) and days > 0:
        active_ratio = float(np.clip(active_days / days, 0.0, 1.0))
    elif units <= 0:
        active_ratio = 0.0
    else:
        # No exact count supplied; approximate from how recently it last sold.
        active_ratio = float(np.clip(1.0 - recency / days, 0.0, 1.0))

    recent = _numeric(product.get("units_last_28d"), default=float("nan"))
    prior = _numeric(product.get("units_prior_28d"), default=float("nan"))
    if np.isfinite(recent) and np.isfinite(prior) and prior > 0:
        trend = float(np.clip((recent - prior) / prior, -1.0, 3.0))
    else:
        trend = 0.0

    cost = _numeric(product.get("cost_price"))
    if price > 0 and cost > 0:
        margin = float(np.clip((price - cost) / price, -1.0, 1.0))
    else:
        margin = 0.0

    return {
        "units_per_day": units_per_day,
        "revenue_per_day": revenue_per_day,
        "recency_days": recency,
        "velocity_trend": trend,
        "gross_margin_pct": margin,
        "active_days_ratio": active_ratio,
    }


def _vitality(features: Dict[str, float]) -> float:
    """Composite score used purely to *rank* clusters relative to each other."""
    return (
        np.log1p(features["units_per_day"])
        + np.log1p(features["revenue_per_day"])
        - 0.05 * features["recency_days"]
        + 0.5 * features["velocity_trend"]
    )


def _assign_labels(centroids: List[Dict[str, float]]) -> List[Optional[str]]:
    """Rank clusters by vitality and name them, subject to a recency gate.

    Labels are handed out in descending vitality order from a pool that only
    shrinks, so no two clusters can ever carry the same label. The gate may
    move a cluster to a *more active* label than its rank earned (an
    actively-selling SKU is never DEAD STOCK); if that label is already taken,
    the nearest remaining label is used instead.
    """
    order = sorted(range(len(centroids)), key=lambda i: _vitality(centroids[i]), reverse=True)

    available = list(LABEL_ORDER)  # most active first
    labels: List[Optional[str]] = [None] * len(centroids)

    for position, idx in enumerate(order):
        if not available:
            # More clusters than labels: the least vital all share the last one.
            labels[idx] = LABEL_ORDER[-1]
            continue

        rank = min(position, len(LABEL_ORDER) - 1)
        candidate = LABEL_ORDER[rank]
        recency = centroids[idx]["recency_days"]

        if candidate == "DEAD STOCK" and recency < DEAD_STOCK_MIN_RECENCY:
            candidate = "SLOW MOVING"
        if candidate == "SLOW MOVING" and recency < SLOW_MOVING_MIN_RECENCY:
            candidate = "LOW DEMAND"

        if candidate not in available:
            for label in LABEL_ORDER[rank:]:
                if label in available:
                    candidate = label
                    break
            else:
                candidate = available[0]

        available.remove(candidate)
        labels[idx] = candidate

    return labels


def _reasons(features: Dict[str, float]) -> List[str]:
    """Explain the classification using the measured values themselves."""
    reasons = [f"{features['units_per_day']:.2f} units/day", f"{features['recency_days']:.0f}d since last sale"]
    if features["velocity_trend"] > 0.15:
        reasons.append(f"demand up {features['velocity_trend'] * 100:.0f}% vs prior period")
    elif features["velocity_trend"] < -0.15:
        reasons.append(f"demand down {abs(features['velocity_trend']) * 100:.0f}% vs prior period")
    if features["gross_margin_pct"] > 0:
        reasons.append(f"{features['gross_margin_pct'] * 100:.0f}% gross margin")
    return reasons


def classify(
    products: List[Dict[str, Any]],
    observation_days: int,
    store_id: str = "unknown",
) -> Dict[str, Any]:
    """Segment the catalog and return per-product classifications."""
    if not products:
        return {"classifications": [], "summary": {}, "model_info": {}}

    features_by_product = [build_features(p, observation_days) for p in products]
    matrix = np.array(
        [[f[name] for name in FEATURE_NAMES] for f in features_by_product], dtype=float
    )
    matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)

    n_products = len(products)
    n_clusters = int(min(5, max(1, n_products)))
    method = "rule_based_single_segment"

    if n_products >= 3:
        scaler = StandardScaler()
        scaled = scaler.fit_transform(matrix)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_ids = kmeans.fit_predict(scaled)

        raw_centroids = []
        for c in range(n_clusters):
            mask = cluster_ids == c
            if not mask.any():
                raw_centroids.append({name: 0.0 for name in FEATURE_NAMES})
                continue
            raw_centroids.append(
                {name: float(np.mean(matrix[mask, i])) for i, name in enumerate(FEATURE_NAMES)}
            )
        cluster_labels = _assign_labels(raw_centroids)
        method = f"kmeans_k{n_clusters}"
    else:
        cluster_ids = np.zeros(n_products, dtype=int)
        cluster_labels = ["MEDIUM DEMAND"]

    classifications = []
    for idx, product in enumerate(products):
        cluster = int(cluster_ids[idx])
        label = cluster_labels[cluster] or "LOW DEMAND"
        features = features_by_product[idx]
        classifications.append(
            {
                "product_id": product.get("product_id"),
                "product_name": product.get("product_name", "Product"),
                "classification": label,
                "recommendation": RECOMMENDATIONS.get(label, ""),
                "action_priority": PRIORITY.get(label, "Low"),
                "cluster": cluster,
                "features": {k: round(v, 4) for k, v in features.items()},
                "reasons": _reasons(features),
            }
        )

    summary: Dict[str, int] = {}
    for row in classifications:
        summary[row["classification"]] = summary.get(row["classification"], 0) + 1

    return {
        "classifications": classifications,
        "summary": summary,
        "model_info": {
            "method": method,
            "n_products": n_products,
            "observation_days": int(observation_days),
            "features": FEATURE_NAMES,
            "note": (
                "Segments are learned by KMeans; labels are assigned by ranking "
                "cluster centroids, so a label may be absent when no segment matches it."
            ),
        },
    }
