"""Executive Recommendations & Insights FastAPI Route."""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.recommendation_schema import RecommendationsResponse
from app.services.recommendation_service import RecommendationService

router = APIRouter(tags=["Executive Recommendations"])


class RecommendationsRequest(BaseModel):
    store_id: Optional[str] = "store_dwdm_001"
    days: Optional[int] = 14


@router.post("/recommendations", response_model=RecommendationsResponse)
def get_recommendations(payload: Optional[RecommendationsRequest] = None, days: Optional[int] = 14):
    """Synthesizes all model predictions and deterministic business rules into prioritized recommendations."""
    try:
        target_store = payload.store_id if payload else "store_dwdm_001"
        target_days = payload.days if payload and payload.days else (days or 14)
        res = RecommendationService.generate_recommendations(
            store_id=target_store, days=target_days
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation engine error: {str(e)}")
