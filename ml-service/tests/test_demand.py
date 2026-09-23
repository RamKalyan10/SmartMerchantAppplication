"""Unit tests for Product Demand forecasting feature pipeline."""

import unittest
from datetime import date, timedelta
import pandas as pd

from app.utils.feature_utils import build_demand_features, unpack_invoice_items


class TestDemandPipeline(unittest.TestCase):
    def setUp(self):
        self.products_df = pd.DataFrame([
            {"id": "p1", "name": "Rice", "category_name": "Grains", "stock_quantity": 50, "selling_price": 100, "cost_price": 80},
            {"id": "p2", "name": "Oil", "category_name": "Oils", "stock_quantity": 20, "selling_price": 150, "cost_price": 120},
        ])

        invoices = []
        cur = date(2026, 2, 1)
        for i in range(15):
            d = cur + timedelta(days=i)
            invoices.append({
                "id": f"inv_{i}",
                "date": d.isoformat(),
                "items": [
                    {"product_id": "p1", "product_name": "Rice", "quantity": 3, "unit_price": 100, "cost_price": 80, "total_amount": 300},
                    {"product_id": "p2", "product_name": "Oil", "quantity": 1, "unit_price": 150, "cost_price": 120, "total_amount": 150},
                ],
            })
        self.invoices_df = pd.DataFrame(invoices)

    def test_unpack_invoice_items(self):
        items = unpack_invoice_items(self.invoices_df)
        self.assertEqual(len(items), 30)
        self.assertIn("product_id", items.columns)
        self.assertIn("quantity", items.columns)

    def test_demand_features_generation(self):
        demand_feats = build_demand_features(self.invoices_df, self.products_df)
        self.assertEqual(len(demand_feats), 2)
        self.assertIn("previous_7_day_demand", demand_feats.columns)
        self.assertIn("sales_velocity", demand_feats.columns)
        self.assertIn("current_stock", demand_feats.columns)


if __name__ == "__main__":
    unittest.main()
