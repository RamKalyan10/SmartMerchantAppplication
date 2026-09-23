"""Product Demand Forecasting Model Training Pipeline (XGBoost Regressor)."""

import logging
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from app.config.settings import settings
from app.utils.database import DatabaseClient
from app.utils.feature_utils import build_demand_features
from app.utils.validation import clean_invoices_df

logger = logging.getLogger("ml-service.train_demand")

DEMAND_FEATURES = [
    "current_stock",
    "price",
    "cost_price",
    "previous_7_day_demand",
    "previous_30_day_demand",
    "previous_90_day_demand",
    "average_daily_demand",
    "sales_velocity",
    "days_since_last_sale",
    "weekday",
    "month",
]


def train_demand_model(
    db_client: DatabaseClient,
    store_id: str = settings.DEFAULT_STORE_ID,
) -> Dict[str, Any]:
    print("--- [2/5] Training Product Demand Model ---")
    invoices_df = db_client.extract_invoices(store_id=store_id)
    products_df = db_client.extract_products(store_id=store_id)

    if invoices_df.empty or products_df.empty:
        raise ValueError("Invoices and Products required for demand model training.")

    cleaned_invoices = clean_invoices_df(invoices_df)
    demand_df = build_demand_features(cleaned_invoices, products_df)

    if demand_df.empty:
        raise ValueError("No demand features generated from transaction data.")

    # Train / Test split (80/20)
    indices = np.arange(len(demand_df))
    split_idx = int(len(demand_df) * 0.8)

    train_data = demand_df.iloc[:split_idx]
    test_data = demand_df.iloc[split_idx:] if split_idx < len(demand_df) else train_data

    X_train = train_data[DEMAND_FEATURES]
    y_train = train_data["future_quantity_demand"]

    X_test = test_data[DEMAND_FEATURES]
    y_test = test_data["future_quantity_demand"]

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = XGBRegressor(
        n_estimators=100,
        learning_rate=0.08,
        max_depth=4,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train_scaled, y_train)

    y_pred = np.maximum(model.predict(X_test_scaled), 0.0)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    print(f"  Demand XGBoost -> MAE: {mae:.2f} | RMSE: {rmse:.2f} | R2: {r2:.3f}")

    model_path = settings.MODEL_DIR / "demand_model.joblib"
    preprocessor_path = settings.PREPROCESSOR_DIR / "demand_preprocessor.joblib"

    joblib.dump(model, model_path)
    joblib.dump(scaler, preprocessor_path)

    return {
        "model_name": "demand_xgboost",
        "algorithm": "XGBRegressor",
        "features": DEMAND_FEATURES,
        "training_samples": len(train_data),
        "test_samples": len(test_data),
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
