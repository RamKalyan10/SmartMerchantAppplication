"""Per-SKU demand forecasting.

Two estimators, selected per SKU by how often it actually sells:

* **Croston/SBA** for intermittent demand. Retail SKUs frequently sell on a
  minority of days, which violates every assumption of a mean-based model. The
  Syntetos-Boylan Approximation smooths demand size and inter-arrival interval
  separately, which is the established treatment for this data shape.

* **Pooled gradient boosting** for SKUs with enough density to learn from. With
  only ~139 days per SKU, a per-SKU model would be hopeless; pooling across all
  SKUs of a store lets category, price, and calendar effects be learned from
  every SKU at once.

Both paths return a genuine dispersion estimate, which the inventory policy
needs — the previous implementation fed a three-element list of identical
averages into ``np.std`` and therefore always got zero, silently collapsing
safety stock to its floor value.
"""

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from app.config import (
    BACKTEST_FOLDS,
    DEMAND_DENSE_THRESHOLD,
    MIN_DEMAND_OBSERVATIONS,
    MIN_TRAIN_DAYS,
)
from app.core.registry import ModelArtifact, ModelRegistry, utc_now_iso
from app.evaluation.backtest import walk_forward_evaluate
from app.evaluation.metrics import confidence_from_metrics
from app.preprocessing.calendar import get_festival_info
from app.preprocessing.features import calendar_features

MODEL_NAME = "demand_pooled"
CROSTON_ALPHA = 0.1
POOLED_HORIZON = 14
POOLED_SEASONALITY = 7


# ---------------------------------------------------------------------------
# Series construction
# ---------------------------------------------------------------------------


def _series_from_item(item: Dict[str, Any], end_date: pd.Timestamp) -> pd.Series:
    """Build a gap-free daily unit series for one SKU.

    Prefers the sparse ``sales_history`` records when the caller supplies them,
    since those preserve the real dates. Falls back to treating
    ``historical_sales`` as consecutive daily counts ending at ``end_date``.
    """
    records = item.get("sales_history")
    if records:
        frame = pd.DataFrame(records)
        if "date" in frame.columns and "units" in frame.columns:
            frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
            frame["units"] = pd.to_numeric(frame["units"], errors="coerce").fillna(0.0)
            frame = frame.dropna(subset=["date"])
            if not frame.empty:
                grouped = frame.groupby(frame["date"].dt.normalize())["units"].sum()
                full = pd.date_range(grouped.index.min(), grouped.index.max(), freq="D")
                return grouped.reindex(full, fill_value=0.0).astype(float)

    flat = item.get("historical_sales") or []
    values = [float(v) for v in flat if v is not None]
    if not values:
        return pd.Series(dtype=float)
    index = pd.date_range(end=end_date, periods=len(values), freq="D")
    return pd.Series(values, index=index, dtype=float)


# ---------------------------------------------------------------------------
# Croston / Syntetos-Boylan Approximation
# ---------------------------------------------------------------------------


def croston_sba(units: np.ndarray, alpha: float = CROSTON_ALPHA) -> Dict[str, float]:
    """Forecast an intermittent demand series.

    Returns the smoothed demand rate per day plus a variance estimate derived
    from the compound arrival process — ``Var = (1/p) * E[size^2]``, where
    ``p`` is the mean inter-arrival interval. This is what gives a sparse SKU a
    non-zero uncertainty instead of a degenerate zero.
    """
    units = np.asarray(units, dtype=float)
    nonzero = np.flatnonzero(units > 0)

    if nonzero.size == 0:
        return {"rate": 0.0, "std": 0.0, "mean_size": 0.0, "mean_interval": 0.0, "n_demands": 0}

    sizes = units[nonzero]
    if nonzero.size == 1:
        intervals = np.array([max(1.0, float(len(units)))])
    else:
        intervals = np.diff(nonzero).astype(float)

    level_size = float(sizes[0])
    level_interval = float(intervals[0])
    for size, interval in zip(sizes[1:], intervals[1:]):
        level_size = alpha * float(size) + (1.0 - alpha) * level_size
        level_interval = alpha * float(interval) + (1.0 - alpha) * level_interval

    if level_interval <= 0:
        level_interval = 1.0

    rate = level_size / level_interval
    rate_sba = rate * (1.0 - alpha / 2.0)  # bias correction

    var_per_period = (1.0 / level_interval) * float(np.mean(sizes**2))
    return {
        "rate": float(max(rate_sba, 0.0)),
        "std": float(math.sqrt(max(var_per_period, 0.0))),
        "mean_size": float(np.mean(sizes)),
        "mean_interval": level_interval,
        "n_demands": int(nonzero.size),
    }


