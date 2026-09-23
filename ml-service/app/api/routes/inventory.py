"""Inventory Replenishment Decision Engine FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.inventory_schema import (
    InventoryRequirementRequest,
    InventoryRequirementResponse,
)
from app.services.inventory_service import InventoryService

router = APIRouter(tags=["Inventory Decision Engine"])


@router.post("/predict/inventory", response_model=InventoryRequirementResponse)
@router.post("/inventory/recommend", response_model=InventoryRequirementResponse, include_in_schema=False)
def evaluate_inventory(payload: InventoryRequirementRequest):
    """Applies deterministic inventory logic to demand predictions (RESTOCK, OVERSTOCK, STOCK_SUFFICIENT)."""
    try:
        items_dict = [it.dict() for it in payload.items]
        res = InventoryService.evaluate_batch(items_dict)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inventory rule engine error: {str(e)}")
