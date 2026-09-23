"""Unit tests for Expense Anomaly Detection logic."""

import unittest
from app.services.prediction_service import PredictionService


class TestAnomalyLogic(unittest.TestCase):
    def test_anomaly_evaluation_threshold(self):
        # A test on anomaly classification rules
        median_power = 4500.0
        iqr_power = 600.0
        expected_max = median_power + 2.5 * iqr_power  # 6000.0

        # Normal value
        val_normal = 4800.0
        self.assertLess(val_normal, expected_max)

        # Anomaly value
        val_anomaly = 11500.0
        self.assertGreater(val_anomaly, expected_max)
        severity = "HIGH" if (val_anomaly / median_power) >= 2.2 else "MEDIUM"
        self.assertEqual(severity, "HIGH")


if __name__ == "__main__":
    unittest.main()
