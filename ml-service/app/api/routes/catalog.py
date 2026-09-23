"""Catalog Classification FastAPI Route."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prediction_service import get_prediction_service

router = APIRouter(tags=["Catalog Classification"])


class CatalogClassifyRequest(BaseModel):
    store_id: Optional[str] = "store_dwdm_001"


@router.post("/predict/catalog")
@router.post("/catalog/classify", include_in_schema=False)
@router.get("/catalog/classify", include_in_schema=False)
def classify_catalog(payload: Optional[CatalogClassifyRequest] = None):
    """Classify inventory products into demand tiers (HIGH DEMAND, MEDIUM, LOW, SLOW, DEAD STOCK)."""
    try:
        store_id = payload.store_id if payload else "store_dwdm_001"
        service = get_prediction_service()
        res = service.classify_catalog(store_id=store_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Catalog classification error: {str(e)}")
