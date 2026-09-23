"""Sales Forecasting FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.sales_schema import SalesPredictionRequest, SalesPredictionResponse
from app.services.prediction_service import get_prediction_service

router = APIRouter(tags=["Sales Forecasting"])


@router.post("/predict/sales", response_model=SalesPredictionResponse)
@router.post("/sales/predict", response_model=SalesPredictionResponse, include_in_schema=False)
def predict_sales(payload: SalesPredictionRequest):
    """Predict future sales revenue using trained XGBoost regression model."""
    try:
        service = get_prediction_service()
        res = service.predict_sales(days=payload.days, store_id=payload.store_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sales prediction error: {str(e)}")
