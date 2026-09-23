"""Unit tests for Expense forecasting feature generation."""

import unittest
from datetime import date, timedelta
import pandas as pd

from app.utils.feature_utils import build_expense_features
from app.utils.validation import clean_expenses_df


class TestExpensePipeline(unittest.TestCase):
    def setUp(self):
        self.expenses_df = pd.DataFrame([
            {"id": "e1", "date": "2026-01-05", "category": "Rent", "amount": 25000},
            {"id": "e2", "date": "2026-02-05", "category": "Rent", "amount": 25000},
            {"id": "e3", "date": "2026-03-05", "category": "Rent", "amount": 25000},
            {"id": "e4", "date": "2026-01-10", "category": "Power", "amount": 4000},
            {"id": "e5", "date": "2026-02-10", "category": "Power", "amount": 4200},
            {"id": "e6", "date": "2026-03-10", "category": "Power", "amount": 4600},
        ])
        self.invoices_df = pd.DataFrame([
            {"id": "i1", "date": "2026-01-15", "total_amount": 50000},
            {"id": "i2", "date": "2026-02-15", "total_amount": 60000},
            {"id": "i3", "date": "2026-03-15", "total_amount": 55000},
        ])

    def test_clean_expenses_df(self):
        cleaned = clean_expenses_df(self.expenses_df)
        self.assertEqual(len(cleaned), 6)
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(cleaned["date"]))

    def test_build_expense_features(self):
        feats = build_expense_features(self.expenses_df, self.invoices_df)
        self.assertGreater(len(feats), 0)
        self.assertIn("previous_month_expense", feats.columns)
        self.assertIn("rolling_3_month_expense", feats.columns)
        self.assertIn("sales", feats.columns)


if __name__ == "__main__":
    unittest.main()
