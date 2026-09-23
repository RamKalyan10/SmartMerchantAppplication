"""Expense Forecasting FastAPI Route."""

from fastapi import APIRouter, HTTPException

from app.schemas.expense_schema import ExpensePredictionRequest, ExpensePredictionResponse
from app.services.prediction_service import get_prediction_service

router = APIRouter(tags=["Expense Forecasting"])


@router.post("/predict/expense", response_model=ExpensePredictionResponse)
@router.post("/expense/predict", response_model=ExpensePredictionResponse, include_in_schema=False)
def predict_expense(payload: ExpensePredictionRequest):
    """Predict operational business expenses by category using XGBoost."""
    try:
        service = get_prediction_service()
        res = service.predict_expenses(
            forecast_months=payload.forecast_months, store_id=payload.store_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Expense prediction error: {str(e)}")
