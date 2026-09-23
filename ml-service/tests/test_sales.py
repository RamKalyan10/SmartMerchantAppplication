"""Unit tests for Sales Forecasting model and feature preparation."""

import unittest
from datetime import date, timedelta
import pandas as pd
import numpy as np

from app.utils.feature_utils import aggregate_daily_sales, build_sales_features
from app.utils.validation import evaluate_data_sufficiency, time_aware_split


class TestSalesPipeline(unittest.TestCase):
    def setUp(self):
        # Generate 35 days of dummy transactions
        records = []
        start_d = date(2026, 1, 1)
        for i in range(35):
            cur = start_d + timedelta(days=i)
            records.append({
                "id": f"inv_{i}",
                "date": cur.isoformat(),
                "total_amount": 1000.0 + (i % 7) * 200,
                "discount": 50.0,
            })
        self.df = pd.DataFrame(records)

    def test_daily_aggregation(self):
        daily = aggregate_daily_sales(self.df)
        self.assertEqual(len(daily), 35)
        self.assertIn("total_sales", daily.columns)
        self.assertIn("avg_order_value", daily.columns)

    def test_feature_engineering_no_leakage(self):
        daily = aggregate_daily_sales(self.df)
        feats = build_sales_features(daily)
        self.assertIn("previous_day_sales", feats.columns)
        self.assertIn("rolling_7_day_sales", feats.columns)
        self.assertIn("weekday", feats.columns)
        # Check lag does not equal same day sales
        self.assertEqual(feats["previous_day_sales"].iloc[1], feats["total_sales"].iloc[0])

    def test_chronological_split(self):
        daily = aggregate_daily_sales(self.df)
        train, val, test = time_aware_split(daily, date_col="date", train_ratio=0.7, val_ratio=0.15)
        self.assertGreater(len(train), 0)
        self.assertGreater(len(test), 0)
        # Test strict time ordering
        self.assertLess(train["date"].max(), val["date"].min())
        self.assertLess(val["date"].max(), test["date"].min())

    def test_data_sufficiency_evaluation(self):
        self.assertEqual(evaluate_data_sufficiency(5)["status"], "INSUFFICIENT_DATA")
        self.assertEqual(evaluate_data_sufficiency(15)["status"], "LIMITED_DATA")
        self.assertEqual(evaluate_data_sufficiency(45)["status"], "NORMAL")
        self.assertEqual(evaluate_data_sufficiency(120)["status"], "STRONG")


if __name__ == "__main__":
    unittest.main()
