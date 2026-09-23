"""
Model 1: Sales Prediction — Linear Regression
Lab Topic: Simple / Multiple Linear Regression
Predicts future sales revenue from lagged sales, averages, invoice count, quantity, and discount.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
import joblib

# Ensure sibling packages can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute, chronological_split

def train_sales_model():
    print("=" * 60)
    print("Training Model 1: Sales Prediction (Linear Regression)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features and Target
    feature_cols = [
        "previous_day_sales",
        "sales_7_day_average",
        "sales_30_day_average",
        "invoice_count",
        "quantity_sold",
        "discount"
    ]
    target_col = "revenue"
    
    # 3. Chronological Train/Test Split (80% train, 20% test to prevent leakage)
    X_train, X_test, y_train, y_test = chronological_split(df_clean, feature_cols, target_col, train_ratio=0.8)
    print(f"Dataset split chronologically: Train={len(X_train)} samples, Test={len(X_test)} samples")
    
    # 4. Train Linear Regression Model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # 5. Evaluate on Test Set
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("\n--- Evaluation Metrics on Test Set ---")
    print(f"Mean Absolute Error (MAE):      Rs. {mae:.2f}")
    print(f"Root Mean Squared Error (RMSE): Rs. {rmse:.2f}")
    print(f"R-squared (R²):                 {r2:.4f}")
    
    print("\nModel Coefficients:")
    for feature, coef in zip(feature_cols, model.coef_):
        print(f"  {feature:22s}: {coef:+.4f}")
    print(f"  {'Intercept':22s}: {model.intercept_:+.4f}")
    
    # 6. Save Model using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "sales_model.joblib")
    
    joblib.dump(model, model_path)
    print(f"\n[OK] Model successfully saved to: {model_path}")
    
    # 7. Reload and verify prediction test
    del model
    loaded_model = joblib.load(model_path)
    sample_input = np.array([[4000.0, 4300.0, 4100.0, 35, 120, 5.0]])
    sample_pred = loaded_model.predict(sample_input)[0]
    print(f"Verification Test Prediction for sample {sample_input.tolist()}: Rs. {sample_pred:.2f}")
    
    return {"mae": mae, "rmse": rmse, "r2": r2}

if __name__ == "__main__":
    train_sales_model()
