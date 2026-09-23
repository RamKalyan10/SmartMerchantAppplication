from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ResponseBase(BaseModel):
    """Response models allow extra keys.

    Pydantic's default is to *silently drop* undeclared fields on a
    ``response_model``. That is how the previous ``tag`` label — built in the
    trainer, never declared here — vanished before reaching the client. Extra
    keys are permitted so new model detail cannot disappear the same way.
    """

    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------


class HistoricalSaleItem(BaseModel):
    date: str
    amount: float
    order_count: Optional[int] = 1
    quantity: Optional[int] = 1


class SalesPredictRequest(BaseModel):
    days: int = Field(default=7, description="Number of days to forecast")
    history: Optional[List[HistoricalSaleItem]] = None
    store_id: Optional[str] = None


class ForecastPoint(ResponseBase):
    date: str
    predicted_sales: float
    lower_bound: float
    upper_bound: float
    tag: Optional[str] = None


class SalesPredictResponse(ResponseBase):
    # Defaulted rather than required so the ``insufficient_data`` payload — which
    # carries no forecast at all — validates against the same model instead of
    # being rejected by response validation.
    forecast_days: int = 0
    total_forecasted_sales: float = 0.0
    trend_percentage: float = 0.0
    daily_forecasts: List[ForecastPoint] = Field(default_factory=list)
    confidence: float = 0.0
    # Present when the model declines to forecast.
    status: Optional[str] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Demand / inventory
# ---------------------------------------------------------------------------


class SkuSaleRecord(BaseModel):
    """Sparse daily unit sale — only days that actually sold need to be sent."""

    date: str
    units: float


class DemandPredictItem(BaseModel):
    product_id: str
    product_name: str
    category: str
    current_stock: int
    unit_price: float
    cost_price: Optional[float] = None
    historical_sales: Optional[List[float]] = None
    lead_time_days: Optional[int] = 3
    min_stock_level: Optional[int] = None
    # Richer history, preferred when available: preserves real dates.
    sales_history: Optional[List[SkuSaleRecord]] = None


class DemandPredictRequest(BaseModel):
    items: List[DemandPredictItem]
    forecast_days: int = 7
    store_id: Optional[str] = None
    # Store-wide units floor, applied alongside each product's own
    # min_stock_level. Set from the Settings screen.
    min_stock_floor: float = 0.0


class DemandPredictionResult(ResponseBase):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    current_stock: Optional[int] = None
    predicted_demand_units: Optional[int] = None
    projected_shortage: Optional[int] = None
    status: Optional[str] = None
    recommended_order_quantity: Optional[int] = None
    reorder_urgency: Optional[str] = None
    confidence: Optional[float] = None


class DemandPredictResponse(ResponseBase):
    results: List[DemandPredictionResult] = Field(default_factory=list)
    total_shortage_items: int = 0
    status: Optional[str] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


class CatalogClassifyItem(BaseModel):
    product_id: str
    product_name: str
    category: str
    total_units_sold: int
    revenue_generated: float
    last_sale_days_ago: Optional[int] = None
    unit_price: Optional[float] = None
    cost_price: Optional[float] = None
    active_days: Optional[int] = None
    units_last_28d: Optional[float] = None
    units_prior_28d: Optional[float] = None
    stock_turnover_ratio: Optional[float] = None
    days_in_inventory: Optional[int] = None


class CatalogClassifyRequest(BaseModel):
    products: List[CatalogClassifyItem]
    observation_days: int = Field(
        default=30,
        description="Real span of the sales window in days. Callers must compute "
        "this from data; a hardcoded constant silently disables time normalisation.",
    )
    store_id: Optional[str] = None


class CatalogClassifyResult(ResponseBase):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    classification: Optional[str] = None
    recommendation: Optional[str] = None
    action_priority: Optional[str] = None


class CatalogClassifyResponse(ResponseBase):
    classifications: List[CatalogClassifyResult] = Field(default_factory=list)
    summary: Dict[str, int] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------


class ExpenseRecord(BaseModel):
    id: Optional[str] = None
    date: str
    category: str
    amount: float
    description: Optional[str] = ""


class ExpensePredictRequest(BaseModel):
    history: Optional[List[ExpenseRecord]] = None
    forecast_months: int = 1
    store_id: Optional[str] = None


class ExpenseAnomalyRequest(BaseModel):
    expenses: List[ExpenseRecord]
    store_id: Optional[str] = None
    # Sensitivity control from the Settings screen. Clamped server-side.
    z_threshold: Optional[float] = None


class AnomalyResult(ResponseBase):
    id: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    expected_range: Optional[str] = None
    anomaly_score: Optional[float] = None
    is_anomaly: bool = False
    reason: Optional[str] = None


class ExpenseAnomalyResponse(ResponseBase):
    anomalies: List[AnomalyResult] = Field(default_factory=list)
    total_anomalies_detected: int = 0


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------


class RecommendationAlert(ResponseBase):
    type: str
    severity: str
    title: str
    message: str
    suggested_action: str
    impact_metric: Optional[str] = None


class BusinessSyncPayload(BaseModel):
    sales_history: Optional[List[HistoricalSaleItem]] = None
    products: Optional[List[DemandPredictItem]] = None
    expenses: Optional[List[ExpenseRecord]] = None
    forecast_days: int = 7
    store_id: Optional[str] = None
    # Measured from invoice line items by the caller. Without it, a default
    # retail-margin assumption is applied and flagged as assumed.
    cogs_ratio: Optional[float] = None
    history_days: Optional[int] = None
    # Store preferences that the Settings screen exposes and that the models
    # honour: a units floor on reorder points and an anomaly sensitivity band.
    min_stock_floor: float = 0.0
    z_threshold: Optional[float] = None


class InsightsSummaryResponse(ResponseBase):
    sales_growth_predicted_pct: float = 0.0
    expected_revenue_next_period: float = 0.0
    expected_expense_next_period: float = 0.0
    predicted_net_profit: float = 0.0
    profit_margin_pct: float = 0.0
    critical_alerts: List[RecommendationAlert] = Field(default_factory=list)
    top_recommended_actions: List[str] = Field(default_factory=list)
    expected_cogs: Optional[float] = None
    expected_gross_profit: Optional[float] = None


# ---------------------------------------------------------------------------
# Model metadata
# ---------------------------------------------------------------------------


class ModelMetricsResponse(ResponseBase):
    models: List[Dict[str, Any]] = Field(default_factory=list)
    service: Dict[str, Any] = Field(default_factory=dict)
