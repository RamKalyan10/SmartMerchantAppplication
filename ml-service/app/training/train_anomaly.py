"""Expense Anomaly Detection Model Training Pipeline (Isolation Forest)."""

import logging
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.config.settings import settings
from app.utils.database import DatabaseClient
from app.utils.validation import clean_expenses_df

logger = logging.getLogger("ml-service.train_anomaly")


def train_anomaly_model(
    db_client: DatabaseClient,
    store_id: str = settings.DEFAULT_STORE_ID,
) -> Dict[str, Any]:
    print("--- [5/5] Training Expense Anomaly Detection Model ---")
    expenses_df = db_client.extract_expenses(store_id=store_id)
    if expenses_df.empty:
        raise ValueError("Expense records required for anomaly training.")

    cleaned_exp = clean_expenses_df(expenses_df)

    # Compute category-level baselines (median and interquartile spread)
    cat_baselines = {}
    for cat, group in cleaned_exp.groupby("category"):
        amounts = group["amount"].values
        med = float(np.median(amounts))
        q75, q25 = np.percentile(amounts, [75, 25]) if len(amounts) >= 4 else (med * 1.2, med * 0.8)
        iqr = float(max(1.0, q75 - q25))
        cat_baselines[cat] = {
            "median": round(med, 2),
            "iqr": round(iqr, 2),
            "expected_max": round(med + 2.5 * iqr, 2),
            "expected_min": round(max(0, med - 2.5 * iqr), 2),
        }

    # Features: [amount, ratio_to_cat_median, diff_from_cat_median]
    features_list = []
    for _, row in cleaned_exp.iterrows():
        cat = row["category"]
        amt = float(row["amount"])
        base = cat_baselines.get(cat, {"median": amt, "iqr": 100.0})
        ratio = amt / max(1.0, base["median"])
        diff = amt - base["median"]
        features_list.append([amt, ratio, diff])

    X = np.array(features_list)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Isolation Forest model
    contamination = 0.05  # Expect ~5% extreme cost spikes
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
    )
    model.fit(X_scaled)

    preds = model.predict(X_scaled)  # 1 for inlier, -1 for outlier
    anomaly_count = int((preds == -1).sum())
    detection_rate = float(anomaly_count / len(X))

    print(f"  Isolation Forest -> Anomalies Detected: {anomaly_count}/{len(X)} ({detection_rate:.1%})")

    model_path = settings.MODEL_DIR / "anomaly_model.joblib"
    joblib.dump(
        {
            "model": model,
            "scaler": scaler,
            "category_baselines": cat_baselines,
            "contamination": contamination,
        },
        model_path,
    )

    return {
        "model_name": "expense_anomaly_isolation_forest",
        "algorithm": "IsolationForest",
        "contamination": contamination,
        "total_records": len(X),
        "anomalies_detected": anomaly_count,
        "detection_rate": round(detection_rate, 3),
        "artifacts": {
            "model": str(model_path),
        },
    }
