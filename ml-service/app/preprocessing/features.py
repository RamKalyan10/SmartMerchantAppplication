"""Feature engineering for the sales forecaster.

Two rules govern this module:

1. **Every target-derived feature is shifted.** ``lag_k`` and ``roll_*`` are all
   computed from ``y.shift(1)`` and earlier, so no feature at origin ``t`` can
   contain ``y[t]`` — let alone the ``y[t+h]`` being predicted. The previous
   implementation computed ``amount.rolling(7).mean()`` unshifted while
   regressing on ``amount``, which handed the model its own answer.

2. **Calendar features are computed for the *target* date**, since the calendar
   is known in advance. This is legitimate: we know what day next Tuesday is,
   we just don't know its revenue.
"""

from typing import Dict, List, Sequence, Tuple

import numpy as np
import pandas as pd

from app.preprocessing.calendar import get_festival_info

DAYS_PER_YEAR = 365.25


def calendar_features(dates: pd.DatetimeIndex) -> pd.DataFrame:
    """Features derivable from a date alone, with no reference to sales."""
    dates = pd.DatetimeIndex(dates)
    dow = np.asarray(dates.dayofweek)
    dom = np.asarray(dates.day)
    doy = np.asarray(dates.dayofyear)
    month = np.asarray(dates.month)

    out = pd.DataFrame(index=range(len(dates)))
    out["dow"] = dow
    out["dom"] = dom
    out["month"] = month
    out["is_sunday"] = (dow == 6).astype(int)
    out["is_saturday"] = (dow == 5).astype(int)
    out["is_weekend"] = (dow >= 5).astype(int)
    out["is_peak_workday"] = np.isin(dow, [1, 2, 3]).astype(int)

    # Weekly seasonality — two harmonics capture the weekend/weekday shape.
    angle_w = 2.0 * np.pi * dow / 7.0
    out["sin_week_1"] = np.sin(angle_w)
    out["cos_week_1"] = np.cos(angle_w)
    out["sin_week_2"] = np.sin(2.0 * angle_w)
    out["cos_week_2"] = np.cos(2.0 * angle_w)

    # Annual seasonality.
    angle_y = 2.0 * np.pi * doy / DAYS_PER_YEAR
    out["sin_year_1"] = np.sin(angle_y)
    out["cos_year_1"] = np.cos(angle_y)
    out["sin_year_2"] = np.sin(2.0 * angle_y)
    out["cos_year_2"] = np.cos(2.0 * angle_y)

    fest = [get_festival_info(d) for d in dates]
    out["is_special_day"] = np.array([1 if f[0] else 0 for f in fest], dtype=int)
    out["festival_multiplier"] = np.array([f[1] for f in fest], dtype=float)

    return out


def origin_features(y: pd.Series, lags: Sequence[int], rolls: Sequence[int]) -> pd.DataFrame:
    """Lag and rolling features, all strictly behind origin ``t``."""
    n = len(y)
    out = pd.DataFrame(index=range(n))
    values = y.to_numpy(dtype=float)

    for lag in lags:
        shifted = np.full(n, np.nan)
        if lag < n:
            shifted[lag:] = values[:-lag]
        out[f"lag_{lag}"] = shifted

    # Everything below is built on yesterday-and-earlier only.
    base = pd.Series(y.shift(1).to_numpy(dtype=float))
    for window in rolls:
        out[f"roll_mean_{window}"] = base.rolling(window, min_periods=1).mean().to_numpy()
        out[f"roll_std_{window}"] = base.rolling(window, min_periods=2).std().to_numpy()

    # Normalised so it stays in [0, 1]; tree models cannot extrapolate a raw
    # index beyond its training range, so this saturates rather than explodes.
    out["trend"] = np.arange(n, dtype=float) / max(n - 1, 1)
    return out


def build_supervised(
    series: pd.DataFrame,
    horizons: Sequence[int],
    lags: Sequence[int],
    rolls: Sequence[int],
    target: str = "amount",
) -> Tuple[pd.DataFrame, List[str]]:
    """Expand a daily series into direct multi-horizon training rows.

    Each row pairs features observed at origin ``t`` with the value at
    ``t + horizon``. Training one model over all horizons (rather than
    recursing on its own predictions) is what keeps multi-step error from
    compounding.

    Returns ``(frame, feature_columns)`` where ``frame`` carries ``y``,
    ``horizon``, ``origin_idx`` and ``target_date`` alongside the features.
    """
    if series.empty or target not in series.columns:
        return pd.DataFrame(), []

    origins = series.index
    n = len(series)
    cal_cols = list(calendar_features(origins[:1]).columns)

    base = origin_features(series[target], lags, rolls)
    origin_cols = list(base.columns)

    frames = []
    for horizon in horizons:
        target_dates = origins + pd.Timedelta(days=int(horizon))
        block = base.copy()
        cal = calendar_features(target_dates)
        for col in cal_cols:
            block[col] = cal[col].to_numpy()
        block["horizon"] = float(horizon)
        block["y"] = series[target].shift(-int(horizon)).to_numpy()
        block["origin_idx"] = np.arange(n)
        block["target_date"] = target_dates
        frames.append(block)

    combined = pd.concat(frames, ignore_index=True)

    feature_cols = origin_cols + cal_cols + ["horizon"]
    combined = combined.dropna(subset=["y"] + feature_cols)
    return combined.reset_index(drop=True), feature_cols


def features_for_origin(
    series: pd.DataFrame,
    origin_idx: int,
    horizons: Sequence[int],
    lags: Sequence[int],
    rolls: Sequence[int],
    target: str = "amount",
) -> pd.DataFrame:
    """Build the feature rows needed to forecast ``horizons`` from one origin.

    Used at serving time: the origin is the final observed day and its lag and
    rolling features are real history, not model output.
    """
    origins = series.index
    n = len(series)
    if origin_idx < 0:
        origin_idx = n + origin_idx

    base = origin_features(series[target], lags, rolls).iloc[[origin_idx]]

    rows = []
    for horizon in horizons:
        target_dates = origins[origin_idx : origin_idx + 1] + pd.Timedelta(days=int(horizon))
        cal = calendar_features(target_dates)
        row = base.copy()
        for col in cal.columns:
            row[col] = cal[col].to_numpy()
        row["horizon"] = float(horizon)
        rows.append(row)
    return pd.concat(rows, ignore_index=True)
