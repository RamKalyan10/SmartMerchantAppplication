"""
Jupyter Notebook Generator for Smart Merchant Lab ML Pipeline
Generates 8 valid, self-contained .ipynb notebooks using nbformat v4:
- 00_complete_pipeline.ipynb (Master End-to-End Notebook)
- 01_sales_linear_regression.ipynb
- 02_demand_knn_regression.ipynb
- 03_catalog_decision_tree.ipynb
- 04_inventory_logistic_regression.ipynb
- 05_expense_linear_regression.ipynb
- 06_kmeans_business_segmentation.ipynb
- 07_profit_linear_regression.ipynb
"""

import os
import nbformat as nbf

def create_master_pipeline_notebook(output_path: str):
    nb = nbf.v4.new_notebook()
    cells = []
    
    # Section 1: Intro
    cells.append(nbf.v4.new_markdown_cell("""# Smart Merchant: End-to-End Lab Machine Learning Pipeline
### College Data Mining & DWDM Laboratory Submission
**Project:** Smart Merchant — AI-Powered Merchant Management and Business Intelligence Platform  
**Algorithms Used:**
1. **Sales Prediction** — Linear Regression
2. **Product Demand** — K-Nearest Neighbors (KNN) Regression
3. **Catalog Classification** — Decision Tree Classifier
4. **Inventory Status** — Logistic Regression
5. **Expense Prediction** — Multiple Linear Regression
6. **Business Segmentation** — K-Means Clustering
7. **Profit Prediction** — Linear Regression

---
## Pipeline Overview
This notebook executes the complete machine learning lifecycle:
`Data Loading -> Preprocessing -> EDA -> Model Training & Tuning -> Evaluation -> Joblib Persistence -> Business Decision Synthesis`
"""))

    # Section 2: Imports & Dataset
    cells.append(nbf.v4.new_markdown_cell("## Section 1: Library Imports & Master Dataset Loading"))
    cells.append(nbf.v4.new_code_cell("""import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import joblib

# Scikit-Learn tools
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score, KFold, GridSearchCV
from sklearn.metrics import (
    mean_absolute_error, root_mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, silhouette_score, davies_bouldin_score
)

# Set plot style
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
%matplotlib inline

# Load dataset
data_path = os.path.join("..", "data", "smart_merchant_master.csv")
if not os.path.exists(data_path):
    sys.path.append(os.path.abspath(".."))
    from data.generate_data import generate_master_dataset
    df = generate_master_dataset(num_records=1000, random_state=42, output_path=data_path)
else:
    df = pd.read_csv(data_path)

print(f"Dataset Loaded Successfully! Shape: {df.shape[0]} rows, {df.shape[1]} columns")
df.head(5)"""))

    # Section 3: Preprocessing
    cells.append(nbf.v4.new_markdown_cell("""## Section 2: Data Preprocessing & Descriptive Statistics
In this section we demonstrate standard Data Mining Lab preprocessing:
- Missing value detection & median imputation
- Duplicate detection
- Descriptive statistics (Mean, Median, Mode, Standard Deviation, IQR)
- Outlier inspection using the 1.5 * IQR method
"""))
    cells.append(nbf.v4.new_code_cell("""# 1. Inspect Missing Values
print("--- Missing Value Summary ---")
null_counts = df.isnull().sum()
print(null_counts[null_counts > 0])

# 2. Impute missing values (median for numeric, mode for categorical)
df_clean = df.copy()
for col in df_clean.select_dtypes(include=[np.number]).columns:
    if df_clean[col].isnull().any():
        df_clean[col] = df_clean[col].fillna(df_clean[col].median())

for col in df_clean.select_dtypes(include=['object']).columns:
    if df_clean[col].isnull().any():
        df_clean[col] = df_clean[col].fillna(df_clean[col].mode()[0])

print(f"Total Missing Values Remaining after Imputation: {df_clean.isnull().sum().sum()}")

# 3. Descriptive Statistics Table
stats_cols = ['revenue', 'total_expense', 'invoice_count', 'quantity_sold', 'predicted_demand', 'profit']
stats_list = []
for c in stats_cols:
    s = df_clean[c]
    stats_list.append({
        'Feature': c,
        'Mean': round(float(s.mean()), 2),
        'Median': round(float(s.median()), 2),
        'Mode': round(float(s.mode().iloc[0]), 2),
        'Std Dev': round(float(s.std()), 2),
        'IQR': round(float(s.quantile(0.75) - s.quantile(0.25)), 2)
    })
desc_df = pd.DataFrame(stats_list)
desc_df"""))

    # Section 4: EDA
    cells.append(nbf.v4.new_markdown_cell("""## Section 3: Exploratory Data Analysis (EDA) & Outlier Analysis
Visualizing distribution, time-series trends, and genuine business surge events (e.g., Diwali / festival surges)."""))
    cells.append(nbf.v4.new_code_cell("""# Outlier analysis on Revenue
q1 = df_clean['revenue'].quantile(0.25)
q3 = df_clean['revenue'].quantile(0.75)
iqr = q3 - q1
upper_bound = q3 + 1.5 * iqr

outliers = df_clean[df_clean['revenue'] > upper_bound]
print(f"Revenue Upper Outlier Threshold (Q3 + 1.5*IQR): Rs. {upper_bound:.2f}")
print(f"Number of Outlier Records Identified: {len(outliers)}")
print("Business Explanation: These represent genuine festive surges (e.g. Diwali season), NOT corrupted data.")

# Visualizations: Revenue trend and distributions
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
axes[0].plot(df_clean['revenue'].values[:120], color='#2563eb', lw=1.8, label='Daily Revenue')
axes[0].axhline(upper_bound, color='#dc2626', linestyle='--', label='IQR Outlier Boundary')
axes[0].set_title("First 120 Days Revenue Trend & Outlier Boundary", fontsize=12, fontweight='bold')
axes[0].set_xlabel("Day Index")
axes[0].set_ylabel("Revenue (Rs.)")
axes[0].legend()

axes[1].hist(df_clean['revenue'], bins=35, color='#3b82f6', edgecolor='black', alpha=0.8)
axes[1].set_title("Revenue Frequency Distribution", fontsize=12, fontweight='bold')
axes[1].set_xlabel("Daily Revenue (Rs.)")
axes[1].set_ylabel("Frequency")
plt.tight_layout()
plt.show()"""))

    # Section 5: Model 1 - Sales
    cells.append(nbf.v4.new_markdown_cell("""## Section 4: Model 1 — Sales Prediction (Linear Regression)
- **Problem:** Forecast daily store turnover (continuous target).
- **Algorithm:** Linear Regression.
- **Data Splitting:** Chronological 80/20 split to eliminate lookahead leakage.
"""))
    cells.append(nbf.v4.new_code_cell("""# Features and Target
sales_feats = ["previous_day_sales", "sales_7_day_average", "sales_30_day_average", "invoice_count", "quantity_sold", "discount"]
split_idx = int(len(df_clean) * 0.8)

X_train_sales = df_clean.iloc[:split_idx][sales_feats].values
y_train_sales = df_clean.iloc[:split_idx]["revenue"].values
X_test_sales = df_clean.iloc[split_idx:][sales_feats].values
y_test_sales = df_clean.iloc[split_idx:][sales_feats].values  # evaluate against actual
y_test_sales = df_clean.iloc[split_idx:]["revenue"].values

# Train Linear Regression
sales_model = LinearRegression()
sales_model.fit(X_train_sales, y_train_sales)

y_pred_sales = sales_model.predict(X_test_sales)
m1_mae = mean_absolute_error(y_test_sales, y_pred_sales)
m1_rmse = root_mean_squared_error(y_test_sales, y_pred_sales)
m1_r2 = r2_score(y_test_sales, y_pred_sales)

print(f"Sales Model Evaluation: MAE = Rs. {m1_mae:.2f} | RMSE = Rs. {m1_rmse:.2f} | R² = {m1_r2:.4f}")

# Save with joblib
os.makedirs("../models", exist_ok=True)
joblib.dump(sales_model, "../models/sales_model.joblib")

# Visualization: Actual vs Predicted Sales
plt.figure(figsize=(10, 4.5))
plt.plot(y_test_sales[:60], label='Actual Revenue', color='#10b981', lw=2)
plt.plot(y_pred_sales[:60], label='Predicted Revenue (Linear Reg)', color='#6366f1', linestyle='--', lw=2)
plt.title("Actual vs Predicted Sales Revenue (First 60 Test Days)", fontsize=12, fontweight='bold')
plt.xlabel("Test Day Index")
plt.ylabel("Revenue (Rs.)")
plt.legend()
plt.tight_layout()
plt.show()"""))

    # Section 6: Model 2 - Demand (KNN)
    cells.append(nbf.v4.new_markdown_cell("""## Section 5: Model 2 — Product Demand Prediction (KNN Regression)
- **Problem:** Estimate future units demanded for retail products.
- **Algorithm:** K-Nearest Neighbors Regression with StandardScaler.
- **Tuning:** Cross-validation across $K \in [3, 5, 7, 9, 11]$ to select optimal $K$.
"""))
    cells.append(nbf.v4.new_code_cell("""demand_feats = ["current_stock", "demand_7_day", "demand_30_day", "average_daily_demand", "price", "discount"]
X_dem = df_clean[demand_feats].values
y_dem = df_clean["predicted_demand"].values
X_tr_dem, X_te_dem, y_tr_dem, y_te_dem = train_test_split(X_dem, y_dem, test_size=0.2, random_state=42)

# Cross Validation for K selection
k_vals = [3, 5, 7, 9, 11]
cv_maes = []
for k in k_vals:
    pipe = Pipeline([('scaler', StandardScaler()), ('knn', KNeighborsRegressor(n_neighbors=k, weights='distance'))])
    scores = -cross_val_score(pipe, X_tr_dem, y_tr_dem, cv=5, scoring='neg_mean_absolute_error')
    cv_maes.append(float(np.mean(scores)))

best_k = k_vals[np.argmin(cv_maes)]
print(f"Cross-Validation complete! Best K = {best_k} (lowest CV MAE: {min(cv_maes):.3f})")

# Fit final KNN pipeline with best K
demand_pipeline = Pipeline([('scaler', StandardScaler()), ('knn', KNeighborsRegressor(n_neighbors=best_k, weights='distance'))])
demand_pipeline.fit(X_tr_dem, y_tr_dem)
y_pred_dem = demand_pipeline.predict(X_te_dem)
m2_mae = mean_absolute_error(y_te_dem, y_pred_dem)
m2_r2 = r2_score(y_te_dem, y_pred_dem)

print(f"KNN Demand Model: MAE = {m2_mae:.2f} units | R² = {m2_r2:.4f}")
joblib.dump(demand_pipeline, "../models/demand_model.joblib")

# Plot K vs CV MAE
plt.figure(figsize=(7, 4))
plt.plot(k_vals, cv_maes, marker='o', color='#ea580c', lw=2)
plt.title("KNN Hyperparameter Tuning: K vs Cross-Validation MAE", fontsize=11, fontweight='bold')
plt.xlabel("Number of Neighbors (K)")
plt.ylabel("5-Fold CV MAE (Units)")
plt.xticks(k_vals)
plt.tight_layout()
plt.show()"""))

    # Section 7: Model 3 - Catalog (Decision Tree)
    cells.append(nbf.v4.new_markdown_cell("""## Section 6: Model 3 — Catalog Requirement Classification (Decision Tree)
- **Problem:** Categorize products into velocity tiers: `[HIGH_DEMAND, MEDIUM_DEMAND, LOW_DEMAND, SLOW_MOVING, DEAD_STOCK]`.
- **Algorithm:** Decision Tree Classifier with hyperparameter tuning (`max_depth`, `min_samples_split`).
"""))
    cells.append(nbf.v4.new_code_cell("""cat_feats = ["quantity_sold", "sales_30_day", "current_stock", "turnover_rate", "days_since_last_sale", "sales_90_day"]
X_cat = df_clean[cat_feats].values
y_cat = df_clean["category_label"].values
X_tr_cat, X_te_cat, y_tr_cat, y_te_cat = train_test_split(X_cat, y_cat, test_size=0.2, random_state=42)

# Grid search for Decision Tree tuning
param_grid = {'max_depth': [3, 4, 5], 'min_samples_split': [2, 5]}
tree_grid = GridSearchCV(DecisionTreeClassifier(random_state=42), param_grid, cv=5, scoring='f1_macro')
tree_grid.fit(X_tr_cat, y_tr_cat)

best_tree = tree_grid.best_estimator_
y_pred_cat = best_tree.predict(X_te_cat)
m3_acc = accuracy_score(y_te_cat, y_pred_cat)
m3_f1 = f1_score(y_te_cat, y_pred_cat, average='macro')

print(f"Best Tree Parameters: {tree_grid.best_params_}")
print(f"Catalog Model Performance: Accuracy = {m3_acc*100:.2f}% | Macro F1 = {m3_f1:.4f}")
joblib.dump(best_tree, "../models/catalog_model.joblib")

# Visualizing the Decision Tree
plt.figure(figsize=(16, 7))
plot_tree(best_tree, feature_names=cat_feats, class_names=sorted(list(set(y_cat))), filled=True, rounded=True, max_depth=2, fontsize=10)
plt.title("Decision Tree Visualization (Pruned to Depth 2 for Viva Explanation)", fontsize=13, fontweight='bold')
plt.show()"""))

    # Section 8: Model 4 - Inventory (Logistic Regression)
    cells.append(nbf.v4.new_markdown_cell("""## Section 7: Model 4 — Inventory Status (Logistic Regression)
- **Problem:** Classify product stock status into operational states: `[RESTOCK, SUFFICIENT, OVERSTOCK]`.
- **Algorithm:** Multinomial Logistic Regression with StandardScaler.
"""))
    cells.append(nbf.v4.new_code_cell("""inv_feats = ["current_stock", "predicted_demand", "reorder_level", "quantity_sold", "turnover_rate"]
X_inv = df_clean[inv_feats].values
y_inv = df_clean["inventory_status"].values
X_tr_inv, X_te_inv, y_tr_inv, y_te_inv = train_test_split(X_inv, y_inv, test_size=0.2, random_state=42)

inv_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('logistic', LogisticRegression(max_iter=500, random_state=42))
])
inv_pipeline.fit(X_tr_inv, y_tr_inv)
y_pred_inv = inv_pipeline.predict(X_te_inv)
m4_acc = accuracy_score(y_te_inv, y_pred_inv)
m4_f1 = f1_score(y_te_inv, y_pred_inv, average='macro')

print(f"Inventory Status Model: Accuracy = {m4_acc*100:.2f}% | Macro F1 = {m4_f1:.4f}")
joblib.dump(inv_pipeline, "../models/inventory_model.joblib")

# Confusion Matrix Heatmap
labels = ["RESTOCK", "SUFFICIENT", "OVERSTOCK"]
cm = confusion_matrix(y_te_inv, y_pred_inv, labels=labels)
fig, ax = plt.subplots(figsize=(6, 5))
cax = ax.matshow(cm, cmap='Blues')
plt.title("Inventory Status Confusion Matrix", fontsize=11, fontweight='bold', pad=15)
fig.colorbar(cax)
ax.set_xticks(range(len(labels)))
ax.set_yticks(range(len(labels)))
ax.set_xticklabels(labels)
ax.set_yticklabels(labels)
for i in range(len(labels)):
    for j in range(len(labels)):
        ax.text(j, i, str(cm[i, j]), ha='center', va='center', color='red' if cm[i, j] < 5 else 'white', fontweight='bold')
plt.xlabel("Predicted Label")
plt.ylabel("True Label")
plt.tight_layout()
plt.show()"""))

    # Section 9: Model 5 - Expense (Multiple Linear Regression)
    cells.append(nbf.v4.new_markdown_cell("""## Section 8: Model 5 — Expense Prediction (Multiple Linear Regression)
- **Problem:** Forecast total business overhead expenses.
- **Algorithm:** Multiple Linear Regression.
"""))
    cells.append(nbf.v4.new_code_cell("""exp_feats = ["previous_day_sales", "sales_7_day_average", "invoice_count", "business_activity", "expense_3_month_average"]
X_tr_exp = df_clean.iloc[:split_idx][exp_feats].values
y_tr_exp = df_clean.iloc[:split_idx]["total_expense"].values
X_te_exp = df_clean.iloc[split_idx:][exp_feats].values
y_te_exp = df_clean.iloc[split_idx:]["total_expense"].values

exp_model = LinearRegression()
exp_model.fit(X_tr_exp, y_tr_exp)
y_pred_exp = exp_model.predict(X_te_exp)
m5_mae = mean_absolute_error(y_te_exp, y_pred_exp)
m5_r2 = r2_score(y_te_exp, y_pred_exp)

print(f"Expense Model: MAE = Rs. {m5_mae:.2f} | R² = {m5_r2:.4f}")
joblib.dump(exp_model, "../models/expense_model.joblib")

# Scatter Plot: Actual vs Predicted Expenses
plt.figure(figsize=(7, 5))
plt.scatter(y_te_exp, y_pred_exp, alpha=0.6, color='#8b5cf6', edgecolor='black')
plt.plot([y_te_exp.min(), y_te_exp.max()], [y_te_exp.min(), y_te_exp.max()], 'r--', lw=2)
plt.title("Actual vs Predicted Expenses (Multiple Linear Regression)", fontsize=11, fontweight='bold')
plt.xlabel("Actual Expense (Rs.)")
plt.ylabel("Predicted Expense (Rs.)")
plt.tight_layout()
plt.show()"""))

    # Section 10: Model 6 - K-Means Clustering
    cells.append(nbf.v4.new_markdown_cell("""## Section 9: Model 6 — Business / Expense Segmentation (K-Means)
- **Problem:** Discover operational patterns and flag unusual spending.
- **Algorithm:** K-Means Clustering with StandardScaler.
- **Evaluation:** Silhouette Score & Davies-Bouldin Index.
"""))
    cells.append(nbf.v4.new_code_cell("""cluster_feats = ["total_expense", "revenue", "invoice_count", "business_activity"]
X_clus = df_clean[cluster_feats].values
scaler = StandardScaler()
X_clus_scaled = scaler.fit_transform(X_clus)

sil_scores = []
db_scores = []
k_range = [2, 3, 4, 5]
for k in k_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labs = km.fit_predict(X_clus_scaled)
    sil_scores.append(silhouette_score(X_clus_scaled, labs))
    db_scores.append(davies_bouldin_score(X_clus_scaled, labs))

# Print Cluster Metric Table
clus_metrics_df = pd.DataFrame({"K": k_range, "Silhouette Score": sil_scores, "Davies-Bouldin Index": db_scores})
print(clus_metrics_df.to_string(index=False))

# Fit final model with K=3
chosen_k = 3
clus_pipe = Pipeline([('scaler', StandardScaler()), ('kmeans', KMeans(n_clusters=chosen_k, random_state=42, n_init=10))])
df_clean['cluster'] = clus_pipe.fit_predict(X_clus)

cluster_names = {0: "Low Activity / Sluggish Day", 1: "Standard Steady Operations", 2: "Peak Demand / High Surge"}
joblib.dump({"pipeline": clus_pipe, "feature_cols": cluster_feats, "cluster_names": cluster_names, "k": chosen_k}, "../models/clustering_model.joblib")

# 2D Scatter plot of clusters: Revenue vs Total Expense
plt.figure(figsize=(8, 5))
scatter = plt.scatter(df_clean['revenue'], df_clean['total_expense'], c=df_clean['cluster'], cmap='viridis', alpha=0.7, edgecolors='k')
plt.title("K-Means Business Activity Clusters (K=3)", fontsize=12, fontweight='bold')
plt.xlabel("Daily Revenue (Rs.)")
plt.ylabel("Total Overhead Expense (Rs.)")
plt.colorbar(scatter, label='Cluster ID')
plt.tight_layout()
plt.show()"""))

    # Section 11: Model 7 - Profit
    cells.append(nbf.v4.new_markdown_cell("""## Section 10: Model 7 — Profit Prediction (Linear Regression)
- **Problem:** Forecast net bottom-line merchant profit.
- **Algorithm:** Linear Regression.
"""))
    cells.append(nbf.v4.new_code_cell("""profit_feats = ["revenue", "total_expense", "invoice_count", "average_order_value"]
X_prof = df_clean[profit_feats].values
y_prof = df_clean["profit"].values
X_tr_prof, X_te_prof, y_tr_prof, y_te_prof = train_test_split(X_prof, y_prof, test_size=0.2, random_state=42)

prof_model = LinearRegression()
prof_model.fit(X_tr_prof, y_tr_prof)
y_pred_prof = prof_model.predict(X_te_prof)
m7_mae = mean_absolute_error(y_te_prof, y_pred_prof)
m7_r2 = r2_score(y_te_prof, y_pred_prof)

print(f"Profit Model: MAE = Rs. {m7_mae:.2f} | R² = {m7_r2:.4f}")
joblib.dump(prof_model, "../models/profit_model.joblib")

# Residual plot
residuals = y_te_prof - y_pred_prof
plt.figure(figsize=(8, 4))
plt.scatter(y_pred_prof, residuals, color='#059669', alpha=0.6, edgecolors='k')
plt.axhline(0, color='red', linestyle='--')
plt.title("Profit Prediction Residual Plot (Errors Centered on Zero)", fontsize=11, fontweight='bold')
plt.xlabel("Predicted Profit (Rs.)")
plt.ylabel("Residual Error (Rs.)")
plt.tight_layout()
plt.show()"""))

    # Section 12: Model Comparison Table
    cells.append(nbf.v4.new_markdown_cell("""## Section 11: Master Model Evaluation & Comparison Table
Comprehensive summary table of all 7 models aligned with syllabus topics."""))
    cells.append(nbf.v4.new_code_cell("""comparison_table = pd.DataFrame([
    {"Model": "1. Sales Prediction", "Algorithm": "Linear Regression", "Problem Type": "Regression", "Primary Metric": "R²", "Score": f"{m1_r2:.4f}"},
    {"Model": "2. Product Demand", "Algorithm": "KNN Regression", "Problem Type": "Regression", "Primary Metric": "MAE (Units)", "Score": f"{m2_mae:.2f}"},
    {"Model": "3. Catalog Requirement", "Algorithm": "Decision Tree", "Problem Type": "Classification", "Primary Metric": "Macro F1", "Score": f"{m3_f1:.4f}"},
    {"Model": "4. Inventory Status", "Algorithm": "Logistic Regression", "Problem Type": "Classification", "Primary Metric": "Macro F1", "Score": f"{m4_f1:.4f}"},
    {"Model": "5. Expense Prediction", "Algorithm": "Multiple Linear Reg.", "Problem Type": "Regression", "Primary Metric": "R²", "Score": f"{m5_r2:.4f}"},
    {"Model": "6. Business Segmentation", "Algorithm": "K-Means (K=3)", "Problem Type": "Clustering", "Primary Metric": "Silhouette", "Score": f"{sil_scores[1]:.4f}"},
    {"Model": "7. Profit Prediction", "Algorithm": "Linear Regression", "Problem Type": "Regression", "Primary Metric": "R²", "Score": f"{m7_r2:.4f}"},
])
comparison_table"""))

    # Section 13: Business Rules & Decision Recommendations
    cells.append(nbf.v4.new_markdown_cell("""## Section 12: Business Rules & Actionable Recommendations
Demonstrating how predictions are synthesized into practical merchant decisions without replacing business logic with black-box ML:
- If Shortage > 0 -> RESTOCK recommendation
- If Catalog == DEAD_STOCK -> Liquidation alert
- If Cluster == High Surge -> Allocate extra staffing
"""))
    cells.append(nbf.v4.new_code_cell("""# Example synthesis demonstration
sample_product_stock = 80
sample_demand_pred = int(round(demand_pipeline.predict([[80, 120, 500, 18, 65, 5]])[0]))
shortage = max(0, sample_demand_pred - sample_product_stock)

print("=" * 60)
print("EXECUTIVE DECISION SYNTHESIS DEMONSTRATION")
print("=" * 60)
print(f"Product: Basmati Rice 5kg")
print(f"Current On-Hand Stock:    {sample_product_stock} units")
print(f"KNN Predicted Demand:     {sample_demand_pred} units")
print(f"Calculated Deficit:       {shortage} units")
print(f"Actionable Recommendation: {'RESTOCK ' + str(shortage) + ' UNITS' if shortage > 0 else 'STOCK IS SUFFICIENT'}")
print("=" * 60)"""))

    # Section 14: Conclusion
    cells.append(nbf.v4.new_markdown_cell("""## Section 13: Conclusion & Lab Viva Summary
- **Simplicity & Explainability:** Every algorithm is grounded directly in the DWDM lab syllabus.
- **Pipeline Integrity:** Chronological splitting prevents lookahead data leakage in forecasting.
- **Persistence:** All 7 models are saved as standard `.joblib` artifacts and can be reloaded instantly for inference without retraining.
"""))

    nb['cells'] = cells
    with open(output_path, 'w', encoding='utf-8') as f:
        nbf.write(nb, f)
    print(f"[OK] Master notebook generated: {output_path}")

