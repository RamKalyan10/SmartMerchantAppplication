"""
Master Model Trainer: Sequentially trains and serializes all 7 syllabus models.
Displays final comprehensive comparison table suitable for lab report / viva presentation.
"""

import os
import sys
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from training.train_sales import train_sales_model
from training.train_demand import train_demand_model
from training.train_catalog import train_catalog_model
from training.train_inventory import train_inventory_model
from training.train_expense import train_expense_model
from training.train_clustering import train_clustering_model
from training.train_profit import train_profit_model

def train_all_models():
    print("=" * 80)
    print("SMART MERCHANT — TRAINING ALL 7 LAB-SYLLABUS MACHINE LEARNING MODELS")
    print("=" * 80)
    
    m1 = train_sales_model()
    print("\n" + "-" * 80 + "\n")
    
    m2 = train_demand_model()
    print("\n" + "-" * 80 + "\n")
    
    m3 = train_catalog_model()
    print("\n" + "-" * 80 + "\n")
    
    m4 = train_inventory_model()
    print("\n" + "-" * 80 + "\n")
    
    m5 = train_expense_model()
    print("\n" + "-" * 80 + "\n")
    
    m6 = train_clustering_model()
    print("\n" + "-" * 80 + "\n")
    
    m7 = train_profit_model()
    print("\n" + "=" * 80 + "\n")
    
    # Compile comparison table
    summary_data = [
        {"Model": "1. Sales Prediction", "Algorithm": "Linear Regression", "Problem Type": "Regression", "Primary Metric": "R² Score", "Score": f"{m1['r2']:.4f}"},
        {"Model": "2. Product Demand", "Algorithm": "KNN Regression", "Problem Type": "Regression", "Primary Metric": "MAE (Units)", "Score": f"{m2['mae']:.2f}"},
        {"Model": "3. Catalog Requirement", "Algorithm": "Decision Tree", "Problem Type": "Classification", "Primary Metric": "Macro F1", "Score": f"{m3['f1']:.4f}"},
        {"Model": "4. Inventory Status", "Algorithm": "Logistic Regression", "Problem Type": "Classification", "Primary Metric": "Macro F1", "Score": f"{m4['f1']:.4f}"},
        {"Model": "5. Expense Prediction", "Algorithm": "Multiple Linear Reg.", "Problem Type": "Regression", "Primary Metric": "R² Score", "Score": f"{m5['r2']:.4f}"},
        {"Model": "6. Business Segmentation", "Algorithm": "K-Means (K=3)", "Problem Type": "Clustering", "Primary Metric": "Silhouette Score", "Score": f"{m6['metrics'][1]['Silhouette']:.4f}"},
        {"Model": "7. Profit Prediction", "Algorithm": "Linear Regression", "Problem Type": "Regression", "Primary Metric": "R² Score", "Score": f"{m7['r2']:.4f}"},
    ]
    
    summary_df = pd.DataFrame(summary_data)
    print("FINAL 7-MODEL LABORATORY EVALUATION SUMMARY TABLE")
    print(summary_df.to_string(index=False))
    print("\n[SUCCESS] All 7 models successfully trained, evaluated, and saved to ml-service/models/")
    return summary_df

if __name__ == "__main__":
    train_all_models()
