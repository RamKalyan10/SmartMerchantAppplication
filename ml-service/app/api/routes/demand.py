"""Product Demand Forecasting FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.demand_schema import DemandPredictionRequest, DemandPredictionResponse
from app.services.prediction_service import get_prediction_service

router = APIRouter(tags=["Demand Forecasting"])


@router.post("/predict/demand", response_model=DemandPredictionResponse)
@router.post("/demand/predict", response_model=DemandPredictionResponse, include_in_schema=False)
def predict_demand(payload: DemandPredictionRequest):
    """Predict item-level consumer demand volume and shortages using XGBoost."""
    try:
        service = get_prediction_service()
        res = service.predict_demand(days=payload.days, store_id=payload.store_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demand prediction error: {str(e)}")
