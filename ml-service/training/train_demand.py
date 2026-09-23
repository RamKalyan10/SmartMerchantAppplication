"""
Model 2: Product Demand Prediction — KNN Regression
Lab Topic: K-Nearest Neighbors Regression & Cross-Validation
Predicts future unit demand for products. Features are normalized via StandardScaler Pipeline.
Optimal K is determined using 5-Fold Cross-Validation.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute, standard_split

def train_demand_model():
    print("=" * 60)
    print("Training Model 2: Product Demand (KNN Regression with CV)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features and Target
    feature_cols = [
        "current_stock",
        "demand_7_day",
        "demand_30_day",
        "average_daily_demand",
        "price",
        "discount"
    ]
    target_col = "predicted_demand"
    
    # 3. Train-Test Split (80/20)
    X_train, X_test, y_train, y_test = standard_split(df_clean, feature_cols, target_col, test_size=0.2, random_state=42)
    print(f"Dataset split: Train={len(X_train)} samples, Test={len(X_test)} samples")
    
    # 4. Cross-Validation to select optimal K in [3, 5, 7, 9, 11]
    k_candidates = [3, 5, 7, 9, 11]
    cv_scores = {}
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    
    print("\n--- 5-Fold Cross-Validation for Optimal K Selection ---")
    print(f"{'K':<5} | {'CV Mean Absolute Error (MAE)':<30}")
    print("-" * 38)
    
    best_k = k_candidates[0]
    best_mae = float("inf")
    
    for k in k_candidates:
        pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("knn", KNeighborsRegressor(n_neighbors=k, weights="distance"))
        ])
        # scoring='neg_mean_absolute_error'
        scores = -cross_val_score(pipe, X_train, y_train, cv=kf, scoring="neg_mean_absolute_error")
        mean_cv_mae = float(np.mean(scores))
        cv_scores[k] = mean_cv_mae
        print(f"{k:<5} | {mean_cv_mae:<30.3f}")
        
        if mean_cv_mae < best_mae:
            best_mae = mean_cv_mae
            best_k = k
            
    print(f"\nOptimal K chosen: K = {best_k} (with lowest CV MAE of {best_mae:.3f} units)")
    
    # 5. Fit the final pipeline on entire training set with optimal K
    best_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("knn", KNeighborsRegressor(n_neighbors=best_k, weights="distance"))
    ])
    best_pipeline.fit(X_train, y_train)
    
    # 6. Evaluate on Test Set
    y_pred = best_pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("\n--- Test Set Evaluation ---")
    print(f"Mean Absolute Error (MAE):    {mae:.2f} units")
    print(f"Root Mean Squared Error (RMSE): {rmse:.2f} units")
    print(f"R-squared (R²):               {r2:.4f}")
    
    # 7. Save Model using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "demand_model.joblib")
    
    joblib.dump(best_pipeline, model_path)
    print(f"\n[OK] Model pipeline saved to: {model_path}")
    
    # 8. Reload and test prediction with business logic demonstration
    del best_pipeline
    loaded_pipe = joblib.load(model_path)
    # Sample product: current_stock=80, demand_7d=120, demand_30d=500, avg_daily=18, price=65.0, discount=5.0
    sample = np.array([[80, 120.0, 500.0, 18.0, 65.0, 5.0]])
    pred_units = int(round(loaded_pipe.predict(sample)[0]))
    current_stk = int(sample[0][0])
    shortage = max(0, pred_units - current_stk)
    
    print("\n--- Business Recommendation Demo ---")
    print(f"Current Stock:    {current_stk} units")
    print(f"Predicted Demand: {pred_units} units")
    print(f"Shortage/Deficit: {shortage} units")
    print(f"Action:           {'RESTOCK ' + str(shortage) + ' UNITS' if shortage > 0 else 'STOCK IS SUFFICIENT'}")
    
    return {"best_k": best_k, "mae": mae, "rmse": rmse, "r2": r2}

if __name__ == "__main__":
    train_demand_model()
