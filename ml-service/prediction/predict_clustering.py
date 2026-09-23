"""
Inference for Model 6: Business Activity & Expense Segmentation (K-Means)
Loads 'models/clustering_model.joblib' and segments operational patterns.
Features: [total_expense, revenue, invoice_count, business_activity].
"""

import os
import joblib
import numpy as np
from typing import Dict, Any

def get_clustering_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "models", "clustering_model.joblib")
    if not os.path.exists(model_path):
        from training.train_clustering import train_clustering_model
        train_clustering_model()
    return joblib.load(model_path)

def segment_business_activity(total_expense: float, revenue: float, invoice_count: int, business_activity: float) -> Dict[str, Any]:
    """Assigns business activity pattern and returns cluster name and operational insights."""
    payload = get_clustering_model()
    pipeline = payload["pipeline"]
    cluster_names = payload.get("cluster_names", {})
    
    X = np.array([[total_expense, revenue, invoice_count, business_activity]])
    cluster_id = int(pipeline.predict(X)[0])
    cluster_name = cluster_names.get(cluster_id, f"Cluster {cluster_id}")
    
    # Check if expense is disproportionately high compared to revenue
    expense_ratio = total_expense / max(revenue, 1.0)
    is_unusual = expense_ratio > 0.75 or (cluster_id == 2 and revenue < 4000)
    
    return {
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
        "is_unusual_expense_pattern": bool(is_unusual),
        "expense_to_revenue_ratio": round(expense_ratio, 3),
        "insight": "Business operating in high-demand surge phase." if cluster_id == 2 else ("Normal steady business velocity." if cluster_id == 1 else "Conservative low-volume business day.")
    }

if __name__ == "__main__":
    result = segment_business_activity(total_expense=4500.0, revenue=11500.0, invoice_count=75, business_activity=88.0)
    print(f"Business Segmentation Result: {result}")
