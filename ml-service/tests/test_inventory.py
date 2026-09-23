"""Unit tests for Inventory Requirement Engine deterministic rules."""

import unittest
from app.services.inventory_service import InventoryService


class TestInventoryRules(unittest.TestCase):
    def test_shortage_triggers_restock(self):
        # Current stock 80, Predicted demand 150, Safety 20
        res = InventoryService.evaluate_item(
            product_id="p_rice",
            product_name="Rice",
            current_stock=80,
            predicted_demand=150,
            safety_stock=20,
            reorder_level=25,
            cost_price=50,
        )
        self.assertEqual(res["decision"], "RESTOCK")
        self.assertEqual(res["shortage"], 70)
        # Required = 150 + 20 = 170. Restock quantity = 170 - 80 = 90
        self.assertEqual(res["recommended_quantity"], 90)
        self.assertEqual(res["estimated_cost"], 4500.0)

    def test_reorder_level_triggers_restock(self):
        # Current stock 10, reorder 20, predicted demand 8
        res = InventoryService.evaluate_item(
            product_id="p_tea",
            product_name="Tea",
            current_stock=10,
            predicted_demand=8,
            safety_stock=15,
            reorder_level=20,
        )
        self.assertEqual(res["decision"], "RESTOCK")

    def test_overstock_detected(self):
        # Current stock 100, predicted demand 20, safety 15
        res = InventoryService.evaluate_item(
            product_id="p_ghee",
            product_name="Ghee",
            current_stock=100,
            predicted_demand=20,
            safety_stock=15,
            reorder_level=10,
        )
        self.assertEqual(res["decision"], "OVERSTOCK")
        self.assertEqual(res["recommended_quantity"], 0.0)

    def test_stock_sufficient(self):
        # Current stock 40, predicted demand 25, safety 10
        res = InventoryService.evaluate_item(
            product_id="p_dal",
            product_name="Dal",
            current_stock=40,
            predicted_demand=25,
            safety_stock=10,
            reorder_level=15,
        )
        self.assertEqual(res["decision"], "STOCK_SUFFICIENT")
        self.assertEqual(res["shortage"], 0.0)


if __name__ == "__main__":
    unittest.main()
