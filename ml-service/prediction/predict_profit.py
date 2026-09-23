"""
Inference for Model 7: Profit Prediction (Linear Regression)
Loads 'models/profit_model.joblib' and forecasts net business profit.
Features: [revenue, total_expense, invoice_count, average_order_value].
"""

import os
import joblib
import numpy as np

def get_profit_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "profit_model.joblib")
    if not os.path.exists(model_path):
        from training.train_profit import train_profit_model
        train_profit_model()
    return joblib.load(model_path)

def predict_net_profit(revenue: float, total_expense: float, invoice_count: int, average_order_value: float) -> float:
    """Predicts net profit given forecasted revenue, overhead expense, and transaction count."""
    model = get_profit_model()
    X = np.array([[revenue, total_expense, invoice_count, average_order_value]])
    pred = model.predict(X)[0]
    return float(round(pred, 2))

if __name__ == "__main__":
    profit_pred = predict_net_profit(120000.0, 70000.0, 350, 342.8)
    print(f"Predicted Net Profit: Rs. {profit_pred:.2f}")
