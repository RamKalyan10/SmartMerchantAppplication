"""
Pydantic schemas for Smart Merchant ML Service API requests and responses.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class SalesDailyHistoryItem(BaseModel):
    date: str
    amount: float = 0.0

class SalesPredictRequest(BaseModel):
    days: int = 7
    history: List[SalesDailyHistoryItem] = Field(default_factory=list)
    store_id: Optional[str] = None

class DemandItemRequest(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = "General"
    current_stock: int = 0
    selling_price: Optional[float] = 0.0
    cost_price: Optional[float] = 0.0
    demand_7_day: Optional[float] = 0.0
    demand_30_day: Optional[float] = 0.0
    average_daily_demand: Optional[float] = 0.0
    discount: Optional[float] = 5.0

class DemandPredictRequest(BaseModel):
    items: List[DemandItemRequest] = Field(default_factory=list)
    forecast_days: int = 7
    store_id: Optional[str] = None
    min_stock_floor: Optional[int] = 10

class CatalogProductRequest(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = "General"
    total_units_sold: Optional[int] = 0
    revenue_generated: Optional[float] = 0.0
    last_sale_days_ago: Optional[int] = None
    unit_price: Optional[float] = 0.0
    cost_price: Optional[float] = None
    active_days: Optional[int] = 0
    units_last_28d: Optional[int] = 0
    units_prior_28d: Optional[int] = 0
    stock_turnover_ratio: Optional[float] = 0.0
    days_in_inventory: Optional[int] = 30
    current_stock: Optional[int] = 0

class CatalogClassifyRequest(BaseModel):
    products: List[CatalogProductRequest] = Field(default_factory=list)
    observation_days: Optional[int] = 30
    store_id: Optional[str] = None

class ExpenseItem(BaseModel):
    id: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = "General"
    amount: float = 0.0
    notes: Optional[str] = None

class ExpensePredictRequest(BaseModel):
    history: List[ExpenseItem] = Field(default_factory=list)
    forecast_months: int = 1
    forecast_days: Optional[int] = None
    store_id: Optional[str] = None

class ExpenseAnomalyRequest(BaseModel):
    expenses: List[ExpenseItem] = Field(default_factory=list)
    store_id: Optional[str] = None
    z_threshold: Optional[float] = 2.0

class ExecutiveInsightsRequest(BaseModel):
    sales_history: List[SalesDailyHistoryItem] = Field(default_factory=list)
    products: List[DemandItemRequest] = Field(default_factory=list)
    expenses: List[ExpenseItem] = Field(default_factory=list)
    forecast_days: int = 7
    store_id: Optional[str] = None
    cogs_ratio: Optional[float] = None
    history_days: Optional[int] = 30
    min_stock_floor: Optional[int] = 10
    z_threshold: Optional[float] = 2.0
