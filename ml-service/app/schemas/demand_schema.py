from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProductDemandItemInput(BaseModel):
    product_id: str
    product_name: Optional[str] = ""
    category: Optional[str] = "General"
    current_stock: float = 0.0
    price: Optional[float] = 0.0
    cost_price: Optional[float] = 0.0


class DemandPredictionRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=90)
    store_id: Optional[str] = "store_dwdm_001"
    items: Optional[List[ProductDemandItemInput]] = None


class ProductDemandPredictionItem(BaseModel):
    product_id: str
    product_name: str
    category: str
    current_stock: float
    predicted_demand_units: float
    projected_shortage: float
    recommended_order_quantity: float
    reorder_urgency: str  # Critical, High, Moderate, Low, None
    confidence: float
    status: str


class DemandPredictionResponse(BaseModel):
    status: str = "success"
    model: str = "xgboost"
    model_version: str = "1.0.0"
    forecast_days: int
    results: List[ProductDemandPredictionItem]
    total_shortage_items: int
    confidence_status: str
    message: Optional[str] = None
