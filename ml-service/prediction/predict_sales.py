"""
Inference for Model 1: Sales Prediction (Linear Regression)
Loads 'models/sales_model.joblib' and caches in memory for sub-millisecond inference.
"""

import os
import joblib
import numpy as np

_CACHED_MODEL = None

def get_sales_model():
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL
        
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "sales_model.joblib")
    if not os.path.exists(model_path):
        from training.train_sales import train_sales_model
        train_sales_model()
    _CACHED_MODEL = joblib.load(model_path)
    return _CACHED_MODEL

def predict_sales_revenue(prev_sales: float, avg_7d: float, avg_30d: float, invoices: int, qty: int, discount: float = 5.0) -> float:
    """Predicts future sales revenue given past activity."""
    model = get_sales_model()
    X = np.array([[prev_sales, avg_7d, avg_30d, invoices, qty, discount]])
    pred = model.predict(X)[0]
    return float(round(max(0.0, pred), 2))

if __name__ == "__main__":
    revenue_pred = predict_sales_revenue(4000.0, 4300.0, 4100.0, 35, 120, 5.0)
    print(f"Predicted Sales Revenue: Rs. {revenue_pred:.2f}")
