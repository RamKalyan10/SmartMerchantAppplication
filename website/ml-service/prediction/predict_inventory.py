"""
Inference for Model 4: Inventory Status (Logistic Regression)
Loads 'models/inventory_model.joblib' and caches in memory.
"""

import os
import joblib
import numpy as np
from typing import Dict, Any

_CACHED_MODEL = None

def get_inventory_model():
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL
        
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "inventory_model.joblib")
    if not os.path.exists(model_path):
        from training.train_inventory import train_inventory_model
        train_inventory_model()
    _CACHED_MODEL = joblib.load(model_path)
    return _CACHED_MODEL

def predict_inventory_status(current_stock: int, predicted_demand: int, reorder_level: int, quantity_sold: int, turnover_rate: float) -> Dict[str, Any]:
    """Predicts inventory operational status and class probability distribution."""
    pipeline = get_inventory_model()
    X = np.array([[current_stock, predicted_demand, reorder_level, quantity_sold, turnover_rate]])
    status = pipeline.predict(X)[0]
    probabilities = pipeline.predict_proba(X)[0]
    
    prob_dict = {cls: round(float(prob), 3) for cls, prob in zip(pipeline.classes_, probabilities)}
    
    advice_map = {
        "RESTOCK": "Stock is below safety thresholds. Place purchase order immediately.",
        "SUFFICIENT": "Inventory is well-balanced with projected demand.",
        "OVERSTOCK": "Excess inventory detected. Temporarily pause reorders to prevent capital lockup."
    }
    
    return {
        "status": status,
        "probabilities": prob_dict,
        "recommendation": advice_map.get(status, "Maintain current inventory policy.")
    }

if __name__ == "__main__":
    result = predict_inventory_status(current_stock=15, predicted_demand=100, reorder_level=40, quantity_sold=90, turnover_rate=2.2)
    print(f"Inventory Status Result: {result}")
