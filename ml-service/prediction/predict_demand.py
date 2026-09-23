"""
Inference for Model 2: Product Demand (KNN Regression)
Loads 'models/demand_model.joblib' and predicts future unit demand.
Includes Smart Merchant business logic:
Shortage = max(0, Predicted Demand - Current Stock)
"""

import os
import joblib
import numpy as np
from typing import Dict, Any

def get_demand_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "demand_model.joblib")
    if not os.path.exists(model_path):
        from training.train_demand import train_demand_model
        train_demand_model()
    return joblib.load(model_path)

def predict_product_demand(current_stock: int, demand_7d: float, demand_30d: float, avg_daily: float, price: float, discount: float = 5.0) -> Dict[str, Any]:
    """Predicts product demand and calculates shortage and order recommendation."""
    model = get_demand_model()
    X = np.array([[current_stock, demand_7d, demand_30d, avg_daily, price, discount]])
    pred_demand = int(round(max(0.0, model.predict(X)[0])))
    
    # Business logic
    shortage = max(0, pred_demand - current_stock)
    urgency = "High" if shortage > 0.5 * pred_demand else ("Medium" if shortage > 0 else "None")
    
    return {
        "current_stock": current_stock,
        "predicted_demand": pred_demand,
        "projected_shortage": shortage,
        "recommended_order_quantity": shortage,
        "reorder_urgency": urgency,
        "status": "Shortage" if shortage > 0 else "Sufficient"
    }

if __name__ == "__main__":
    result = predict_product_demand(current_stock=80, demand_7d=120, demand_30d=500, avg_daily=18, price=65.0)
    print(f"Demand Prediction Result: {result}")
