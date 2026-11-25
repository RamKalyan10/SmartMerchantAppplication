"""
Model 3: Catalog Requirement — Decision Tree Classifier
Lab Topic: Decision Tree Induction, Pruning & Hyperparameter Tuning
Classifies products into demand velocity categories:
[HIGH_DEMAND, MEDIUM_DEMAND, LOW_DEMAND, SLOW_MOVING, DEAD_STOCK]
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute, standard_split

def train_catalog_model():
    print("=" * 60)
    print("Training Model 3: Catalog Requirement (Decision Tree)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features and Target
    feature_cols = [
        "quantity_sold",
        "sales_30_day",
        "current_stock",
        "turnover_rate",
        "days_since_last_sale",
        "sales_90_day"
    ]
    target_col = "category_label"
    
    # 3. Stratified Train-Test Split (80/20)
    X_train, X_test, y_train, y_test = standard_split(df_clean, feature_cols, target_col, test_size=0.2, random_state=42)
    print(f"Dataset split: Train={len(X_train)} samples, Test={len(X_test)} samples")
    
    # 4. Hyperparameter Tuning for max_depth and min_samples_split
    param_grid = {
        "max_depth": [3, 4, 5, 6],
        "min_samples_split": [2, 5, 10],
        "criterion": ["gini", "entropy"]
    }
    
    grid = GridSearchCV(DecisionTreeClassifier(random_state=42), param_grid, cv=5, scoring="f1_macro")
    grid.fit(X_train, y_train)
    
    print("\n--- Decision Tree Hyperparameter Tuning Results ---")
    print(f"Best Parameters: {grid.best_params_}")
    print(f"Best Cross-Validation Macro F1-score: {grid.best_score_:.4f}")
    
    best_model = grid.best_estimator_
    
    # 5. Evaluate on Test Set
    y_pred = best_model.predict(X_test)
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
    labels = sorted(list(set(y_test)))
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"Actual {l}" for l in labels], columns=[f"Pred {l}" for l in labels])
    print(cm_df.to_string())
    
    print("\nDecision Tree Text Rules (Sample Branches):")
    tree_rules = export_text(best_model, feature_names=feature_cols, max_depth=3)
    print("\n".join(tree_rules.splitlines()[:20])) # show top branches
    
    # 6. Save Model using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "catalog_model.joblib")
    
    joblib.dump(best_model, model_path)
    print(f"\n[OK] Model saved to: {model_path}")
    
    # 7. Reload and verify prediction test
    del best_model
    loaded_model = joblib.load(model_path)
    # Test product with high turnover and high sales
    sample = np.array([[220, 15000.0, 30, 2.5, 0, 46500.0]])
    prediction = loaded_model.predict(sample)[0]
    print(f"Verification Test Prediction for Fast-Moving Sample: {prediction}")
    
    return {"accuracy": accuracy, "f1": f1, "best_params": grid.best_params_}

if __name__ == "__main__":
    train_catalog_model()
