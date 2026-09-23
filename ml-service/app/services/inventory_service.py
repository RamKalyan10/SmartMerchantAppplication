"""Inventory Requirement Engine — Deterministic business logic converting predictions into stock actions."""

from typing import Any, Dict, List


class InventoryService:
    @staticmethod
    def evaluate_item(
        product_id: str,
        product_name: str,
        current_stock: float,
        predicted_demand: float,
        safety_stock: float = 15.0,
        reorder_level: float = 20.0,
        cost_price: float = 0.0,
        category: str = "General",
    ) -> Dict[str, Any]:
        """Applies deterministic business rules to demand predictions."""
        # 1. Decision logic
        if current_stock <= reorder_level:
            decision = "RESTOCK"
            reason = f"Current stock ({current_stock:g}) is at or below reorder threshold ({reorder_level:g})."
        elif current_stock < predicted_demand:
            decision = "RESTOCK"
            reason = f"Available inventory ({current_stock:g}) will not cover forecasted demand ({predicted_demand:g})."
        elif current_stock > (predicted_demand + safety_stock * 1.8):
            decision = "OVERSTOCK"
            reason = f"Current inventory ({current_stock:g}) exceeds demand ({predicted_demand:g}) + buffer ({safety_stock:g})."
        else:
            decision = "STOCK_SUFFICIENT"
            reason = "Stock is comfortably sized for projected demand and safety buffer."

        # 2. Shortage & Replenishment calculation
        shortage = max(0.0, predicted_demand - current_stock)

        if decision == "RESTOCK":
            required_inventory = predicted_demand + safety_stock
            restock_qty = max(0.0, required_inventory - current_stock)
        else:
            restock_qty = 0.0

        # Urgency assignment
        if current_stock == 0 and predicted_demand > 0:
            urgency = "CRITICAL"
        elif decision == "RESTOCK" and current_stock <= (reorder_level * 0.5):
            urgency = "HIGH"
        elif decision == "RESTOCK":
            urgency = "MODERATE"
        elif decision == "OVERSTOCK":
            urgency = "LOW"
        else:
            urgency = "NONE"

        estimated_capital = round(restock_qty * cost_price, 2)

        return {
            "product_id": product_id,
            "product_name": product_name,
            "category": category,
            "current_stock": float(current_stock),
            "predicted_demand": float(predicted_demand),
            "safety_stock": float(safety_stock),
            "reorder_level": float(reorder_level),
            "shortage": round(shortage, 1),
            "decision": decision,
            "recommended_quantity": round(restock_qty, 1),
            "estimated_cost": estimated_capital,
            "urgency": urgency,
            "reason": reason,
        }

    @classmethod
    def evaluate_batch(
        cls, items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        evaluations = []
        restock_cnt = 0
        overstock_cnt = 0
        sufficient_cnt = 0
        total_cost = 0.0

        for it in items:
            res = cls.evaluate_item(
                product_id=it.get("product_id", ""),
                product_name=it.get("product_name", "Unknown Product"),
                current_stock=float(it.get("current_stock") or 0.0),
                predicted_demand=float(it.get("predicted_demand") or 0.0),
                safety_stock=float(it.get("safety_stock") or 15.0),
                reorder_level=float(it.get("reorder_level") or 20.0),
                cost_price=float(it.get("cost_price") or 0.0),
                category=it.get("category", "General"),
            )
            evaluations.append(res)
            if res["decision"] == "RESTOCK":
                restock_cnt += 1
                total_cost += res["estimated_cost"]
            elif res["decision"] == "OVERSTOCK":
                overstock_cnt += 1
            else:
                sufficient_cnt += 1

        # Sort priority: CRITICAL > HIGH > MODERATE > LOW > NONE
        priority_rank = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3, "NONE": 4}
        evaluations.sort(key=lambda x: (priority_rank.get(x["urgency"], 5), -x["shortage"]))

        return {
            "status": "success",
            "total_evaluated": len(evaluations),
            "restock_count": restock_cnt,
            "overstock_count": overstock_cnt,
            "sufficient_count": sufficient_cnt,
            "total_capital_required": round(total_cost, 2),
            "evaluations": evaluations,
        }
