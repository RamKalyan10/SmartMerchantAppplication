from typing import Optional

from fastapi import APIRouter, HTTPException

from app.core.registry import get_registry
from app.models.schemas import BusinessSyncPayload, InsightsSummaryResponse
from app.recommendation.business_rules import generate_business_recommendations
from app.recommendation.inventory_rules import compute_inventory_recommendations
from app.training.trainer import (
    detect_expense_anomalies,
    forecast_expenses,
    predict_sales,
)

router = APIRouter(prefix="/insights", tags=["Executive Merchant Insights"])


@router.post("/summary", response_model=InsightsSummaryResponse)
def insights_summary(payload: Optional[BusinessSyncPayload] = None):
    """Combine every model into one executive view.

    The previous version silently substituted three hardcoded sample products
    and four sample expenses whenever the caller sent nothing, so a store with
    no data received confident-looking advice derived from invented inputs.
    Absent inputs now produce an explicit empty result instead.
    """
    try:
        store_id = (payload.store_id if payload else None) or "unknown"
        forecast_days = payload.forecast_days if payload else 7

        sales_history = (
            [h.model_dump() for h in payload.sales_history]
            if payload and payload.sales_history
            else None
        )
        sales_forecast = predict_sales(
            days=forecast_days, history_records=sales_history, store_id=store_id
        )

        products = (
            [p.model_dump() for p in payload.products]
            if payload and payload.products
            else []
        )
        demand_results = (
            compute_inventory_recommendations(
                products,
                forecast_days=forecast_days,
                registry=get_registry(),
                store_id=store_id,
                min_stock_floor=(payload.min_stock_floor if payload else 0.0),
            )
            if products
            else []
        )

        expenses = (
            [e.model_dump() for e in payload.expenses]
            if payload and payload.expenses
            else None
        )
        expense_forecast = forecast_expenses(
            expenses, forecast_months=1, store_id=store_id
        )
        anomalies = (
            detect_expense_anomalies(
                expenses,
                store_id=store_id,
                z_threshold=(payload.z_threshold if payload else None),
            )["anomalies"]
            if expenses
            else []
        )

        summary = generate_business_recommendations(
            sales_forecast=sales_forecast,
            demand_results=demand_results,
            expense_anomalies=anomalies,
            expense_forecast=expense_forecast,
            cogs_ratio=(payload.cogs_ratio if payload else None),
        )
        summary.setdefault("model_info", {}).update(
            {
                "store_id": store_id,
                "demand_items_analysed": len(demand_results),
                "history_days": payload.history_days if payload else None,
                "sales_basis": (
                    "insufficient_data"
                    if sales_forecast.get("status") == "insufficient_data"
                    else "modelled_from_invoice_history"
                ),
                "expense_basis": expense_forecast.get("model_info", {}).get("method"),
            }
        )
        return summary
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Insights summary generation failed: {exc}"
        )
