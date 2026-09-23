# Smart Merchant — Lab-Oriented Machine Learning Pipeline
### College Data Mining & Data Warehousing and Data Mining (DWDM) Laboratory Submission

> **Project Title:** Smart Merchant — AI-Powered Merchant Management & Predictive Analytics Platform  
> **Course:** Data Mining / Data Warehousing & Data Mining Lab  
> **Service Port:** `8000` (FastAPI REST service)  
> **Python Version:** 3.10+ (Tested on Python 3.14)  
> **Primary Libraries:** `scikit-learn`, `pandas`, `numpy`, `matplotlib`, `joblib`, `fastapi`, `jupyter`

---

## 1. Project Overview & Laboratory Objective

Smart Merchant is a comprehensive retail ERP and business intelligence platform designed to empower neighborhood merchants with data-driven decision support.

Rather than using complex black-box algorithms (such as XGBoost or Isolation Forest), this machine learning pipeline is **specifically engineered to demonstrate core topics from the undergraduate Data Mining / DWDM laboratory curriculum**:
- Data Preprocessing (missing-value imputation, duplicate detection, IQR outlier analysis, descriptive statistics)
- Feature Engineering & Normalization (`StandardScaler`, `Pipeline`)
- Linear Regression & Multiple Linear Regression
- K-Nearest Neighbors (KNN) Regression with Cross-Validation
- Decision Tree Induction, Pruning, and Classification
- Logistic Regression (Multinomial Linear Discriminants)
- K-Means Clustering & Unsupervised Cluster Validation (Silhouette Score, Davies-Bouldin Index)
- Model Persistence using `joblib`
- End-to-End Pipeline Execution in Jupyter Notebooks

---

## 2. The 7 Syllabus Models Mapping

| # | Smart Merchant Feature | Problem Type | Algorithm Selected | Features Used | Target Variable | Evaluation Metrics | Lab Syllabus Topic |
|---|---|---|---|---|---|---|---|
| **1** | **Sales Prediction** | Regression | **Linear Regression** | `previous_day_sales`, `sales_7_day_average`, `sales_30_day_average`, `invoice_count`, `quantity_sold`, `discount` | `revenue` | MAE: Rs. 358.53, RMSE: Rs. 446.50, $R^2$: 0.6517 | Simple Linear Regression |
| **2** | **Product Demand** | Regression | **KNN Regression** | `current_stock`, `demand_7_day`, `demand_30_day`, `average_daily_demand`, `price`, `discount` | `predicted_demand` | MAE: 4.76 units, RMSE: 8.12 units, $R^2$: 0.9419 (Best $K=3$) | K-Nearest Neighbors, Cross-Validation |
| **3** | **Catalog Classification** | Classification | **Decision Tree Classifier** | `quantity_sold`, `sales_30_day`, `current_stock`, `turnover_rate`, `days_since_last_sale`, `sales_90_day` | `category_label` (`HIGH_DEMAND`, `MEDIUM_DEMAND`, `LOW_DEMAND`, `SLOW_MOVING`, `DEAD_STOCK`) | Accuracy: 98.50%, Macro F1: 0.9861, Confusion Matrix | Decision Tree Induction, Pruning, Tuning |
| **4** | **Inventory Status** | Classification | **Logistic Regression** | `current_stock`, `predicted_demand`, `reorder_level`, `quantity_sold`, `turnover_rate` | `inventory_status` (`RESTOCK`, `SUFFICIENT`, `OVERSTOCK`) | Accuracy: 97.00%, Macro F1: 0.9764, Confusion Matrix | Logistic Regression, Linear Discriminants |
| **5** | **Expense Prediction** | Regression | **Multiple Linear Regression** | `previous_day_sales`, `sales_7_day_average`, `invoice_count`, `business_activity`, `expense_3_month_average` | `total_expense` | MAE: Rs. 158.11, RMSE: Rs. 207.27, $R^2$: 0.6180 | Multiple Linear Regression |
| **6** | **Business Segmentation** | Clustering | **K-Means Clustering** | `total_expense`, `revenue`, `invoice_count`, `business_activity` | Cluster ID (0: Low Activity, 1: Steady, 2: High Surge) | Silhouette: 0.4734, Davies-Bouldin: 0.6386 ($K=3$) | K-Means, Silhouette, Davies-Bouldin |
| **7** | **Profit Prediction** | Regression | **Linear Regression** | `revenue`, `total_expense`, `invoice_count`, `average_order_value` | `profit` | MAE: Rs. 54.05, RMSE: Rs. 63.06, $R^2$: 0.9553 | Linear Regression, Residual Analysis |

---

## 3. Directory Structure