def generate_individual_notebook(num: str, title: str, algo: str, desc: str, code_snippets: list, output_path: str):
    nb = nbf.v4.new_notebook()
    cells = [
        nbf.v4.new_markdown_cell(f"""# Model {num}: {title}
### College Data Mining & DWDM Laboratory Submission
**Algorithm:** {algo}  
**Problem Type:** {desc}  
**Key Concepts Demonstrated:**
- Syllabus-aligned algorithm implementation
- Data preprocessing & descriptive statistics
- Model training, hyperparameter tuning & evaluation
- Joblib model serialization and sample inference
"""),
        nbf.v4.new_code_cell("""import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import joblib

# Ensure parent directory is in path
sys.path.append(os.path.abspath(".."))
from preprocessing.preprocess import load_dataset, clean_and_impute

# Load and clean dataset
df = load_dataset()
df_clean = clean_and_impute(df)
print(f"Dataset ready: {df_clean.shape[0]} rows, {df_clean.shape[1]} columns")
df_clean.head(3)
""")
    ]
    
    for code in code_snippets:
        cells.append(nbf.v4.new_code_cell(code))
        
    nb['cells'] = cells
    with open(output_path, 'w', encoding='utf-8') as f:
        nbf.write(nb, f)
    print(f"[OK] Individual notebook generated: {output_path}")

