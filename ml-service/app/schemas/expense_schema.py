from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExpenseCategoryBreakdown(BaseModel):
    category: str
    predicted_amount: float
    percentage: float


class ExpensePredictionRequest(BaseModel):
    forecast_months: int = Field(default=1, ge=1, le=12)
    store_id: Optional[str] = "store_dwdm_001"


class ExpensePredictionResponse(BaseModel):
    status: str = "success"
    model: str = "xgboost"
    model_version: str = "1.0.0"
    forecast_months: int
    total_predicted_expense: float
    category_breakdown: List[ExpenseCategoryBreakdown]
    confidence_status: str
    confidence: float
    message: Optional[str] = None


class ExpenseRecordInput(BaseModel):
    id: Optional[str] = None
    date: str
    category: str
    amount: float
    vendor: Optional[str] = None
    description: Optional[str] = None


class ExpenseAnomalyRequest(BaseModel):
    store_id: Optional[str] = "store_dwdm_001"
    expenses: Optional[List[ExpenseRecordInput]] = None


class ExpenseAnomalyItem(BaseModel):
    id: Optional[str] = None
    date: str
    category: str
    amount: float
    is_anomaly: bool
    status: str  # ANOMALY or NORMAL
    severity: str  # HIGH, MEDIUM, LOW, NONE
    anomaly_score: float
    expected_range: Optional[Dict[str, float]] = None
    message: str


class ExpenseAnomalyResponse(BaseModel):
    status: str = "success"
    model: str = "isolation_forest"
    model_version: str = "1.0.0"
    total_anomalies_detected: int
    anomalies: List[ExpenseAnomalyItem]
    message: Optional[str] = None
