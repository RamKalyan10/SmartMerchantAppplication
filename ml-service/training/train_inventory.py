"""
Model 4: Inventory Status — Logistic Regression
Lab Topic: Logistic Regression & Linear Discriminant Classification
Classifies stock status into actionable operational states:
[RESTOCK, SUFFICIENT, OVERSTOCK]
Features are normalized using a StandardScaler Pipeline.
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute, standard_split

def train_inventory_model():
    print("=" * 60)
    print("Training Model 4: Inventory Status (Logistic Regression)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features and Target
    feature_cols = [
        "current_stock",
        "predicted_demand",
        "reorder_level",
        "quantity_sold",
        "turnover_rate"
    ]
    target_col = "inventory_status"
    
    # 3. Train-Test Split (80/20)
    X_train, X_test, y_train, y_test = standard_split(df_clean, feature_cols, target_col, test_size=0.2, random_state=42)
    print(f"Dataset split: Train={len(X_train)} samples, Test={len(X_test)} samples")
    
    # 4. Construct Pipeline: StandardScaler + LogisticRegression
    # Using multinomial logistic regression with l2 regularization
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(max_iter=500, random_state=42))
    ])
    pipeline.fit(X_train, y_train)
    
    # 5. Evaluate on Test Set
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="macro", zero_division=0)
    recall = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
    
    print("\n--- Test Set Classification Performance ---")
    print(f"Accuracy:        {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision (macro): {precision:.4f}")
    print(f"Recall (macro):    {recall:.4f}")
    print(f"F1-Score (macro):  {f1:.4f}")
    
    print("\nConfusion Matrix:")
    labels = ["RESTOCK", "SUFFICIENT", "OVERSTOCK"]
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"Actual {l}" for l in labels], columns=[f"Pred {l}" for l in labels])
    print(cm_df.to_string())
    
    # 6. Save Model using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "inventory_model.joblib")
    
    joblib.dump(pipeline, model_path)
    print(f"\n[OK] Model pipeline saved to: {model_path}")
    
    # 7. Reload and verify prediction test
    del pipeline
    loaded_pipe = joblib.load(model_path)
    # Test sample: current_stock=15, predicted_demand=100, reorder_level=40, qty_sold=90, turnover=2.2
    depleted_sample = np.array([[15, 100, 40, 90, 2.2]])
    status_pred = loaded_pipe.predict(depleted_sample)[0]
    probs = loaded_pipe.predict_proba(depleted_sample)[0]
    print(f"\nVerification Test Prediction for Depleted Stock Sample:")
    print(f"  Input: {depleted_sample.tolist()}")
    print(f"  Predicted Status: {status_pred}")
    print(f"  Class Probabilities: {dict(zip(loaded_pipe.classes_, [round(p, 3) for p in probs]))}")
    
    return {"accuracy": accuracy, "f1": f1}

if __name__ == "__main__":
    train_inventory_model()
