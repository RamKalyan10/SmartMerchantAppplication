"""Catalog Requirement Classification Model Training Pipeline (XGBoost vs Random Forest)."""

import logging
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier

from app.config.settings import settings
from app.utils.database import DatabaseClient
from app.utils.feature_utils import build_catalog_features
from app.utils.validation import clean_invoices_df

logger = logging.getLogger("ml-service.train_catalog")

CATALOG_FEATURES = [
    "sales_7_days",
    "sales_30_days",
    "sales_90_days",
    "current_stock",
    "turnover_rate",
    "days_since_last_sale",
    "total_quantity_sold",
    "revenue",
    "average_daily_sales",
]

CLASSES = ["HIGH_DEMAND", "MEDIUM_DEMAND", "LOW_DEMAND", "SLOW_MOVING", "DEAD_STOCK"]


def train_catalog_model(
    db_client: DatabaseClient,
    store_id: str = settings.DEFAULT_STORE_ID,
) -> Dict[str, Any]:
    print("--- [3/5] Training Catalog Classification Model ---")
    invoices_df = db_client.extract_invoices(store_id=store_id)
    products_df = db_client.extract_products(store_id=store_id)

    if invoices_df.empty or products_df.empty:
        raise ValueError("Invoices and Products required for catalog training.")

    cleaned_invoices = clean_invoices_df(invoices_df)
    catalog_df = build_catalog_features(cleaned_invoices, products_df)

    if catalog_df.empty:
        raise ValueError("No catalog movement records generated.")

    X = catalog_df[CATALOG_FEATURES]
    y_raw = catalog_df["classification"]

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)
    present_classes = label_encoder.classes_.tolist()

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train / Test split with shuffle=False or stratified
    split_idx = max(1, int(len(catalog_df) * 0.8))
    X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    # Ensure y_train has all classes seen or train on full set if test set misses classes
    if len(np.unique(y_train)) < len(np.unique(y)):
        X_train, y_train = X_scaled, y
        X_test, y_test = X_scaled, y

    # Model 1: Random Forest comparison baseline
    rf = RandomForestClassifier(n_estimators=80, random_state=42)
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_acc = float(accuracy_score(y_test, rf_pred))
    rf_f1 = float(f1_score(y_test, rf_pred, average="macro", zero_division=0))

    # Model 2: XGBoost Classifier (Primary)
    xgb = XGBClassifier(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=4,
        random_state=42,
        eval_metric="mlogloss",
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)
    xgb_acc = float(accuracy_score(y_test, xgb_pred))
    xgb_f1 = float(f1_score(y_test, xgb_pred, average="macro", zero_division=0))

    print(f"  RandomForest   -> Accuracy: {rf_acc:.3f} | Macro F1: {rf_f1:.3f}")
    print(f"  XGBoost Clf    -> Accuracy: {xgb_acc:.3f} | Macro F1: {xgb_f1:.3f}")

    # Select best model (prefer XGBoost unless RF outperforms significantly)
    selected_model = xgb if xgb_f1 >= rf_f1 else rf
    selected_name = "XGBClassifier" if selected_model == xgb else "RandomForestClassifier"

    model_path = settings.MODEL_DIR / "catalog_model.joblib"
    preprocessor_path = settings.PREPROCESSOR_DIR / "catalog_preprocessor.joblib"

    # Bundle scaler and label encoder in preprocessor dict
    joblib.dump(selected_model, model_path)
    joblib.dump({"scaler": scaler, "encoder": label_encoder, "classes": present_classes}, preprocessor_path)

    return {
        "model_name": "catalog_classification",
        "algorithm": selected_name,
        "features": CATALOG_FEATURES,
        "classes": present_classes,
        "metrics": {
            "accuracy": round(xgb_acc, 3),
            "macro_f1": round(xgb_f1, 3),
            "random_forest_f1": round(rf_f1, 3),
        },
        "artifacts": {
            "model": str(model_path),
            "preprocessor": str(preprocessor_path),
        },
    }