# ---------------------------------------------------------------------------
# Pooled model
# ---------------------------------------------------------------------------


def _category_rates(
    series_by_sku: Dict[str, pd.Series], meta_by_sku: Dict[str, Dict[str, Any]]
) -> Dict[str, float]:
    """Mean daily units per category — the pooled model's target encoding.

    Computed once and used by both training and serving. Deriving it separately
    in each path is how a train/serve skew creeps in: the model would learn
    against a category mean and be served the SKU's own mean.
    """
    buckets: Dict[str, List[float]] = {}
    for sku, series in series_by_sku.items():
        category = meta_by_sku[sku].get("category", "General")
        buckets.setdefault(category, []).append(float(series.mean()))
    return {category: float(np.mean(values)) for category, values in buckets.items()}


def _pooled_rows(
    series_by_sku: Dict[str, pd.Series],
    meta_by_sku: Dict[str, Dict[str, Any]],
    horizons: Sequence[int],
    category_mean: Dict[str, float],
) -> Tuple[pd.DataFrame, List[str]]:
    """Build a (SKU x origin x horizon) training frame across every SKU."""
    if not series_by_sku:
        return pd.DataFrame(), []

    frames = []
    for sku, series in series_by_sku.items():
        if len(series) < MIN_TRAIN_DAYS:
            continue
        meta = meta_by_sku[sku]
        values = series.to_numpy(dtype=float)
        n = len(values)

        cal = calendar_features(pd.DatetimeIndex(series.index))
        cal_cols = list(cal.columns)

        base = pd.DataFrame(index=range(n))
        for col in cal_cols:
            base[col] = cal[col].to_numpy()
        base["lag_1"] = np.concatenate([[np.nan], values[:-1]])
        lag7 = np.full(n, np.nan)
        if n > 7:
            lag7[7:] = values[:-7]
        base["lag_7"] = lag7
        shifted = pd.Series(np.concatenate([[np.nan], values[:-1]]))
        for window in (7, 14):
            base[f"roll_mean_{window}"] = shifted.rolling(window, min_periods=1).mean().to_numpy()
        base["origin_idx"] = np.arange(n)
        base["sku_density"] = float((values > 0).mean())
        base["category_rate"] = category_mean.get(meta.get("category", "General"), 0.0)
        base["unit_price"] = float(meta.get("unit_price") or 0.0)
        base["margin_pct"] = float(meta.get("margin_pct") or 0.0)

        for horizon in horizons:
            block = base.copy()
            block["horizon"] = float(horizon)
            target = np.full(n, np.nan)
            if horizon < n:
                target[: n - horizon] = values[horizon:]
            block["y"] = target

            # Seasonal-naive reference for this row, read from *this* series.
            # The backtest cannot do this lookup itself: a pooled frame restarts
            # origin_idx at 0 for every SKU, so a positional lookup would pull
            # the reference out of a different product's history.
            lookup = np.arange(n) + horizon - POOLED_SEASONALITY
            naive = np.full(n, np.nan)
            in_range = (lookup >= 0) & (lookup < n)
            naive[in_range] = values[lookup[in_range]]
            block["naive_ref"] = naive

            block["origin_idx"] = np.arange(n)
            block["sku"] = sku
            frames.append(block)

    if not frames:
        return pd.DataFrame(), []

    combined = pd.concat(frames, ignore_index=True)
    feature_cols = (
        cal_cols
        + ["lag_1", "lag_7", "roll_mean_7", "roll_mean_14"]
        + ["horizon", "sku_density", "category_rate", "unit_price", "margin_pct"]
    )
    combined = combined.dropna(subset=["y"] + feature_cols)
    return combined.reset_index(drop=True), feature_cols


