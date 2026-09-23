"""Recommendation Engine — Consolidates all predictive and rule-based pipelines into actionable executive insights."""

import uuid
from datetime import datetime
from typing import Any, Dict, List

from app.config.settings import settings
from app.services.inventory_service import InventoryService
from app.services.prediction_service import get_prediction_service
from app.services.profit_service import ProfitService


class RecommendationService:
    @staticmethod
    def generate_recommendations(
        store_id: str = settings.DEFAULT_STORE_ID, days: int = 14
    ) -> Dict[str, Any]:
        pred_service = get_prediction_service()

        # 1. Gather all pipeline results
        sales_res = pred_service.predict_sales(days=days, store_id=store_id)
        demand_res = pred_service.predict_demand(days=days, store_id=store_id)
        catalog_res = pred_service.classify_catalog(store_id=store_id)
        anomaly_res = pred_service.detect_expense_anomalies(store_id=store_id)
        profit_res = ProfitService.forecast_profit(days=days, store_id=store_id)

        recommendations: List[Dict[str, Any]] = []
        critical_alerts: List[str] = []

        # A. Inventory Shortage & Stockout Alerts
        demand_items = demand_res.get("results", [])
        critical_shortages = [d for d in demand_items if d.get("projected_shortage", 0) > 0]

        for it in critical_shortages[:4]:
            p_name = it["product_name"]
            shortage = it["projected_shortage"]
            stock = it["current_stock"]
            rec_qty = it["recommended_order_quantity"]
            is_urgent = it["reorder_urgency"] == "Critical"

            priority = "CRITICAL" if is_urgent else "HIGH"
            alert_text = f"Stockout Risk: {p_name} has {stock:g} units left with {shortage:g} shortage projected."
            if is_urgent:
                critical_alerts.append(alert_text)

            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "priority": priority,
                "category": "INVENTORY",
                "title": f"Restock {p_name}",
                "recommendation": f"Order {rec_qty:g} units immediately from primary supplier.",
                "reason": f"Projected {days}-day demand of {it['predicted_demand_units']:g} exceeds current stock of {stock:g}.",
                "expected_impact": f"Prevents revenue loss and customer dissatisfaction from stockouts.",
                "action_type": "RESTOCK",
            })

        # B. Overstock & Slow-Moving Capital Optimization
        classifications = catalog_res.get("classifications", [])
        dead_stock = [c for c in classifications if c.get("classification") == "DEAD_STOCK"]

        for ds in dead_stock[:2]:
            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "priority": "MEDIUM",
                "category": "CATALOG",
                "title": f"Liquidate Dead Stock: {ds['product_name']}",
                "recommendation": "Bundle with high-demand staples or offer a 15-20% promotional discount.",
                "reason": f"Item has {ds['current_stock']:g} units in warehouse with no recorded transactions in past 60 days.",
                "expected_impact": "Recovers trapped working capital and frees valuable shelf space.",
                "action_type": "PROMOTION",
            })

        # C. Expense Anomalies
        anomalies = anomaly_res.get("anomalies", [])
        detected_anomalies = [a for a in anomalies if a.get("is_anomaly")]

        for a in detected_anomalies[:2]:
            cat = a["category"]
            amt = a["amount"]
            alert_msg = f"Expense Spike: {cat} logged at ₹{amt:,.0f} (Severity: {a['severity']})."
            critical_alerts.append(alert_msg)

            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "priority": "HIGH" if a["severity"] == "HIGH" else "MEDIUM",
                "category": "EXPENSE",
                "title": f"Audit {cat} Billing",
                "recommendation": f"Review invoice details and vendor rates for {cat}.",
                "reason": a["message"],
                "expected_impact": f"Identifies potential overbilling or equipment inefficiencies.",
                "action_type": "REVIEW_EXPENSE",
            })

        # D. Sales & Profit Strategy
        net_profit = profit_res.get("predicted_net_profit", 0)
        growth_pct = profit_res.get("profit_growth_percentage", 0)

        if growth_pct >= 0:
            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "priority": "LOW",
                "category": "PROFIT",
                "title": f"Maintain Positive Growth Momentum (+{growth_pct}%)",
                "recommendation": "Ensure high-margin categories (Personal Care, Ghee) maintain 100% in-stock rate.",
                "reason": f"Projected net profit of ₹{net_profit:,.0f} shows upward trajectory.",
                "expected_impact": "Sustains healthy store net margin above 18%.",
                "action_type": "ADJUST_PRICE",
            })
        else:
            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "priority": "HIGH",
                "category": "PROFIT",
                "title": "Mitigate Margin Compression",
                "recommendation": "Review supplier cost prices and renegotiate bulk volume rebates.",
                "reason": f"Projected net profit growth is slowing ({growth_pct}%).",
                "expected_impact": "Protects baseline profitability during slower trading cycles.",
                "action_type": "REVIEW_EXPENSE",
            })

        return {
            "status": "success",
            "store_id": store_id,
            "generated_at": datetime.now().isoformat(),
            "total_recommendations": len(recommendations),
            "profit_forecast": profit_res,
            "recommendations": recommendations,
            "critical_alerts": critical_alerts,
        }
