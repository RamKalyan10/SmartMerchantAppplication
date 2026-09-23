"""Profit Forecasting FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.recommendation_schema import (
    ProfitForecastRequest,
    ProfitForecastResponse,
)
from app.services.profit_service import ProfitService

router = APIRouter(tags=["Profit Forecasting"])


@router.post("/predict/profit", response_model=ProfitForecastResponse)
def forecast_profit(payload: ProfitForecastRequest):
    """Computes deterministic profit forecast combining predicted revenue, COGS, and operating expenses."""
    try:
        res = ProfitService.forecast_profit(days=payload.days, store_id=payload.store_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profit forecast error: {str(e)}")