def _make_pooled_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        loss="squared_error",
        max_iter=300,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=20,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=42,
    )


# ---------------------------------------------------------------------------
# Public forecasting entry point
# ---------------------------------------------------------------------------


def forecast_demand(
    items: List[Dict[str, Any]],
    forecast_days: int = 7,
    registry: Optional[ModelRegistry] = None,
    store_id: str = "unknown",
) -> Dict[str, Dict[str, Any]]:
    """Forecast daily demand per SKU.

    Returns a mapping ``product_id -> {daily_velocity, daily_std, method, ...}``.
    """
    end_date = pd.Timestamp(datetime.now().date())
    horizons = list(range(1, min(forecast_days, POOLED_HORIZON) + 1))

    series_by_sku: Dict[str, pd.Series] = {}
    meta_by_sku: Dict[str, Dict[str, Any]] = {}
    for item in items:
        pid = item.get("product_id")
        if not pid:
            continue
        price = float(item.get("unit_price") or 0.0)
        cost = float(item.get("cost_price") or 0.0)
        margin = ((price - cost) / price) if price > 0 and cost > 0 else 0.0
        meta_by_sku[pid] = {
            "category": item.get("category", "General"),
            "unit_price": price,
            "margin_pct": margin,
            "name": item.get("product_name", "Product"),
        }
        series = _series_from_item(item, end_date)
        if not series.empty:
            series_by_sku[pid] = series

    category_mean = _category_rates(series_by_sku, meta_by_sku)

    pooled_metrics: Dict[str, Any] = {}
    pooled_model = None
    feature_cols: List[str] = []

    if series_by_sku and registry is not None:
        supervised, feature_cols = _pooled_rows(
            series_by_sku, meta_by_sku, horizons, category_mean
        )
        if not supervised.empty and len(supervised) >= 100:
            fingerprint = registry.fingerprint(
                store_id,
                "demand",
                len(series_by_sku),
                round(float(sum(s.sum() for s in series_by_sku.values())), 2),
                str(max(s.index[-1] for s in series_by_sku.values())),
            )

            all_values = np.concatenate([s.to_numpy(dtype=float) for s in series_by_sku.values()])

            def fold_fit_predict(X_train, y_train, X_test):
                model = _make_pooled_model()
                model.fit(X_train, y_train)
                return model.predict(X_test)

            def trainer() -> ModelArtifact:
                backtest = walk_forward_evaluate(
                    supervised=supervised,
                    feature_cols=feature_cols,
                    fit_predict=fold_fit_predict,
                    series_values=all_values,
                    n_folds=BACKTEST_FOLDS,
                    min_train_origins=MIN_TRAIN_DAYS,
                    seasonality=POOLED_SEASONALITY,
                    naive_values=supervised["naive_ref"].to_numpy(dtype=float),
                    scale_values=all_values,
                )
                model = _make_pooled_model()
                model.fit(
                    supervised[feature_cols].to_numpy(dtype=float),
                    supervised["y"].to_numpy(dtype=float),
                )
                return ModelArtifact(
                    store_id=store_id,
                    model_name=MODEL_NAME,
                    fingerprint="",
                    trained_at=utc_now_iso(),
                    n_samples=int(len(supervised)),
                    metrics={
                        "backtest": backtest,
                        "confidence": confidence_from_metrics(backtest.get("model", {})),
                        "n_skus": len(series_by_sku),
                    },
                    payload={"model": model, "feature_cols": feature_cols},
                )

            artifact = registry.get_or_train(store_id, MODEL_NAME, fingerprint, trainer)
            pooled_model = artifact.payload["model"]
            feature_cols = artifact.payload["feature_cols"]
            pooled_metrics = artifact.metrics

    results: Dict[str, Dict[str, Any]] = {}

    # Every requested SKU gets a row. A product that has never sold is a real
    # answer — zero velocity — not a missing one, and omitting it would drop it
    # from the reorder screen entirely.
    for pid, meta in meta_by_sku.items():
        series = series_by_sku.get(pid)
        if series is None:
            results[pid] = {
                "daily_velocity": 0.0,
                "daily_std": 0.0,
                "method": "no_sales_history",
                "n_observations": 0,
                "density": 0.0,
                "history_days": 0,
                "croston_n_demands": 0,
                "demand_basis": "no_history",
            }
            continue

        values = series.to_numpy(dtype=float)
        density = float((values > 0).mean())
        n_obs = int((values > 0).sum())

        croston = croston_sba(values)
        use_pooled = (
            pooled_model is not None
            and density >= DEMAND_DENSE_THRESHOLD
            and n_obs >= MIN_DEMAND_OBSERVATIONS
            and len(series) >= MIN_TRAIN_DAYS
        )

        if use_pooled:
            try:
                velocity, std, method = _pooled_forecast(
                    pooled_model,
                    feature_cols,
                    series,
                    meta,
                    horizons,
                    category_mean,
                )
            except Exception:
                velocity, std, method = croston["rate"], croston["std"], "croston_sba"
        else:
            velocity, std = croston["rate"], croston["std"]
            method = "croston_sba"

        if n_obs < MIN_DEMAND_OBSERVATIONS and velocity > 0:
            method = f"{method} (low_confidence)"

        results[pid] = {
            "daily_velocity": round(float(velocity), 4),
            "daily_std": round(float(std), 4),
            "method": method,
            "n_observations": n_obs,
            "density": round(density, 3),
            "history_days": int(len(series)),
            "croston_n_demands": croston["n_demands"],
            "demand_basis": "measured_from_sales_history" if n_obs else "no_history",
        }

    if pooled_metrics:
        for payload in results.values():
            payload["pooled_model"] = {
                "n_samples": pooled_metrics.get("n_skus"),
                "confidence": pooled_metrics.get("confidence"),
            }

    return results


