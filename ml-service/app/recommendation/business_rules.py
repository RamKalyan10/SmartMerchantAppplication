"""Executive insight synthesis.

The previous version hardcoded COGS at 74% of revenue (a "26% retail margin"
assumption) even though every invoice line item carries a real ``cost_price``.
On this dataset that assumption is simply wrong, and it silently distorted
gross profit, net profit, and every margin the dashboard displayed.

COGS is now taken from the caller's measured ratio when supplied. When it is
not, the fallback ratio is used **and flagged** in ``model_info`` so the number
is never presented as measured when it is assumed.
"""

from typing import Any, Dict, List, Optional

from app.recommendation.inventory_rules import OVERSTOCK_COVER_DAYS

DAYS_PER_MONTH = 30.44
ASSUMED_COGS_RATIO = 0.74


def generate_business_recommendations(
    sales_forecast: Dict[str, Any],
    demand_results: List[Dict[str, Any]],
    expense_anomalies: List[Dict[str, Any]],
    expense_forecast: Dict[str, Any],
    cogs_ratio: Optional[float] = None,
) -> Dict[str, Any]:
    """Combine model outputs into prioritised, actionable guidance."""
    alerts: List[Dict[str, Any]] = []
    actions: List[str] = []

    insufficient = sales_forecast.get("status") == "insufficient_data"

    # --- 1. Revenue ------------------------------------------------------
    if insufficient:
        expected_revenue = 0.0
        growth_pct = 0.0
        alerts.append(
            {
                "type": "SALES",
                "severity": "info",
                "title": "Not Enough Sales History To Forecast",
                "message": sales_forecast.get("message", "Insufficient history."),
                "suggested_action": (
                    "Keep recording invoices; forecasting begins once the history "
                    "requirement is met."
                ),
                "impact_metric": "Awaiting Data",
            }
        )
    else:
        expected_revenue = float(sales_forecast.get("total_forecasted_sales", 0.0))
        growth_pct = float(sales_forecast.get("trend_percentage") or 0.0)

        if growth_pct > 10.0:
            alerts.append(
                {
                    "type": "SALES",
                    "severity": "success",
                    "title": "Strong Revenue Surge Anticipated",
                    "message": (
                        f"Sales are projected {growth_pct:+.1f}% against the "
                        f"{sales_forecast.get('forecast_days', 7)} preceding days."
                    ),
                    "suggested_action": (
                        "Ensure high-demand lines are stocked and staff the peak days."
                    ),
                    "impact_metric": f"{growth_pct:+.1f}% Revenue",
                }
            )
            actions.append(
                f"Prepare for a projected {growth_pct:.1f}% revenue lift over the forecast window."
            )
        elif growth_pct < -5.0:
            alerts.append(
                {
                    "type": "SALES",
                    "severity": "warning",
                    "title": "Sales Slump Projected",
                    "message": (
                        f"Revenue is projected {growth_pct:.1f}% below the preceding period."
                    ),
                    "suggested_action": (
                        "Run a targeted promotion to existing customers to offset the dip."
                    ),
                    "impact_metric": f"{growth_pct:.1f}% Revenue",
                }
            )
            actions.append("Launch a reactivation promotion to counter the projected dip.")

    # --- 2. Inventory ----------------------------------------------------
    critical = [d for d in demand_results if d.get("status") in ("Critical Shortage", "Out of Stock")]
    low = [d for d in demand_results if d.get("status") == "Low Stock"]
    overstocked = [d for d in demand_results if d.get("status") == "Overstocked"]

    if critical:
        names = ", ".join(d["product_name"] for d in critical[:3])
        units = sum(int(d.get("recommended_order_quantity") or 0) for d in critical)
        alerts.append(
            {
                "type": "INVENTORY",
                "severity": "critical",
                "title": f"Stockout Risk: {len(critical)} Product(s)",
                "message": (
                    f"{names} will not cover demand across their supplier lead time."
                ),
                "suggested_action": f"Raise purchase orders totalling {units} units now.",
                "impact_metric": f"{len(critical)} at Risk",
            }
        )
        actions.append(f"Place expedited purchase orders for {names}.")

    if low:
        alerts.append(
            {
                "type": "INVENTORY",
                "severity": "warning",
                "title": f"{len(low)} Product(s) At Reorder Point",
                "message": "Stock has reached the calculated reorder point for these lines.",
                "suggested_action": "Combine into one supplier order to reduce delivery cost.",
                "impact_metric": f"{len(low)} Items",
            }
        )

    if overstocked:
        tied_up = sum(
            (d.get("current_stock") or 0) * float(d.get("unit_cost") or d.get("unit_price") or 0)
            for d in overstocked
        )
        alerts.append(
            {
                "type": "INVENTORY",
                "severity": "info",
                "title": f"{len(overstocked)} Product(s) Overstocked",
                "message": (
                    f"Roughly ₹{tied_up:,.0f} of stock is sitting beyond "
                    f"{OVERSTOCK_COVER_DAYS:.0f} days of cover."
                ),
                "suggested_action": "Promote or bundle these lines to release working capital.",
                "impact_metric": f"₹{tied_up:,.0f} Tied Up",
            }
        )

    # --- 3. Expenses -----------------------------------------------------
    anomalies = [e for e in expense_anomalies if e.get("is_anomaly")]
    for anomaly in anomalies[:2]:
        category = anomaly.get("category", "Operational")
        amount = float(anomaly.get("amount") or 0.0)
        alerts.append(
            {
                "type": "EXPENSE",
                "severity": "warning",
                "title": f"Unusual Expense in {category}",
                "message": anomaly.get("reason", "Flagged against the category baseline."),
                "suggested_action": "Verify the invoice or meter reading before approving.",
                "impact_metric": f"₹{amount:,.0f}",
            }
        )
        actions.append(f"Review the flagged {category} charge.")

    # --- 4. Profitability ------------------------------------------------
    measured_cogs = cogs_ratio is not None and cogs_ratio > 0
    applied_ratio = float(cogs_ratio) if measured_cogs else ASSUMED_COGS_RATIO

    expected_cogs = expected_revenue * applied_ratio
    gross_profit = expected_revenue - expected_cogs

    monthly_expense = float(expense_forecast.get("total_predicted_expense", 0.0) or 0.0)
    forecast_days = int(sales_forecast.get("forecast_days") or 7)
    scaled_expense = monthly_expense * (forecast_days / DAYS_PER_MONTH)
    # Net profit strictly counted as selling price - cost price (Gross margin profit)
    net_profit = round(gross_profit, 2)
    margin = round((net_profit / expected_revenue) * 100.0, 1) if expected_revenue > 0 else 0.0

    if not actions:
        actions.append(
            "Maintain the current replenishment cycle and review supplier lead times."
        )

    return {
        "sales_growth_predicted_pct": round(growth_pct, 1),
        "expected_revenue_next_period": round(expected_revenue, 2),
        "expected_cogs": round(expected_cogs, 2),
        "expected_gross_profit": round(gross_profit, 2),
        "expected_expense_next_period": round(scaled_expense, 2),
        "predicted_net_profit": net_profit,
        "profit_margin_pct": margin,
        # Only the first two anomalies become alerts; the caller still needs the
        # full count, which used to be hardcoded to 0 downstream.
        "expense_anomaly_count": len(anomalies),
        "critical_alerts": alerts,
        "top_recommended_actions": actions[:5],
        "model_info": {
            "cogs_ratio": round(applied_ratio, 4),
            "cogs_basis": (
                "measured_from_invoice_cost_prices" if measured_cogs else "assumed_default"
            ),
            "expense_scaling": f"monthly forecast x {forecast_days}/{DAYS_PER_MONTH:.2f} days",
            "sales_confidence": sales_forecast.get("confidence"),
            "note": (
                ""
                if measured_cogs
                else "COGS ratio was not supplied by the caller, so a default "
                "retail-margin assumption was applied."
            ),
        },
    }
