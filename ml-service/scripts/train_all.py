"""Master Model Training & Orchestration Pipeline.

Executes all 5 training pipelines, validates time-aware splits,
serializes Joblib models, and updates model_metadata.json & model_metrics.json.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure ml-service root is on python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config.settings import settings
from app.training.train_anomaly import train_anomaly_model
from app.training.train_catalog import train_catalog_model
from app.training.train_demand import train_demand_model
from app.training.train_expense import train_expense_model
from app.training.train_sales import train_sales_model
from app.utils.database import DatabaseClient


def train_all(store_id: str = settings.DEFAULT_STORE_ID):
    print("==========================================================")
    print("  SMART MERCHANT — TRAINING COMPLETE MACHINE LEARNING SUITE")
    print("==========================================================")
    start_time = datetime.now()

    db_client = DatabaseClient()

    # 1. Sales Model
    sales_res = train_sales_model(db_client, store_id=store_id)

    # 2. Demand Model
    demand_res = train_demand_model(db_client, store_id=store_id)

    # 3. Catalog Model
    catalog_res = train_catalog_model(db_client, store_id=store_id)

    # 4. Expense Model
    expense_res = train_expense_model(db_client, store_id=store_id)

    # 5. Anomaly Model
    anomaly_res = train_anomaly_model(db_client, store_id=store_id)

    duration = (datetime.now() - start_time).total_seconds()

    # Model Metrics file
    metrics_payload = {
        "generated_at": datetime.now().isoformat(),
        "store_id": store_id,
        "sales_model": sales_res.get("metrics"),
        "sales_baseline": sales_res.get("baseline_comparison"),
        "demand_model": demand_res.get("metrics"),
        "catalog_model": catalog_res.get("metrics"),
        "expense_model": expense_res.get("metrics"),
        "anomaly_model": {
            "anomalies_detected": anomaly_res.get("anomalies_detected"),
            "detection_rate": anomaly_res.get("detection_rate"),
        },
    }

    # Model Metadata file
    metadata_payload = {
        "version": "1.0.0",
        "trained_at": datetime.now().isoformat(),
        "training_duration_seconds": round(duration, 2),
        "store_id": store_id,
        "models": {
            "sales": {
                "algorithm": sales_res.get("algorithm"),
                "features": sales_res.get("features"),
                "artifact": sales_res.get("artifacts", {}).get("model"),
            },
            "demand": {
                "algorithm": demand_res.get("algorithm"),
                "features": demand_res.get("features"),
                "artifact": demand_res.get("artifacts", {}).get("model"),
            },
            "catalog": {
                "algorithm": catalog_res.get("algorithm"),
                "features": catalog_res.get("features"),
                "classes": catalog_res.get("classes"),
                "artifact": catalog_res.get("artifacts", {}).get("model"),
            },
            "expense": {
                "algorithm": expense_res.get("algorithm"),
                "features": expense_res.get("features"),
                "artifact": expense_res.get("artifacts", {}).get("model"),
            },
            "anomaly": {
                "algorithm": anomaly_res.get("algorithm"),
                "contamination": anomaly_res.get("contamination"),
                "artifact": anomaly_res.get("artifacts", {}).get("model"),
            },
        },
    }

    with open(settings.METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    with open(settings.METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata_payload, f, indent=2)

    print("\n==========================================================")
    print(f"  ALL 5 MODELS TRAINED SUCCESSFULLY IN {duration:.1f}s!")
    print(f"  Metrics saved to:  {settings.METRICS_PATH}")
    print(f"  Metadata saved to: {settings.METADATA_PATH}")
    print("==========================================================")


if __name__ == "__main__":
    train_all()