def _pooled_forecast(
    model,
    feature_cols: Sequence[str],
    series: pd.Series,
    meta: Dict[str, Any],
    horizons: Sequence[int],
    category_mean: Dict[str, float],
) -> Tuple[float, float, str]:
    """Predict mean daily units for one SKU using the pooled model."""
    values = series.to_numpy(dtype=float)
    n = len(values)
    last_date = series.index[-1]

    cal = calendar_features(pd.DatetimeIndex(series.index))
    cal_cols = list(cal.columns)

    base = {}
    for col in cal_cols:
        base[col] = cal[col].iloc[-1]
    base["lag_1"] = values[-1]
    base["lag_7"] = values[-7] if n >= 7 else values[-1]
    base["roll_mean_7"] = float(np.mean(values[-7:]))
    base["roll_mean_14"] = float(np.mean(values[-14:]))
    base["sku_density"] = float((values > 0).mean())
    # Must match how the training frame encoded the category, or the model is
    # served a feature it never saw in this form.
    base["category_rate"] = category_mean.get(meta.get("category", "General"), 0.0)
    base["unit_price"] = meta.get("unit_price", 0.0)
    base["margin_pct"] = meta.get("margin_pct", 0.0)

    rows = []
    for horizon in horizons:
        target_date = last_date + pd.Timedelta(days=int(horizon))
        row = dict(base)
        target_cal = calendar_features(pd.DatetimeIndex([target_date]))
        for col in cal_cols:
            row[col] = target_cal[col].iloc[0]
        row["horizon"] = float(horizon)
        rows.append(row)

    frame = pd.DataFrame(rows).reindex(columns=list(feature_cols))
    preds = np.clip(model.predict(frame.to_numpy(dtype=float)), 0.0, None)

    velocity = float(np.mean(preds)) if preds.size else 0.0
    residual_std = float(np.std(preds)) if preds.size > 1 else 0.0
    # Combine model dispersion with the series' own variability so a flat
    # prediction does not imply zero uncertainty.
    empirical_std = float(np.std(values))
    std = float(math.sqrt(residual_std**2 + empirical_std**2))
    return velocity, std, "pooled_gbm"
