"""Expense Prediction Model Training Pipeline (XGBoost Regressor)."""

import logging
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

from app.config.settings import settings
from app.utils.database import DatabaseClient
from app.utils.feature_utils import build_expense_features
from app.utils.validation import clean_expenses_df, clean_invoices_df

logger = logging.getLogger("ml-service.train_expense")

EXPENSE_NUM_FEATURES = [
    "month",
    "previous_month_expense",
    "rolling_3_month_expense",
    "rolling_6_month_expense",
    "sales",
    "invoice_count",
]


def train_expense_model(
    db_client: DatabaseClient,
    store_id: str = settings.DEFAULT_STORE_ID,
) -> Dict[str, Any]:
    print("--- [4/5] Training Expense Prediction Model ---")
    expenses_df = db_client.extract_expenses(store_id=store_id)
    invoices_df = db_client.extract_invoices(store_id=store_id)

    if expenses_df.empty:
        raise ValueError("Expense records required for expense model training.")

    cleaned_exp = clean_expenses_df(expenses_df)
    cleaned_inv = clean_invoices_df(invoices_df)

    feat_df = build_expense_features(cleaned_exp, cleaned_inv)
    if feat_df.empty:
        raise ValueError("No monthly expense features derived.")

    categories = sorted(feat_df["category"].unique().tolist())
    category_map = {cat: idx for idx, cat in enumerate(categories)}
    feat_df["cat_idx"] = feat_df["category"].map(category_map)

    features = EXPENSE_NUM_FEATURES + ["cat_idx"]
    X = feat_df[features]
    y = feat_df["future_expense"]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    split_idx = max(1, int(len(feat_df) * 0.75))
    X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    if len(X_test) == 0:
        X_test, y_test = X_train, y_train

    model = XGBRegressor(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=3,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train)

    y_pred = np.maximum(model.predict(X_test), 0.0)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 1.0

    print(f"  Expense XGBoost -> MAE: {mae:.2f} | RMSE: {rmse:.2f} | R2: {r2:.3f}")

    model_path = settings.MODEL_DIR / "expense_model.joblib"
    preprocessor_path = settings.PREPROCESSOR_DIR / "expense_preprocessor.joblib"

    joblib.dump(model, model_path)
    joblib.dump(
        {"scaler": scaler, "categories": categories, "category_map": category_map, "features": features},
        preprocessor_path,
    )

    return {
        "model_name": "expense_xgboost",
        "algorithm": "XGBRegressor",
        "features": features,
        "categories": categories,
        "metrics": {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 3),
        },
        "artifacts": {
            "model": str(model_path),
            "preprocessor": str(preprocessor_path),
        },
    }
