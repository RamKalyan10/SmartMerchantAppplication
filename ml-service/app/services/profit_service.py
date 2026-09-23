"""Profit Forecasting Service — Deterministic financial calculation blending sales & expense predictions."""

from typing import Any, Dict

from app.config.settings import settings
from app.services.prediction_service import get_prediction_service


class ProfitService:
    @staticmethod
    def forecast_profit(
        days: int = 30, store_id: str = settings.DEFAULT_STORE_ID
    ) -> Dict[str, Any]:
        pred_service = get_prediction_service()

        # 1. Sales revenue prediction
        sales_res = pred_service.predict_sales(days=days, store_id=store_id)
        predicted_revenue = float(sales_res.get("total_forecasted_sales") or 0.0)

        # 2. Operating expenses prediction
        forecast_months = max(1, round(days / 30.0))
        expense_res = pred_service.predict_expenses(
            forecast_months=forecast_months, store_id=store_id
        )
        predicted_expense = float(expense_res.get("total_predicted_expense") or 0.0)

        # 3. Estimated Cost of Goods Sold (typical grocery retail COGS ~74-78%)
        predicted_cogs = round(predicted_revenue * 0.76, 2)
        predicted_gross_profit = round(predicted_revenue - predicted_cogs, 2)

        # 4. Net Profit calculation: Gross Profit - Operational Expenses
        predicted_net_profit = round(predicted_gross_profit - predicted_expense, 2)
        margin_pct = (
            round((predicted_net_profit / predicted_revenue) * 100, 2)
            if predicted_revenue > 0
            else 0.0
        )

        # 5. Baseline comparison
        recent_revenue_est = predicted_revenue * 0.94  # approx 6% growth
        recent_profit_est = max(100.0, (recent_revenue_est * 0.24) - predicted_expense)
        growth_pct = round(
            ((predicted_net_profit - recent_profit_est) / max(1.0, abs(recent_profit_est)))
            * 100,
            1,
        )

        return {
            "status": "success",
            "days": days,
            "predicted_revenue": round(predicted_revenue, 2),
            "predicted_cogs": predicted_cogs,
            "predicted_expense": round(predicted_expense, 2),
            "predicted_gross_profit": predicted_gross_profit,
            "predicted_net_profit": predicted_net_profit,
            "profit_margin_pct": margin_pct,
            "profit_growth_percentage": growth_pct,
            "confidence_status": sales_res.get("confidence_status", "NORMAL"),
            "message": f"Projected net profit of ₹{predicted_net_profit:,.0f} over next {days} days.",
        }
