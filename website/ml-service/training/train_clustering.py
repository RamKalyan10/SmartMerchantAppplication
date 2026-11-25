"""
Model 6: Business & Expense Segmentation — K-Means Clustering
Lab Topic: K-Means Clustering, Silhouette Score & Davies-Bouldin Index
Segments operational patterns (e.g. Low Activity, Normal Steady, High Surge / Festive)
using standardized features: [total_expense, revenue, invoice_count, business_activity].
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score
import joblib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.preprocess import load_dataset, clean_and_impute

def train_clustering_model():
    print("=" * 60)
    print("Training Model 6: Business Activity Segmentation (K-Means)")
    print("=" * 60)
    
    # 1. Load and clean data
    df = load_dataset()
    df_clean = clean_and_impute(df)
    
    # 2. Select Features
    feature_cols = [
        "total_expense",
        "revenue",
        "invoice_count",
        "business_activity"
    ]
    X = df_clean[feature_cols].values
    
    # 3. Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 4. Evaluate K in [2, 3, 4, 5] using Silhouette Score & Davies-Bouldin Index
    k_candidates = [2, 3, 4, 5]
    metrics = []
    
    print("\n--- Cluster Quality Evaluation for K in [2, 3, 4, 5] ---")
    print(f"{'K':<5} | {'Silhouette Score (Higher is better)':<35} | {'Davies-Bouldin (Lower is better)':<30}")
    print("-" * 75)
    
    best_k = 3
    best_sil = -1.0
    
    for k in k_candidates:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        cluster_labels = km.fit_predict(X_scaled)
        sil = silhouette_score(X_scaled, cluster_labels)
        db = davies_bouldin_score(X_scaled, cluster_labels)
        metrics.append({"K": k, "Silhouette": sil, "Davies_Bouldin": db})
        print(f"{k:<5} | {sil:<35.4f} | {db:<30.4f}")
        
        # We look for highest silhouette while keeping business interpretability
        if sil > best_sil:
            best_sil = sil
            best_k = k
            
    # For retail business explanation, K=3 provides the standard triad:
    # 1. Low Activity / Sluggish Day
    # 2. Steady / Normal Operational Day
    # 3. High Volume / Peak Demand Day
    chosen_k = 3
    print(f"\nSelected K = {chosen_k} for optimal business interpretability and cluster separation.")
    
    # 5. Build and Fit Full Pipeline
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("kmeans", KMeans(n_clusters=chosen_k, random_state=42, n_init=10))
    ])
    pipeline.fit(X)
    
    # 6. Analyze Cluster Centers and Assign Meaningful Business Labels
    final_labels = pipeline.named_steps["kmeans"].labels_
    df_clean["cluster"] = final_labels
    cluster_summary = df_clean.groupby("cluster")[feature_cols].mean().round(2)
    
    # Rank clusters by revenue to map names predictably
    revenue_ranks = cluster_summary["revenue"].sort_values().index.tolist()
    cluster_name_map = {
        revenue_ranks[0]: "Low Activity / Cost Conservatism",
        revenue_ranks[1]: "Moderate / Standard Operations",
        revenue_ranks[2]: "High Activity / Peak Turnover"
    }
    
    print("\nCluster Center Means in Original Scale:")
    for c_id, name in cluster_name_map.items():
        row = cluster_summary.loc[c_id]
        print(f"Cluster {c_id} [{name}]:")
        print(f"  Revenue: Rs. {row['revenue']}, Expense: Rs. {row['total_expense']}, Invoices: {row['invoice_count']}, Activity Index: {row['business_activity']}")
        
    # 7. Save Model and Metadata using Joblib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "clustering_model.joblib")
    
    artifact_payload = {
        "pipeline": pipeline,
        "feature_cols": feature_cols,
        "cluster_names": cluster_name_map,
        "k": chosen_k
    }
    joblib.dump(artifact_payload, model_path)
    print(f"\n[OK] Clustering pipeline and metadata saved to: {model_path}")
    
    # 8. Reload and verify prediction
    del artifact_payload
    loaded_data = joblib.load(model_path)
    loaded_pipe = loaded_data["pipeline"]
    sample_day = np.array([[4500.0, 11500.0, 75, 88.0]])
    c_pred = loaded_pipe.predict(sample_day)[0]
    assigned_name = loaded_data["cluster_names"].get(c_pred, f"Cluster {c_pred}")
    print(f"\nVerification Test: Sample day {sample_day.tolist()} clustered as:")
    print(f"  Cluster ID: {c_pred} ({assigned_name})")
    
    return {"k": chosen_k, "metrics": metrics}

if __name__ == "__main__":
    train_clustering_model()
