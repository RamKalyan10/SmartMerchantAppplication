"""Model introspection.

Surfaces what the service actually trained, when, on how much data, and how
accurately it backtested. This is the endpoint that makes the reported
confidence auditable instead of a number someone typed.
"""

from typing import Any, Dict

from fastapi import APIRouter, Query

from app.config import (
    ARTIFACTS_DIR,
    DEFAULT_SERVICE_LEVEL,
    MODEL_TTL_HOURS,
    SALES_HORIZON,
)
from app.core.registry import get_registry, runtime_info
from app.models.schemas import ModelMetricsResponse
from app.training.trainer import min_sales_days

router = APIRouter(tags=["Model Registry"])


@router.get("/metrics", response_model=ModelMetricsResponse)
def model_metrics() -> Dict[str, Any]:
    """Backtest metrics and provenance for every model currently cached."""
    registry = get_registry()
    models = registry.describe()

    summary = []
    for info in models:
        backtest = (info.get("metrics") or {}).get("backtest") or {}
        summary.append(
            {
                "store_id": info.get("store_id"),
                "model": info.get("model"),
                "trained_at": info.get("trained_at"),
                "n_samples": info.get("n_samples"),
                "confidence": (info.get("metrics") or {}).get("confidence"),
                "model_mae": (backtest.get("model") or {}).get("mae"),
                "model_rmse": (backtest.get("model") or {}).get("rmse"),
                "model_smape": (backtest.get("model") or {}).get("smape"),
                "model_mase": (backtest.get("model") or {}).get("mase"),
                "baseline_mase": (backtest.get("baseline_seasonal_naive") or {}).get(
                    "mase"
                ),
                "skill_vs_naive": backtest.get("skill_vs_naive"),
                "beats_naive": backtest.get("beats_naive"),
                "backtest_folds": backtest.get("folds"),
                "n_test_points": backtest.get("n_test_points"),
                "per_horizon": backtest.get("per_horizon"),
                "runtime": info.get("runtime"),
            }
        )
    summary.sort(key=lambda row: (str(row.get("store_id")), str(row.get("model"))))

    return {
        "models": summary,
        "service": {
            "runtime": runtime_info(),
            "n_models_cached": len(models),
            "artifacts_dir": str(ARTIFACTS_DIR),
            "model_ttl_hours": MODEL_TTL_HOURS,
            "min_sales_history_days": min_sales_days(),
            "sales_horizon_days": SALES_HORIZON,
            "default_service_level": DEFAULT_SERVICE_LEVEL,
        },
    }


@router.post("/models/refresh")
def refresh_models(store_id: str = Query(..., description="Store whose models to drop")):
    """Force the next request for a store to retrain.

    Useful after a data correction — otherwise a content fingerprint only
    changes when the underlying series does.
    """
    removed = get_registry().invalidate(store_id)
    return {"store_id": store_id, "artifacts_removed": removed}
