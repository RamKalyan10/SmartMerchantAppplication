from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProfitForecastRequest(BaseModel):
    days: int = Field(default=30, ge=1, le=90)
    store_id: Optional[str] = "store_dwdm_001"


class ProfitForecastResponse(BaseModel):
    status: str = "success"
    days: int
    predicted_revenue: float
    predicted_cogs: float
    predicted_expense: float
    predicted_gross_profit: float
    predicted_net_profit: float
    profit_margin_pct: float
    profit_growth_percentage: float
    confidence_status: str
    message: Optional[str] = None


class RecommendationItem(BaseModel):
    id: str
    priority: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str  # INVENTORY, EXPENSE, SALES, CATALOG, PROFIT
    title: str
    recommendation: str
    reason: str
    expected_impact: str
    action_type: str  # RESTOCK, REVIEW_EXPENSE, PROMOTION, ADJUST_PRICE


class RecommendationsResponse(BaseModel):
    status: str = "success"
    store_id: str
    generated_at: str
    total_recommendations: int
    profit_forecast: ProfitForecastResponse
    recommendations: List[RecommendationItem]
    critical_alerts: List[str]
