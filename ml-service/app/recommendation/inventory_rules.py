"""Inventory replenishment policy.

Applied on top of the demand forecast rather than replacing it. The previous
version computed a raw 14-day mean inline and then derived safety stock from a
standard deviation that was frequently zero, which silently collapsed every
safety stock to its floor value of 2 units.

Policy is a periodic-review **(s, S)**:

* ``s`` = reorder point = d̄·L + z·σ·√L        (covers risk over lead time)
* ``S`` = order-up-to   = d̄·(L+R) + z·σ·√(L+R) (covers lead time + review)

When stock falls to ``s`` or below, order up to ``S``. ``d̄`` and ``σ`` come
from the demand model, ``L`` is the product's real lead time, and ``R`` is the
review period. EOQ is reported separately as a cost-optimal lot size for
comparison — it is deliberately *not* mixed into the (s, S) quantity, since the
two answer different questions under different review assumptions.
"""

import math
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import (
    ANNUAL_HOLDING_RATE,
    ANNUAL_ORDERING_COST,
    DEFAULT_REVIEW_PERIOD_DAYS,
    DEFAULT_SERVICE_LEVEL,
)
from app.core.registry import ModelRegistry, get_registry
from app.training.demand_model import forecast_demand

OVERSTOCK_COVER_DAYS = 45.0


def _service_z(service_level: float) -> float:
    """Inverse normal CDF for a service level, without a scipy dependency.

    Acklam's rational approximation, accurate to ~1e-9 across the usable range.
    """
    level = float(np.clip(service_level, 0.5, 0.999))
    a = [-3.969683028665376e01, 2.209460984245205e02, -2.759285104469687e02,
         1.383577518672690e02, -3.066479806614716e01, 2.506628277459239e00]
    b = [-5.447609879822406e01, 1.615858368580409e02, -1.556989798598866e02,
         6.680131188771972e01, -1.328068155288572e01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e00,
         -2.549732539343734e00, 4.374664141464968e00, 2.938163982698783e00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00,
         3.754408661907416e00]

    p_low, p_high = 0.02425, 1 - 0.02425
    if level < p_low:
        q = math.sqrt(-2 * math.log(level))
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1
        )
    if level > p_high:
        q = math.sqrt(-2 * math.log(1 - level))
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1
        )
    q = level - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (
        ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1
    )


def compute_inventory_recommendations(
    items: List[Dict[str, Any]],
    forecast_days: int = 7,
    service_level_z: Optional[float] = None,
    service_level: float = DEFAULT_SERVICE_LEVEL,
    registry: Optional[ModelRegistry] = None,
    store_id: str = "unknown",
    min_stock_floor: float = 0.0,
) -> List[Dict[str, Any]]:
    """Per-SKU reorder advice using modelled demand and real lead times.

    ``min_stock_floor`` is a store-wide units floor applied on top of each
    product's own ``min_stock_level``. It exists because the settings screen
    offered a "stockout warning threshold" that was persisted to localStorage
    and then read by nothing.
    """
    if not items:
        return []

    try:
        store_floor = max(float(min_stock_floor or 0.0), 0.0)
    except (TypeError, ValueError):
        store_floor = 0.0

    z_value = float(service_level_z) if service_level_z is not None else _service_z(service_level)
    review_period = max(int(forecast_days) or DEFAULT_REVIEW_PERIOD_DAYS, 1)
    engine = registry if registry is not None else get_registry()

    forecasts = forecast_demand(
        items, forecast_days=review_period, registry=engine, store_id=store_id
    )

    results: List[Dict[str, Any]] = []
    for item in items:
        pid = item.get("product_id")
        name = item.get("product_name", "Product")
        category = item.get("category", "General")
        current_stock = float(item.get("current_stock") or 0)
        lead_time = max(int(item.get("lead_time_days") or 3), 1)
        unit_cost = float(item.get("cost_price") or item.get("unit_price") or 0.0)
        min_stock = item.get("min_stock_level")

        forecast = forecasts.get(pid) or {}
        daily_velocity = float(forecast.get("daily_velocity", 0.0))
        daily_std = float(forecast.get("daily_std", 0.0))
        method = forecast.get("method", "no_history")

        protection_lead = lead_time
        protection_full = lead_time + review_period

        # Dispersion over each protection window, scaled by sqrt(time).
        sigma_lead = daily_std * math.sqrt(protection_lead)
        sigma_full = daily_std * math.sqrt(protection_full)

        reorder_point = daily_velocity * protection_lead + z_value * sigma_lead
        order_up_to = daily_velocity * protection_full + z_value * sigma_full

        # Each product's own floor applies alongside the store-wide one; neither
        # overrides the other.
        floor = store_floor
        if min_stock is not None:
            try:
                floor = max(floor, float(min_stock))
            except (TypeError, ValueError):
                pass
        if floor > 0:
            reorder_point = max(reorder_point, floor)
            order_up_to = max(order_up_to, floor)

        predicted_demand_units = int(math.ceil(daily_velocity * review_period))
        projected_shortage = int(max(0, predicted_demand_units - current_stock))

        recommended_order = 0
        if current_stock <= reorder_point:
            recommended_order = int(math.ceil(max(0.0, order_up_to - current_stock)))

        # Cost-optimal lot size, reported for comparison only.
        eoq_reference = None
        if unit_cost > 0 and daily_velocity > 0:
            holding_cost = ANNUAL_HOLDING_RATE * unit_cost
            if holding_cost > 0:
                eoq_reference = int(
                    math.ceil(
                        math.sqrt(
                            2.0 * daily_velocity * 365.0 * ANNUAL_ORDERING_COST / holding_cost
                        )
                    )
                )

        cover_days = (current_stock / daily_velocity) if daily_velocity > 0 else float("inf")

        if current_stock <= 0:
            status, urgency = "Out of Stock", "High"
        elif daily_velocity > 0 and current_stock < daily_velocity * protection_lead:
            status, urgency = "Critical Shortage", "High"
        elif current_stock <= reorder_point:
            status, urgency = "Low Stock", "Medium"
        elif cover_days > OVERSTOCK_COVER_DAYS:
            status, urgency = "Overstocked", "None"
        else:
            status, urgency = "Adequate", "Low"

        results.append(
            {
                "product_id": pid,
                "product_name": name,
                "category": category,
                "current_stock": int(current_stock),
                "unit_price": round(float(item.get("unit_price") or 0.0), 2),
                "unit_cost": round(unit_cost, 2),
                "predicted_demand_units": predicted_demand_units,
                "projected_shortage": projected_shortage,
                "status": status,
                "recommended_order_quantity": recommended_order,
                "reorder_urgency": urgency,
                "confidence": (forecast.get("pooled_model") or {}).get("confidence") or 0.0,
                # --- model-derived detail ---
                "daily_velocity": round(daily_velocity, 4),
                "daily_demand_std": round(daily_std, 4),
                "lead_time_days": lead_time,
                "review_period_days": review_period,
                "reorder_point": round(reorder_point, 2),
                "order_up_to_level": round(order_up_to, 2),
                "safety_stock": round(z_value * sigma_full, 2),
                "days_of_cover": (round(cover_days, 1) if math.isfinite(cover_days) else None),
                "service_level": round(float(service_level), 4),
                "eoq_reference": eoq_reference,
                "demand_method": method,
                "demand_basis": forecast.get("demand_basis", "unknown"),
                "n_observations": forecast.get("n_observations", 0),
            }
        )

    return results
