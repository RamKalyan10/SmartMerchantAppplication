"""
Inference for Model 3: Catalog Requirement (Decision Tree)
Loads 'models/catalog_model.joblib' and caches in memory.
"""

import os
import joblib
import numpy as np
from typing import Dict, Any

_CACHED_MODEL = None

def get_catalog_model():
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL
        
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "catalog_model.joblib")
    if not os.path.exists(model_path):
        from training.train_catalog import train_catalog_model
        train_catalog_model()
    _CACHED_MODEL = joblib.load(model_path)
    return _CACHED_MODEL

def classify_catalog_item(qty_sold: int, sales_30d: float, stock: int, turnover: float, days_since_sale: int, sales_90d: float) -> Dict[str, Any]:
    """Classifies catalog product and provides recommended merchandising action."""
    model = get_catalog_model()
    X = np.array([[qty_sold, sales_30d, stock, turnover, days_since_sale, sales_90d]])
    classification = model.predict(X)[0]
    
    action_map = {
        "HIGH_DEMAND": "Prioritize inventory replenishment; ensure zero stockouts.",
        "MEDIUM_DEMAND": "Maintain standard reorder levels and routine monitoring.",
        "LOW_DEMAND": "Avoid over-ordering; stock in limited batches.",
        "SLOW_MOVING": "Implement promotional discounts or bundle offers to stimulate velocity.",
        "DEAD_STOCK": "Liquidate stock immediately or return to supplier to free working capital."
    }
    
    return {
        "classification": classification,
        "recommended_action": action_map.get(classification, "Monitor item performance."),
        "turnover_rate": round(turnover, 2),
        "days_since_last_sale": days_since_sale
    }

if __name__ == "__main__":
    result = classify_catalog_item(220, 15000.0, 30, 2.5, 0, 46500.0)
    print(f"Catalog Classification: {result}")
