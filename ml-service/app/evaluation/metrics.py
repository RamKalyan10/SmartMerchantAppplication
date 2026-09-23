"""Forecast accuracy metrics.

MAE and RMSE are scale-dependent and only comparable within one series.
sMAPE is scale-free but unstable near zero. MASE is the primary metric here:
it is scale-free *and* directly interpretable against a naive baseline —
``MASE < 1.0`` means the model beats seasonal-naive on that series.
"""

from typing import Dict, Optional, Sequence

import numpy as np


def _as_array(values) -> np.ndarray:
    arr = np.asarray(values, dtype=float)
    return arr[np.isfinite(arr)]


def mae(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    yt, yp = _as_array(y_true), _as_array(y_pred)
    if yt.size == 0:
        return float("nan")
    return float(np.mean(np.abs(yt - yp)))


def rmse(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    yt, yp = _as_array(y_true), _as_array(y_pred)
    if yt.size == 0:
        return float("nan")
    return float(np.sqrt(np.mean((yt - yp) ** 2)))


def smape(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Symmetric MAPE as a percentage. Zero-denominator pairs are dropped."""
    yt, yp = _as_array(y_true), _as_array(y_pred)
    denom = np.abs(yt) + np.abs(yp)
    mask = denom > 0
    if not mask.any():
        return float("nan")
    return float(np.mean(2.0 * np.abs(yp[mask] - yt[mask]) / denom[mask]) * 100.0)


def seasonal_naive_scale(y_train: Sequence[float], seasonality: int = 7) -> float:
    """Mean absolute seasonal difference of the training series (MASE denominator)."""
    yt = _as_array(y_train)
    if yt.size <= seasonality:
        if yt.size < 2:
            return float("nan")
        return float(np.mean(np.abs(np.diff(yt))))
    return float(np.mean(np.abs(yt[seasonality:] - yt[:-seasonality])))


def mase(
    y_true: Sequence[float],
    y_pred: Sequence[float],
    y_train: Sequence[float],
    seasonality: int = 7,
) -> float:
    """Mean absolute scaled error against an in-sample seasonal-naive baseline."""
    scale = seasonal_naive_scale(y_train, seasonality)
    if not np.isfinite(scale) or scale <= 0:
        return float("nan")
    return mae(y_true, y_pred) / scale


def summarize(
    y_true: Sequence[float],
    y_pred: Sequence[float],
    y_train: Optional[Sequence[float]] = None,
    seasonality: int = 7,
) -> Dict[str, float]:
    """All metrics in one dict. MASE is omitted when no training series is given."""
    out = {
        "mae": mae(y_true, y_pred),
        "rmse": rmse(y_true, y_pred),
        "smape": smape(y_true, y_pred),
        "n": int(_as_array(y_true).size),
    }
    if y_train is not None:
        out["mase"] = mase(y_true, y_pred, y_train, seasonality)
    return out


def naive_baseline_metrics(
    y_true: Sequence[float],
    y_naive: Sequence[float],
    y_train: Sequence[float],
    seasonality: int = 7,
) -> Dict[str, float]:
    """Metrics for the seasonal-naive baseline itself, for side-by-side reporting."""
    return summarize(y_true, y_naive, y_train, seasonality)


def confidence_from_metrics(metrics: Dict[str, float]) -> float:
    """Map backtest accuracy onto a reported confidence in ``[0, 0.99]``.

    Deliberately conservative: this is a *accuracy-derived* score, not a
    probability, and it is capped below 1.0 because no forecast is certain.
    """
    smape_val = metrics.get("smape")
    if smape_val is None or not np.isfinite(smape_val):
        return 0.0
    score = max(0.0, 1.0 - (smape_val / 100.0))
    # Fold in skill vs seasonal-naive: beating the baseline earns the score
    # back, failing to beat it discounts it.
    mase_val = metrics.get("mase")
    if mase_val is not None and np.isfinite(mase_val) and mase_val > 0:
        skill = float(np.clip(1.0 - np.log(mase_val) / np.log(3.0), 0.0, 1.0))
        score = score * (0.5 + 0.5 * skill)
    return round(float(np.clip(score, 0.0, 0.99)), 3)
