"""Backwards-compatible alias for :mod:`app.training.expense_model`.

The expense forecaster moved into ``training/`` alongside the other models, so
that every estimator lives in one place. The old function name is kept as a
thin re-export for any caller still importing it, and it now returns the real
model output rather than the hardcoded SME baseline distribution this module
used to serve when history was absent.
"""

from typing import Any, Dict, List, Optional

from app.training.expense_model import forecast_expenses


def forecast_expenses_by_category(
    history: Optional[List[Dict[str, Any]]] = None,
    forecast_months: int = 1,
) -> Dict[str, Any]:
    return forecast_expenses(history, forecast_months=forecast_months)
