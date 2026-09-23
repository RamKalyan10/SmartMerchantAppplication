"""Walk-forward (expanding window) validation.

Split discipline matters here. The model is *direct multi-horizon*: a row with
origin ``t`` predicts ``t + horizon``. So splitting naively on origin index
would let training rows whose targets fall inside the test window leak into
training. Every fold therefore trains only on rows whose **target index**
strictly precedes the test window.
"""

from typing import Any, Callable, Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

from app.evaluation.metrics import summarize


def expanding_splits(
    origin_values: Sequence[int],
    n_folds: int,
    min_train_origins: int,
) -> List[tuple]:
    """Expanding-window fold boundaries as ``(test_start, test_end)`` inclusive."""
    values = np.asarray(sorted(origin_values))
    n = len(values)
    if n <= min_train_origins or n_folds < 1:
        return []

    available = n - min_train_origins
    fold_size = max(1, available // n_folds)

    splits = []
    for k in range(n_folds):
        start_pos = min_train_origins + k * fold_size
        if start_pos >= n:
            break
        end_pos = n if k == n_folds - 1 else min(n, start_pos + fold_size)
        if end_pos <= start_pos:
            break
        splits.append((int(values[start_pos]), int(values[end_pos - 1])))
    return splits


def walk_forward_evaluate(
    supervised: pd.DataFrame,
    feature_cols: Sequence[str],
    fit_predict: Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray],
    series_values: np.ndarray,
    n_folds: int,
    min_train_origins: int,
    seasonality: int = 7,
    naive_values: Optional[np.ndarray] = None,
    scale_values: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """Evaluate ``fit_predict`` against a seasonal-naive baseline.

    ``fit_predict(X_train, y_train, X_test) -> predictions`` is called once per
    fold and must train from scratch — no state carried between folds.

    ``series_values`` is the raw daily target array indexed by origin position,
    used to look up seasonal-naive reference values.

    ``naive_values`` overrides that lookup with a per-row reference for frames
    that pool several series (e.g. many SKUs). In a pooled frame ``origin_idx``
    restarts at 0 for every series, so a positional lookup would read the
    reference from a *different* series and produce a meaningless baseline.

    ``scale_values`` supplies the series used to compute the MASE denominator;
    pooled models use the whole population rather than one member of it.
    """
    if supervised.empty:
        return {"folds": 0, "error": "no training rows"}

    origin_vals = supervised["origin_idx"].unique()
    splits = expanding_splits(origin_vals, n_folds, min_train_origins)
    if not splits:
        return {
            "folds": 0,
            "error": "not enough history for walk-forward validation",
            "n_origins": int(len(origin_vals)),
            "min_train_origins": int(min_train_origins),
        }

    X_all = supervised[feature_cols].to_numpy(dtype=float)
    origin_arr = supervised["origin_idx"].to_numpy()
    horizon_arr = supervised["horizon"].to_numpy().astype(int)
    y_arr = supervised["y"].to_numpy(dtype=float)
    target_idx = origin_arr + horizon_arr

    naive_source = None
    if naive_values is not None:
        candidate = np.asarray(naive_values, dtype=float)
        if candidate.shape[0] == len(supervised):
            naive_source = candidate

    true_parts, pred_parts, naive_parts, horizon_parts = [], [], [], []
    fold_reports = []

    for fold_no, (test_start, test_end) in enumerate(splits, start=1):
        train_mask = target_idx < test_start
        test_mask = (origin_arr >= test_start) & (origin_arr <= test_end)

        if train_mask.sum() < 10 or test_mask.sum() == 0:
            continue

        predictions = np.asarray(
            fit_predict(X_all[train_mask], y_arr[train_mask], X_all[test_mask]),
            dtype=float,
        )
        if predictions.shape[0] != int(test_mask.sum()):
            continue

        truth = y_arr[test_mask]
        fold_horizons = horizon_arr[test_mask]

        # Seasonal-naive reference: the value one season before the target.
        if naive_source is not None:
            naive = naive_source[test_mask]
        else:
            naive_lookup = target_idx[test_mask] - seasonality
            naive_lookup = np.where(naive_lookup >= 0, naive_lookup, target_idx[test_mask])
            naive = series_values[naive_lookup]

        valid = np.isfinite(predictions) & np.isfinite(truth) & np.isfinite(naive)
        if not valid.any():
            continue

        y_train_ref = (
            scale_values if scale_values is not None else series_values[: int(test_start)]
        )
        fold_metrics = summarize(truth[valid], predictions[valid], y_train_ref, seasonality)

        fold_reports.append(
            {"fold": fold_no, "test_start": test_start, "test_end": test_end, **fold_metrics}
        )
        true_parts.append(truth[valid])
        pred_parts.append(predictions[valid])
        naive_parts.append(naive[valid])
        horizon_parts.append(fold_horizons[valid])

    if not true_parts:
        return {"folds": 0, "error": "no evaluable folds"}

    y_true = np.concatenate(true_parts)
    y_pred = np.concatenate(pred_parts)
    y_naive = np.concatenate(naive_parts)
    y_horizon = np.concatenate(horizon_parts)

    overall_scale = scale_values if scale_values is not None else series_values
    model_metrics = summarize(y_true, y_pred, overall_scale, seasonality)
    baseline_metrics = summarize(y_true, y_naive, overall_scale, seasonality)

    per_horizon: Dict[str, Dict[str, float]] = {}
    for h in sorted(np.unique(y_horizon)):
        mask = y_horizon == h
        if mask.sum() < 3:
            continue
        per_horizon[str(int(h))] = summarize(y_true[mask], y_pred[mask], overall_scale, seasonality)

    model_mase = model_metrics.get("mase")
    skill = None
    if model_mase is not None and np.isfinite(model_mase):
        skill = round(float(1.0 - model_mase), 3)

    return {
        "folds": len(fold_reports),
        "n_test_points": int(y_true.size),
        "model": model_metrics,
        "baseline_seasonal_naive": baseline_metrics,
        "skill_vs_naive": skill,
        "beats_naive": bool(skill is not None and skill > 0),
        "per_horizon": per_horizon,
        "fold_detail": fold_reports,
    }