def build_all_notebooks():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    nb_dir = os.path.join(base_dir, "notebooks")
    os.makedirs(nb_dir, exist_ok=True)
    
    # 00 Master notebook
    create_master_pipeline_notebook(os.path.join(nb_dir, "00_complete_pipeline.ipynb"))
    
    # 01 Sales
    generate_individual_notebook(
        "01", "Sales Revenue Forecasting", "Linear Regression", "Time-Series Regression",
        [
            """from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

# Chronological split to prevent data leakage
feature_cols = ["previous_day_sales", "sales_7_day_average", "sales_30_day_average", "invoice_count", "quantity_sold", "discount"]
target_col = "revenue"
split_idx = int(len(df_clean) * 0.8)

X_train, y_train = df_clean.iloc[:split_idx][feature_cols].values, df_clean.iloc[:split_idx][target_col].values
X_test, y_test = df_clean.iloc[split_idx:][feature_cols].values, df_clean.iloc[split_idx:][target_col].values

model = LinearRegression()
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print(f"Evaluation Metrics:")
print(f"  MAE:  Rs. {mean_absolute_error(y_test, y_pred):.2f}")
print(f"  RMSE: Rs. {root_mean_squared_error(y_test, y_pred):.2f}")
print(f"  R²:   {r2_score(y_test, y_pred):.4f}")
""",
            """# Visualization: Actual vs Predicted Sales
plt.figure(figsize=(10, 4.5))
plt.plot(y_test[:50], label='Actual Revenue', color='#2563eb', lw=2)
plt.plot(y_pred[:50], label='Predicted Revenue', color='#f59e0b', linestyle='--', lw=2)
plt.title("Actual vs Predicted Sales Revenue", fontsize=12, fontweight='bold')
plt.xlabel("Test Day Index")
plt.ylabel("Revenue (Rs.)")
plt.legend()
plt.tight_layout()
plt.show()
""",
            """# Model Persistence using Joblib
joblib.dump(model, "../models/sales_model.joblib")
del model
loaded_model = joblib.load("../models/sales_model.joblib")

sample = np.array([[4000.0, 4300.0, 4100.0, 35, 120, 5.0]])
print(f"Reloaded Model Prediction for Sample: Rs. {loaded_model.predict(sample)[0]:.2f}")
"""
        ],
        os.path.join(nb_dir, "01_sales_linear_regression.ipynb")
    )
    
    # 02 Demand
    generate_individual_notebook(
        "02", "Product Demand Estimation", "KNN Regression", "Continuous Regression with Feature Scaling",
        [
            """from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsRegressor
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

feature_cols = ["current_stock", "demand_7_day", "demand_30_day", "average_daily_demand", "price", "discount"]
X = df_clean[feature_cols].values
y = df_clean["predicted_demand"].values
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Cross Validation for K in [3, 5, 7, 9, 11]
k_candidates = [3, 5, 7, 9, 11]
cv_scores = {}
for k in k_candidates:
    pipe = Pipeline([('scaler', StandardScaler()), ('knn', KNeighborsRegressor(n_neighbors=k, weights='distance'))])
    scores = -cross_val_score(pipe, X_train, y_train, cv=5, scoring='neg_mean_absolute_error')
    cv_scores[k] = float(np.mean(scores))
    print(f"K={k:2d} | 5-Fold CV MAE: {cv_scores[k]:.3f} units")

best_k = min(cv_scores, key=cv_scores.get)
print(f"\\nOptimal K Selected: K = {best_k}")
""",
            """# Fit Final Model and Evaluate
best_pipe = Pipeline([('scaler', StandardScaler()), ('knn', KNeighborsRegressor(n_neighbors=best_k, weights='distance'))])
best_pipe.fit(X_train, y_train)
y_pred = best_pipe.predict(X_test)

print(f"Test Set MAE:  {mean_absolute_error(y_test, y_pred):.2f} units")
print(f"Test Set RMSE: {root_mean_squared_error(y_test, y_pred):.2f} units")
print(f"Test Set R²:   {r2_score(y_test, y_pred):.4f}")

# Plot K vs CV MAE
plt.figure(figsize=(7, 4))
plt.plot(list(cv_scores.keys()), list(cv_scores.values()), marker='o', color='#ea580c', lw=2)
plt.title("KNN: Number of Neighbors (K) vs Cross-Validation MAE", fontsize=11, fontweight='bold')
plt.xlabel("K")
plt.ylabel("CV MAE (Units)")
plt.tight_layout()
plt.show()
""",
            """# Joblib Save & Business Rule Demo
joblib.dump(best_pipe, "../models/demand_model.joblib")
del best_pipe
loaded_pipe = joblib.load("../models/demand_model.joblib")

sample = np.array([[80, 120.0, 500.0, 18.0, 65.0, 5.0]])
predicted_units = int(round(loaded_pipe.predict(sample)[0]))
current_stock = int(sample[0][0])
shortage = max(0, predicted_units - current_stock)

print(f"Current Stock:    {current_stock} units")
print(f"Predicted Demand: {predicted_units} units")
print(f"Shortage/Deficit: {shortage} units")
print(f"Business Action:  {'RESTOCK ' + str(shortage) + ' UNITS' if shortage > 0 else 'STOCK SUFFICIENT'}")
"""
        ],
        os.path.join(nb_dir, "02_demand_knn_regression.ipynb")
    )
    
    # 03 Catalog
    generate_individual_notebook(
        "03", "Catalog Classification", "Decision Tree Classifier", "Multiclass Classification",
        [
            """from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

feature_cols = ["quantity_sold", "sales_30_day", "current_stock", "turnover_rate", "days_since_last_sale", "sales_90_day"]
X = df_clean[feature_cols].values
y = df_clean["category_label"].values
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Tune max_depth and min_samples_split
param_grid = {'max_depth': [3, 4, 5], 'min_samples_split': [2, 5, 10]}
grid = GridSearchCV(DecisionTreeClassifier(random_state=42), param_grid, cv=5, scoring='f1_macro')
grid.fit(X_train, y_train)

best_tree = grid.best_estimator_
y_pred = best_tree.predict(X_test)

print(f"Best Parameters: {grid.best_params_}")
print(f"Accuracy:        {accuracy_score(y_test, y_pred)*100:.2f}%")
print(f"Macro F1-Score:  {f1_score(y_test, y_pred, average='macro'):.4f}")
""",
            """# Plot Decision Tree
plt.figure(figsize=(16, 7))
plot_tree(best_tree, feature_names=feature_cols, class_names=sorted(list(set(y))), filled=True, rounded=True, max_depth=2, fontsize=10)
plt.title("Decision Tree Visualization (Pruned to Depth 2 for Viva Explanation)", fontsize=12, fontweight='bold')
plt.show()
""",
            """# Joblib Save & Test
joblib.dump(best_tree, "../models/catalog_model.joblib")
del best_tree
loaded_tree = joblib.load("../models/catalog_model.joblib")

sample = np.array([[220, 15000.0, 30, 2.5, 0, 46500.0]])
print(f"Classified Catalog Tier: {loaded_tree.predict(sample)[0]}")
"""
        ],
        os.path.join(nb_dir, "03_catalog_decision_tree.ipynb")
    )
    
    # 04 Inventory
    generate_individual_notebook(
        "04", "Inventory Status Prediction", "Logistic Regression", "Multiclass Classification with Feature Scaling",
        [
            """from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix

feature_cols = ["current_stock", "predicted_demand", "reorder_level", "quantity_sold", "turnover_rate"]
X = df_clean[feature_cols].values
y = df_clean["inventory_status"].values
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('logreg', LogisticRegression(max_iter=500, random_state=42))
])
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)

print(f"Accuracy:       {accuracy_score(y_test, y_pred)*100:.2f}%")
print(f"Macro F1-Score: {f1_score(y_test, y_pred, average='macro'):.4f}")
""",
            """# Confusion Matrix
labels = ["RESTOCK", "SUFFICIENT", "OVERSTOCK"]
cm = confusion_matrix(y_test, y_pred, labels=labels)
cm_df = pd.DataFrame(cm, index=[f"Actual {l}" for l in labels], columns=[f"Pred {l}" for l in labels])
cm_df
""",
            """# Joblib Save & Test
joblib.dump(pipeline, "../models/inventory_model.joblib")
del pipeline
loaded_pipe = joblib.load("../models/inventory_model.joblib")

sample = np.array([[15, 100, 40, 90, 2.2]])
status = loaded_pipe.predict(sample)[0]
print(f"Predicted Inventory Status: {status}")
"""
        ],
        os.path.join(nb_dir, "04_inventory_logistic_regression.ipynb")
    )
    
    # 05 Expense
    generate_individual_notebook(
        "05", "Expense Prediction", "Multiple Linear Regression", "Regression for Operational Overheads",
        [
            """from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

feature_cols = ["previous_day_sales", "sales_7_day_average", "invoice_count", "business_activity", "expense_3_month_average"]
target_col = "total_expense"
split_idx = int(len(df_clean) * 0.8)

X_train, y_train = df_clean.iloc[:split_idx][feature_cols].values, df_clean.iloc[:split_idx][target_col].values
X_test, y_test = df_clean.iloc[split_idx:][feature_cols].values, df_clean.iloc[split_idx:][target_col].values

model = LinearRegression()
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print(f"Expense Model Evaluation:")
print(f"  MAE:  Rs. {mean_absolute_error(y_test, y_pred):.2f}")
print(f"  RMSE: Rs. {root_mean_squared_error(y_test, y_pred):.2f}")
print(f"  R²:   {r2_score(y_test, y_pred):.4f}")
""",
            """# Scatter Plot: Actual vs Predicted
plt.figure(figsize=(7, 5))
plt.scatter(y_test, y_pred, color='#8b5cf6', alpha=0.6, edgecolors='k')
plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
plt.title("Actual vs Predicted Overhead Expenses", fontsize=11, fontweight='bold')
plt.xlabel("Actual Expense (Rs.)")
plt.ylabel("Predicted Expense (Rs.)")
plt.tight_layout()
plt.show()
""",
            """# Joblib Save & Test
joblib.dump(model, "../models/expense_model.joblib")
del model
loaded_model = joblib.load("../models/expense_model.joblib")

sample = np.array([[5200.0, 4900.0, 42, 68.5, 3100.0]])
print(f"Predicted Total Expense for Sample: Rs. {loaded_model.predict(sample)[0]:.2f}")
"""
        ],
        os.path.join(nb_dir, "05_expense_linear_regression.ipynb")
    )
    
    # 06 K-Means
    generate_individual_notebook(
        "06", "Business & Expense Segmentation", "K-Means Clustering", "Unsupervised Clustering & Anomaly Profiling",
        [
            """from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score

feature_cols = ["total_expense", "revenue", "invoice_count", "business_activity"]
X = df_clean[feature_cols].values
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

for k in [2, 3, 4, 5]:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)
    sil = silhouette_score(X_scaled, labels)
    db = davies_bouldin_score(X_scaled, labels)
    print(f"K={k} | Silhouette Score: {sil:.4f} | Davies-Bouldin Index: {db:.4f}")
""",
            """# Fit Final Model with K=3
chosen_k = 3
clus_pipe = Pipeline([('scaler', StandardScaler()), ('kmeans', KMeans(n_clusters=chosen_k, random_state=42, n_init=10))])
df_clean['cluster'] = clus_pipe.fit_predict(X)

# 2D Scatter Plot
plt.figure(figsize=(8, 5))
scatter = plt.scatter(df_clean['revenue'], df_clean['total_expense'], c=df_clean['cluster'], cmap='viridis', alpha=0.7, edgecolors='k')
plt.title("K-Means Business Activity Clusters (K=3)", fontsize=11, fontweight='bold')
plt.xlabel("Revenue (Rs.)")
plt.ylabel("Expense (Rs.)")
plt.colorbar(scatter, label='Cluster ID')
plt.tight_layout()
plt.show()
""",
            """# Joblib Save & Test
cluster_names = {0: "Low Activity", 1: "Moderate Steady", 2: "High Surge Activity"}
joblib.dump({"pipeline": clus_pipe, "feature_cols": feature_cols, "cluster_names": cluster_names, "k": chosen_k}, "../models/clustering_model.joblib")
del clus_pipe
loaded_data = joblib.load("../models/clustering_model.joblib")

sample = np.array([[4500.0, 11500.0, 75, 88.0]])
c_id = int(loaded_data["pipeline"].predict(sample)[0])
print(f"Cluster Assigned: {c_id} ({loaded_data['cluster_names'].get(c_id)})")
"""
        ],
        os.path.join(nb_dir, "06_kmeans_business_segmentation.ipynb")
    )
    
    # 07 Profit
    generate_individual_notebook(
        "07", "Net Profit Prediction", "Linear Regression", "Margin Regression Analysis",
        [
            """from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

feature_cols = ["revenue", "total_expense", "invoice_count", "average_order_value"]
X = df_clean[feature_cols].values
y = df_clean["profit"].values
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LinearRegression()
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print(f"Profit Model Evaluation:")
print(f"  MAE:  Rs. {mean_absolute_error(y_test, y_pred):.2f}")
print(f"  RMSE: Rs. {root_mean_squared_error(y_test, y_pred):.2f}")
print(f"  R²:   {r2_score(y_test, y_pred):.4f}")
""",
            """# Residual Plot
residuals = y_test - y_pred
plt.figure(figsize=(8, 4))
plt.scatter(y_pred, residuals, color='#059669', alpha=0.6, edgecolors='k')
plt.axhline(0, color='red', linestyle='--')
plt.title("Net Profit Residual Plot", fontsize=11, fontweight='bold')
plt.xlabel("Predicted Profit (Rs.)")
plt.ylabel("Residual Error (Rs.)")
plt.tight_layout()
plt.show()
""",
            """# Joblib Save & Test
joblib.dump(model, "../models/profit_model.joblib")
del model
loaded_model = joblib.load("../models/profit_model.joblib")

sample = np.array([[120000.0, 70000.0, 350, 342.8]])
print(f"Predicted Net Profit: Rs. {loaded_model.predict(sample)[0]:.2f}")
"""
        ],
        os.path.join(nb_dir, "07_profit_linear_regression.ipynb")
    )
    
    print("\n[SUCCESS] All 8 Jupyter notebooks have been successfully constructed!")

if __name__ == "__main__":
    build_all_notebooks()
