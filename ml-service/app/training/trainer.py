"""Orchestration layer.

This module used to hold a 290-line ``MLPipeline`` singleton that trained on
import, retrained on every request carrying more than 14 history rows, and
synthesised 180 days of fake sales whenever real history was thin.

It is now a thin composition layer. It owns exactly two responsibilities:

* turning raw request payloads into a gap-free daily series, and
* computing the content fingerprint that decides whether a cached model can be
  reused or must be refit.

Everything else lives in ``app.training.*`` (one module per model) and
``app.core.registry`` (caching). Nothing here fabricates data: when a store
lacks the history a model needs, the caller gets an explicit
``insufficient_data`` payload naming the shortfall.
"""

from typing import Any, Dict, List, Optional

import pandas as pd

from app.config import MIN_SALES_HISTORY_DAYS, SALES_LAGS
from app.core.registry import get_registry
from app.preprocessing.series import build_daily_series, gap_stats, insufficient_data
from app.training import anomaly_model, catalog_model, expense_model, sales_model
from app.training.sales_model import MODEL_NAME as SALES_MODEL

__all__ = [
    "classify_catalog",
    "detect_expense_anomalies",
    "forecast_expenses",
    "min_sales_days",
    "predict_sales",
    "sales_series",
]


def min_sales_days() -> int:
    """History a sales forecast needs.

    The longest lag (28) needs a value 28 days behind the origin, so 29 days is
    the true floor — one more than ``MIN_SALES_HISTORY_DAYS``. Reporting 28 and
    then feeding the model an all-NaN lag would train and serve different
    feature distributions, which is the class of bug this rewrite exists to
    remove.
    """
    return max(MIN_SALES_HISTORY_DAYS, max(SALES_LAGS) + 1)


def sales_series(history_records: Optional[List[Dict[str, Any]]]) -> pd.DataFrame:
    """Aggregate raw sales records into a complete daily series."""
    return build_daily_series(
        history_records or [], date_field="date", value_fields=("amount",)
    )


def predict_sales(
    days: int = 7,
    history_records: Optional[List[Dict[str, Any]]] = None,
    store_id: str = "unknown",
) -> Dict[str, Any]:
    """Forecast daily revenue, training at most once per distinct dataset."""
    required = min_sales_days()

    if not history_records:
        return insufficient_data(
            "sales", 0, required, "days", "No sales history was supplied."
        )

    series = sales_series(history_records)
    if series.empty or "amount" not in series.columns:
        return insufficient_data(
            "sales",
            0,
            required,
            "days",
            "History could not be parsed into a daily series.",
        )

    n_days = int(len(series))
    if n_days < required:
        return insufficient_data(
            "sales",
            n_days,
            required,
            "days",
            "Zero-filled daily series is shorter than the longest lag plus one.",
        )

    registry = get_registry()
    fingerprint = registry.fingerprint(
        store_id,
        SALES_MODEL,
        n_days,
        str(series.index[-1].date()),
        round(float(series["amount"].sum()), 2),
    )

    try:
        artifact = registry.get_or_train(
            store_id,
            SALES_MODEL,
            fingerprint,
            lambda: sales_model.train(series, store_id),
        )
    except Exception as exc:  # a model that cannot train must say so, not 500
        return insufficient_data(
            "sales", n_days, required, "days", f"Training failed: {exc}"
        )

    result = sales_model.forecast(artifact, series, days)
    result["history"] = gap_stats(series)
    return result


def detect_expense_anomalies(
    expenses: Optional[List[Dict[str, Any]]],
    store_id: str = "unknown",
    z_threshold: Optional[float] = None,
) -> Dict[str, Any]:
    """Score expenses against their own category baselines."""
    return anomaly_model.detect_anomalies(
        expenses or [], store_id=store_id, z_threshold=z_threshold
    )


def forecast_expenses(
    history: Optional[List[Dict[str, Any]]],
    forecast_months: int = 1,
    store_id: str = "unknown",
) -> Dict[str, Any]:
    """Forecast operating expenses per category."""
    return expense_model.forecast_expenses(
        history, forecast_months=forecast_months, store_id=store_id
    )


def classify_catalog(
    products: Optional[List[Dict[str, Any]]],
    observation_days: int,
    store_id: str = "unknown",
) -> Dict[str, Any]:
    """Segment the catalog by measured velocity, margin and recency."""
    return catalog_model.classify(
        products or [], observation_days=observation_days, store_id=store_id
    )
