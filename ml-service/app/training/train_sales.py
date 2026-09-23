"""Sales Forecasting Model Training Pipeline (XGBoost Regressor + Moving Average Baseline)."""

import logging
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from app.config.settings import settings
from app.utils.database import DatabaseClient
from app.utils.feature_utils import aggregate_daily_sales, build_sales_features
from app.utils.validation import clean_invoices_df, time_aware_split

logger = logging.getLogger("ml-service.train_sales")

FEATURE_COLUMNS = [
    "day",
    "month",
    "weekday",
    "week_of_year",
    "is_weekend",
    "previous_day_sales",
    "sales_lag_2",
    "sales_lag_7",
    "rolling_7_day_sales",
    "rolling_30_day_sales",
    "invoice_count",
    "avg_order_value",
    "discount_rate",
]


def train_sales_model(
    db_client: DatabaseClient,
    store_id: str = settings.DEFAULT_STORE_ID,
) -> Dict[str, Any]:
    print("--- [1/5] Training Sales Prediction Model ---")
    invoices_df = db_client.extract_invoices(store_id=store_id)
    if invoices_df.empty:
        raise ValueError("No invoice records available for sales model training.")

    cleaned_df = clean_invoices_df(invoices_df)
    daily_df = aggregate_daily_sales(cleaned_df)
    features_df = build_sales_features(daily_df)

    # Time-aware train / validation / test split
    train_df, val_df, test_df = time_aware_split(features_df, date_col="date")

    # Combine train + val for fitting final model after evaluation
    fit_df = pd.concat([train_df, val_df]).sort_values(by="date") if not val_df.empty else train_df
    eval_df = test_df if not test_df.empty else val_df

    X_train = fit_df[FEATURE_COLUMNS]
    y_train = fit_df["future_sales"]

    X_test = eval_df[FEATURE_COLUMNS]
    y_test = eval_df["future_sales"]

    # Baseline 1: 7-day Moving Average forecast
    baseline_preds = X_test["rolling_7_day_sales"]
    base_mae = float(mean_absolute_error(y_test, baseline_preds))
    base_rmse = float(np.sqrt(mean_squared_error(y_test, baseline_preds)))
    base_r2 = float(r2_score(y_test, baseline_preds))

    # Preprocessor scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # XGBoost Regressor
    model = XGBRegressor(
        n_estimators=120,
        learning_rate=0.06,
        max_depth=4,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train_scaled, y_train)

    # Evaluation on unseen future test set
    y_pred = model.predict(X_test_scaled)
    # Floor negative predictions
    y_pred = np.maximum(y_pred, 0.0)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    print(f"  Baseline 7d-MA  -> MAE: {base_mae:.2f} | RMSE: {base_rmse:.2f} | R2: {base_r2:.3f}")
    print(f"  XGBoost Model   -> MAE: {mae:.2f} | RMSE: {rmse:.2f} | R2: {r2:.3f}")

    # Serialize artifacts
    model_path = settings.MODEL_DIR / "sales_model.joblib"
    preprocessor_path = settings.PREPROCESSOR_DIR / "sales_preprocessor.joblib"

    joblib.dump(model, model_path)
    joblib.dump(scaler, preprocessor_path)

    metrics = {
        "model_name": "sales_xgboost",
        "algorithm": "XGBRegressor",
        "features": FEATURE_COLUMNS,
        "training_samples": len(fit_df),
        "test_samples": len(eval_df),
        "metrics": {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 3),
        },
        "baseline_comparison": {
            "name": "7_day_moving_average",
            "mae": round(base_mae, 2),
            "rmse": round(base_rmse, 2),
            "r2": round(base_r2, 3),
        },
        "artifacts": {
            "model": str(model_path),
            "preprocessor": str(preprocessor_path),
        },
    }
    return metrics
