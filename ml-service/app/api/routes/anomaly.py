"""Expense Anomaly Detection FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.expense_schema import ExpenseAnomalyRequest, ExpenseAnomalyResponse
from app.services.prediction_service import get_prediction_service

router = APIRouter(tags=["Expense Anomaly Detection"])


@router.post("/predict/anomaly", response_model=ExpenseAnomalyResponse)
@router.post("/expense/anomalies", response_model=ExpenseAnomalyResponse, include_in_schema=False)
def detect_expense_anomalies(payload: ExpenseAnomalyRequest):
    """Detect unusual cost spikes and fraudulent billing anomalies using Isolation Forest."""
    try:
        service = get_prediction_service()
        res = service.detect_expense_anomalies(store_id=payload.store_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")
