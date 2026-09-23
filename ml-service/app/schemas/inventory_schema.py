from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InventoryItemInput(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = "General"
    current_stock: float
    predicted_demand: float
    safety_stock: Optional[float] = 15.0
    reorder_level: Optional[float] = 20.0
    cost_price: Optional[float] = 0.0


class InventoryRequirementRequest(BaseModel):
    items: List[InventoryItemInput]
    store_id: Optional[str] = "store_dwdm_001"


class InventoryItemEvaluation(BaseModel):
    product_id: str
    product_name: str
    category: str
    current_stock: float
    predicted_demand: float
    safety_stock: float
    reorder_level: float
    shortage: float
    decision: str  # RESTOCK, OVERSTOCK, STOCK_SUFFICIENT
    recommended_quantity: float
    estimated_cost: float
    urgency: str
    reason: str


class InventoryRequirementResponse(BaseModel):
    status: str = "success"
    total_evaluated: int
    restock_count: int
    overstock_count: int
    sufficient_count: int
    total_capital_required: float
    evaluations: List[InventoryItemEvaluation]
