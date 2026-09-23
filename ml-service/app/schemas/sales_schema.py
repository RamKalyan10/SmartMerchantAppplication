from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HistoricalSalesPoint(BaseModel):
    date: str
    amount: float


class SalesPredictionRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=90, description="Forecasting horizon in days")
    store_id: Optional[str] = Field(default="store_dwdm_001")
    history: Optional[List[HistoricalSalesPoint]] = None


class DailySalesForecastItem(BaseModel):
    date: str
    predicted_sales: float
    lower_bound: float
    upper_bound: float
    tag: Optional[str] = "XGBoost Forecast"


class SalesPredictionResponse(BaseModel):
    status: str = "success"
    model: str = "xgboost"
    model_version: str = "1.0.0"
    forecast_days: int
    total_forecasted_sales: float
    trend_percentage: float
    daily_forecasts: List[DailySalesForecastItem]
    confidence_status: str
    confidence: float
    historical_data_points: int
    message: Optional[str] = None