```
ml-service/
├── data/
│   ├── generate_data.py               # Reproducible generator for 1,000 synthetic records
│   └── smart_merchant_master.csv      # Master retail dataset (random_state=42)
├── models/                            # Serialized model binaries (.joblib)
│   ├── sales_model.joblib
│   ├── demand_model.joblib
│   ├── catalog_model.joblib
│   ├── inventory_model.joblib
│   ├── expense_model.joblib
│   ├── clustering_model.joblib
│   └── profit_model.joblib
├── preprocessing/
│   ├── __init__.py
│   └── preprocess.py                  # Missing values, IQR outliers, descriptive statistics
├── training/                          # Individual model training scripts
│   ├── __init__.py
│   ├── train_sales.py
│   ├── train_demand.py
│   ├── train_catalog.py
│   ├── train_inventory.py
│   ├── train_expense.py
│   ├── train_clustering.py
│   ├── train_profit.py
│   └── train_all.py                   # Master runner training all 7 models
├── prediction/                        # Inference modules loading .joblib artifacts
│   ├── __init__.py
│   ├── predict_sales.py
│   ├── predict_demand.py
│   ├── predict_catalog.py
│   ├── predict_inventory.py
│   ├── predict_expense.py
│   ├── predict_clustering.py
│   └── predict_profit.py
├── notebooks/                         # 8 fully executable Jupyter Notebooks
│   ├── 00_complete_pipeline.ipynb     # Master End-to-End Pipeline (Sections 1-14)
│   ├── 01_sales_linear_regression.ipynb
│   ├── 02_demand_knn_regression.ipynb
│   ├── 03_catalog_decision_tree.ipynb
│   ├── 04_inventory_logistic_regression.ipynb
│   ├── 05_expense_linear_regression.ipynb
│   ├── 06_kmeans_business_segmentation.ipynb
│   └── 07_profit_linear_regression.ipynb
├── api/                               # FastAPI integration service for web platform
│   ├── __init__.py
│   ├── main.py                        # REST endpoints on port 8000
│   └── schemas.py                     # Pydantic v2 data models
├── run.py                             # Server launcher script (port 8000)
├── requirements.txt                   # Minimal lab dependencies
├── .gitignore
└── README.md
```

---

## 4. Setup & Execution Instructions

### 4.1 Install Dependencies
```bash
pip install -r requirements.txt
```

### 4.2 Generate Dataset & Train All 7 Models
Run the master training runner:
```bash
python training/train_all.py
```
This trains all 7 models, evaluates them on test splits, prints out confusion matrices and regression metrics, and writes the 7 `.joblib` files to `models/`.

### 4.3 Running Jupyter Notebooks
Launch Jupyter to explore and run the interactive notebooks:
```bash
jupyter notebook notebooks/00_complete_pipeline.ipynb
```
Each notebook is completely self-contained and runs top-to-bottom via **Kernel -> Restart & Run All**.

### 4.4 Running the FastAPI REST Service
Start the service on port 8000:
```bash
python run.py
```
- Interactive Swagger Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

## 5. Lab Viva Voce Preparation (Questions & Answers)

### Q1: Why did you choose Linear Regression for Sales Prediction?
**Answer:** Sales revenue is a continuous numerical quantity. Linear regression is simple, interpretable, and computationally efficient. Its coefficients clearly show how much each additional invoice or promotional discount impacts total daily turnover.

### Q2: Why use StandardScaler inside a Pipeline for KNN and Logistic Regression?
**Answer:** KNN calculates Euclidean distance between points. If one feature (e.g., `demand_30_day`) is in hundreds and another (e.g., `discount`) is between 2 and 15, the larger feature will dominate the distance calculation. Similarly, Logistic Regression's regularization assumes features are on the same scale. The `Pipeline` guarantees test data is transformed using training statistics without data leakage.

### Q3: How did you select the optimal value of $K$ in KNN Regression?
**Answer:** We performed 5-Fold Cross-Validation across candidate values $K \in [3, 5, 7, 9, 11]$ evaluating Mean Absolute Error (MAE). $K=3$ produced the lowest CV MAE, balancing bias and variance.

### Q4: How is data leakage prevented in time-series forecasting?
**Answer:** For Sales and Expense forecasting, we used **chronological splitting** (the oldest 80% for training and the newest 20% for testing), rather than random shuffling. Random shuffling would allow future observations into the training set, causing lookahead leakage.

### Q5: How did you evaluate the K-Means clustering model?
**Answer:** Since ground truth labels are not present in unsupervised learning, we evaluated cluster quality using the **Silhouette Score** (measuring how similar a point is to its own cluster compared to other clusters) and the **Davies-Bouldin Index** (ratio of within-cluster scatter to between-cluster separation) across $K \in [2, 3, 4, 5]$. $K=3$ provided the ideal balance between separation and practical retail interpretability (Low Activity, Normal Steady, and High Peak Surge).

### Q6: What is the purpose of Joblib in this architecture?
**Answer:** Joblib serializes trained Python estimators into compact binary files (`.joblib`). During live application inference (via FastAPI or scripts), models are loaded instantly into memory without retraining on every user request.

---

## 6. Model Evaluation Summary Table

```
================================================================================
FINAL 7-MODEL LABORATORY EVALUATION SUMMARY TABLE
================================================================================
Model                   Algorithm               Problem Type     Primary Metric    Score
--------------------------------------------------------------------------------
1. Sales Prediction     Linear Regression       Regression       R² Score          0.6517
2. Product Demand       KNN Regression          Regression       MAE (Units)       4.76
3. Catalog Requirement  Decision Tree           Classification   Macro F1          0.9861
4. Inventory Status     Logistic Regression     Classification   Macro F1          0.9764
5. Expense Prediction   Multiple Linear Reg.    Regression       R² Score          0.6180
6. Business Segmentation K-Means (K=3)          Clustering       Silhouette Score  0.4734
7. Profit Prediction    Linear Regression       Regression       R² Score          0.9553
================================================================================
```
