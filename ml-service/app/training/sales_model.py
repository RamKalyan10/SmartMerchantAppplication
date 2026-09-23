"""Sales revenue forecasting.

Direct multi-horizon quantile gradient boosting:

* One model per quantile (0.025 / 0.5 / 0.975) with ``horizon`` as a feature,
  trained on ``(features at t) -> y[t+h]`` rows. Because every horizon is
  predicted from *observed* history rather than from the model's own previous
  output, multi-step error does not compound — the failure mode of the
  previous recursive implementation.

* The 95% interval is read straight off the 0.025 and 0.975 models. The
  previous ``pred * (1 +/- (0.07 + step*0.01))`` band was an invented formula
  with no relationship to the data.

* Intervals are ordered explicitly, since quantile regressors can cross.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from app.config import (
    BACKTEST_FOLDS,
    MIN_TRAIN_DAYS,
    SALES_HORIZON,
    SALES_LAGS,
    SALES_QUANTILES,
    SALES_ROLLS,
)
from app.core.registry import ModelArtifact, utc_now_iso
from app.evaluation.backtest import walk_forward_evaluate
from app.evaluation.metrics import confidence_from_metrics
from app.preprocessing.calendar import get_festival_info
from app.preprocessing.features import build_supervised, features_for_origin
from app.preprocessing.series import gap_stats

MODEL_NAME = "sales"


def _make_model(quantile: float) -> HistGradientBoostingRegressor:
    """Shallow, regularised, and deterministic — the dataset is only ~139 days."""
    return HistGradientBoostingRegressor(
        loss="quantile",
        quantile=quantile,
        max_iter=250,
        learning_rate=0.05,
        max_depth=4,
        min_samples_leaf=20,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=42,
    )


def day_tag(dt: datetime) -> str:
    """Human label for a forecast day, driven by the calendar rather than fixed."""
    is_special, multiplier, label = get_festival_info(dt)
    if is_special and multiplier > 1.5:
        return f"🎉 {label}"
    dow = dt.dayofweek
    if dow == 6:
        return "🌟 Sunday Peak Surge"
    if dow == 5:
        return "🛒 Saturday Weekend Restock"
    if dow in (1, 2, 3):
        return "🏢 Workday Run-Rate"
    return "📅 Regular Weekday"


def train(series: pd.DataFrame, store_id: str) -> ModelArtifact:
    """Fit the quantile ensemble and record walk-forward accuracy."""
    horizons = list(range(1, SALES_HORIZON + 1))

    supervised, feature_cols = build_supervised(
        series, horizons=horizons, lags=SALES_LAGS, rolls=SALES_ROLLS
    )
    if supervised.empty:
        raise ValueError("no usable training rows after feature construction")

    series_values = series["amount"].to_numpy(dtype=float)

    def fold_fit_predict(X_train, y_train, X_test):
        model = _make_model(0.5)
        model.fit(X_train, y_train)
        return model.predict(X_test)

    backtest = walk_forward_evaluate(
        supervised=supervised,
        feature_cols=feature_cols,
        fit_predict=fold_fit_predict,
        series_values=series_values,
        n_folds=BACKTEST_FOLDS,
        min_train_origins=MIN_TRAIN_DAYS,
        seasonality=7,
    )

    models: Dict[float, HistGradientBoostingRegressor] = {}
    X_all = supervised[feature_cols].to_numpy(dtype=float)
    y_all = supervised["y"].to_numpy(dtype=float)
    for quantile in SALES_QUANTILES:
        model = _make_model(quantile)
        model.fit(X_all, y_all)
        models[quantile] = model

    confidence = confidence_from_metrics(backtest.get("model", {}))

    payload = {
        "models": models,
        "feature_cols": feature_cols,
        "quantiles": list(SALES_QUANTILES),
        "last_origin_idx": int(len(series) - 1),
        "last_date": series.index[-1].strftime("%Y-%m-%d"),
        "history_tail": [round(float(v), 2) for v in series["amount"].tail(28)],
    }

    return ModelArtifact(
        store_id=store_id,
        model_name=MODEL_NAME,
        fingerprint="",  # set by the registry
        trained_at=utc_now_iso(),
        n_samples=int(len(supervised)),
        metrics={
            "backtest": backtest,
            "confidence": confidence,
            "history": gap_stats(series),
            "horizon_days": SALES_HORIZON,
        },
        payload=payload,
    )


def _order_interval(lower: np.ndarray, point: np.ndarray, upper: np.ndarray):
    """Quantile regressors can cross; enforce lower <= point <= upper."""
    point = np.maximum(point, 0.0)
    lower = np.maximum(lower, 0.0)
    upper = np.maximum(upper, 0.0)
    lower = np.minimum(lower, point)
    upper = np.maximum(upper, point)
    return lower, point, upper


def forecast(artifact: ModelArtifact, series: pd.DataFrame, days: int) -> Dict[str, Any]:
    """Forecast ``days`` ahead from the final observed day of ``series``."""
    payload = artifact.payload
    models = payload["models"]
    feature_cols = payload["feature_cols"]
    trained_horizon = int(artifact.metrics.get("horizon_days", SALES_HORIZON))

    requested = int(days)
    capped = min(requested, trained_horizon)

    horizons = list(range(1, capped + 1))
    features = features_for_origin(
        series,
        origin_idx=-1,
        horizons=horizons,
        lags=SALES_LAGS,
        rolls=SALES_ROLLS,
    )
    features = features.reindex(columns=feature_cols)
    X = features.to_numpy(dtype=float)

    point = models[0.5].predict(X)
    lower = models[SALES_QUANTILES[0]].predict(X)
    upper = models[SALES_QUANTILES[-1]].predict(X)
    lower, point, upper = _order_interval(
        np.asarray(lower, dtype=float),
        np.asarray(point, dtype=float),
        np.asarray(upper, dtype=float),
    )

    last_date = series.index[-1]
    daily: List[Dict[str, Any]] = []
    for i in range(capped):
        target = last_date + pd.Timedelta(days=i + 1)
        daily.append(
            {
                "date": target.strftime("%Y-%m-%d"),
                "predicted_sales": round(float(point[i]), 2),
                "lower_bound": round(float(lower[i]), 2),
                "upper_bound": round(float(upper[i]), 2),
                "tag": day_tag(target),
            }
        )

    total = float(np.sum(point))

    # Compare against the same number of trailing actual days, when available.
    history = series["amount"].to_numpy(dtype=float)
    trend_pct = None
    if len(history) >= capped:
        actual = float(np.sum(history[-capped:]))
        if actual > 0:
            trend_pct = round(((total - actual) / actual) * 100.0, 1)

    return {
        "forecast_days": capped,
        "requested_days": requested,
        "capped_to_trained_horizon": capped < requested,
        "total_forecasted_sales": round(total, 2),
        "trend_percentage": trend_pct if trend_pct is not None else 0.0,
        "trend_basis": (
            f"vs previous {capped} actual days" if trend_pct is not None else "insufficient history"
        ),
        "daily_forecasts": daily,
        "confidence": artifact.metrics.get("confidence", 0.0),
        "model_info": artifact.to_info(),
    }
