"""Daily series construction.

The single most important job here is **zero-filling calendar gaps**. Invoice
records only exist for days the store made a sale, so a naive sort-and-shift
treats consecutive *invoices* as consecutive *days* — which silently corrupts
every lag and rolling feature. Reindexing onto a complete calendar range makes
``shift(1)`` mean "yesterday" again.
"""

from typing import Any, Dict, List, Optional, Sequence

import numpy as np
import pandas as pd


def build_daily_series(
    records: Sequence[Dict[str, Any]],
    date_field: str = "date",
    value_fields: Sequence[str] = ("amount",),
    fill_missing: bool = True,
) -> pd.DataFrame:
    """Aggregate dated records into a complete daily series.

    Returns a frame indexed by a gap-free ``DatetimeIndex`` with one column per
    entry in ``value_fields``. Missing calendar days are filled with 0.0, which
    is the correct value for daily revenue (the store simply sold nothing).
    """
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    if date_field not in df.columns:
        return pd.DataFrame()

    df[date_field] = pd.to_datetime(df[date_field], errors="coerce")
    df = df.dropna(subset=[date_field])
    if df.empty:
        return pd.DataFrame()

    keep = [c for c in value_fields if c in df.columns]
    if not keep:
        return pd.DataFrame()

    for col in keep:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # Multiple invoices on the same day collapse into one daily total.
    grouped = df.groupby(df[date_field].dt.normalize())[keep].sum()

    if fill_missing and len(grouped) > 1:
        full_range = pd.date_range(grouped.index.min(), grouped.index.max(), freq="D")
        grouped = grouped.reindex(full_range, fill_value=0.0)

    grouped.index.name = "date"
    return grouped.sort_index()


def insufficient_data(
    model: str,
    n_available: int,
    n_required: int,
    unit: str = "days",
    detail: Optional[str] = None,
) -> Dict[str, Any]:
    """Standard payload for 'this store cannot be modelled honestly yet'."""
    payload: Dict[str, Any] = {
        "status": "insufficient_data",
        "model": model,
        "n_available": int(n_available),
        "n_required": int(n_required),
        "unit": unit,
        "message": (
            f"Needs at least {n_required} {unit} of history to train; "
            f"this store has {n_available}."
        ),
    }
    if detail:
        payload["detail"] = detail
    return payload


def has_sufficient_history(df: pd.DataFrame, min_days: int) -> bool:
    return not df.empty and len(df) >= min_days


def gap_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """Diagnostics describing how sparse the raw history is.

    Reported alongside forecasts so a caller can see how much of the series
    was zero-filled rather than observed.
    """
    if df.empty:
        return {"n_days": 0, "observed_days": 0, "filled_days": 0, "density": 0.0}
    observed = int((df.select_dtypes(include=[np.number]).abs().sum(axis=1) > 0).sum())
    return {
        "n_days": int(len(df)),
        "observed_days": observed,
        "filled_days": int(len(df) - observed),
        "density": round(observed / len(df), 3) if len(df) else 0.0,
    }
