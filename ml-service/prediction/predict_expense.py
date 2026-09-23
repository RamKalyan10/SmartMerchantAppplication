"""
Inference for Model 5: Expense Prediction (Multiple Linear Regression)
Loads 'models/expense_model.joblib' and forecasts future business overhead expenses.
"""

import os
import joblib
import numpy as np

def get_expense_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "expense_model.joblib")
    if not os.path.exists(model_path):
        from training.train_expense import train_expense_model
        train_expense_model()
    return joblib.load(model_path)

def predict_total_expense(prev_sales: float, avg_7d_sales: float, invoice_count: int, business_activity: float, avg_3m_expense: float) -> float:
    """Predicts total overhead expense based on operational intensity and past expense levels."""
    model = get_expense_model()
    X = np.array([[prev_sales, avg_7d_sales, invoice_count, business_activity, avg_3m_expense]])
    pred = model.predict(X)[0]
    return float(round(max(0.0, pred), 2))

if __name__ == "__main__":
    expense_pred = predict_total_expense(5200.0, 4900.0, 42, 68.5, 3100.0)
    print(f"Predicted Total Expense: Rs. {expense_pred:.2f}")
