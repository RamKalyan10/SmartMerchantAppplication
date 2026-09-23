"""
Model 7: Profit Prediction — Linear Regression
Lab Topic: Linear Regression & Margin Forecasting
Predicts merchant bottom-line net profit based on revenue, operational expense, invoice count, and average order value (AOV).
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute, standard_split

def train_profit_model():
    print("=" * 60)
    print("Training Model 7: Profit Prediction (Linear Regression)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features and Target
    feature_cols = [
        "revenue",
        "total_expense",
        "invoice_count",
        "average_order_value"
    ]
    target_col = "profit"
    
    # 3. Train-Test Split (80/20)
    X_train, X_test, y_train, y_test = standard_split(df_clean, feature_cols, target_col, test_size=0.2, random_state=42)
    print(f"Dataset split: Train={len(X_train)} samples, Test={len(X_test)} samples")
    
    # 4. Train Linear Regression
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # 5. Evaluate on Test Set
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("\n--- Test Set Evaluation ---")
    print(f"Mean Absolute Error (MAE):      Rs. {mae:.2f}")
    print(f"Root Mean Squared Error (RMSE): Rs. {rmse:.2f}")
    print(f"R-squared (R²):                 {r2:.4f}")
    
    print("\nRegression Coefficients:")
    for feature, coef in zip(feature_cols, model.coef_):
        print(f"  {feature:25s}: {coef:+.4f}")
    print(f"  {'Intercept':25s}: {model.intercept_:+.4f}")
    
    # 6. Save Model using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "profit_model.joblib")
    
    joblib.dump(model, model_path)
    print(f"\n[OK] Model saved to: {model_path}")
    
    # 7. Reload and verify prediction test
    del model
    loaded_model = joblib.load(model_path)
    sample = np.array([[120000.0, 70000.0, 350, 342.8]])
    pred_profit = loaded_model.predict(sample)[0]
    print(f"\nVerification Test Prediction for sample: Rs. {pred_profit:.2f}")
    
    return {"mae": mae, "rmse": rmse, "r2": r2}

if __name__ == "__main__":
    train_profit_model()
