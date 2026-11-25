"""
Smart Merchant - Data Preprocessing & Exploratory Analytics Module
Covers: Missing-value detection & imputation, duplicate handling, data type casting,
descriptive statistics (mean, median, mode, std), outlier analysis, and leakage-free splitting.
"""

import os
import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any
from sklearn.model_selection import train_test_split

def load_dataset(csv_path: str = None) -> pd.DataFrame:
    """Load the master dataset from CSV; if missing, generate it dynamically."""
    if csv_path is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(base_dir, "data", "smart_merchant_master.csv")
        
    if not os.path.exists(csv_path):
        from data.generate_data import generate_master_dataset
        print(f"[INFO] Dataset not found at {csv_path}. Generating demo dataset...")
        return generate_master_dataset(output_path=csv_path)
        
    df = pd.read_csv(csv_path)
    return df

def inspect_data(df: pd.DataFrame) -> Dict[str, Any]:
    """Inspect shapes, null values, duplicates, and data types."""
    inspection = {
        "shape": df.shape,
        "columns": list(df.columns),
        "dtypes": df.dtypes.to_dict(),
        "missing_counts": df.isnull().sum().to_dict(),
        "total_missing": int(df.isnull().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum())
    }
    return inspection

def clean_and_impute(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean dataset:
    1. Removes any true duplicates.
    2. Imputes numeric columns with their median (robust against outliers).
    3. Imputes categorical columns with mode.
    4. Ensures date column is datetime typed.
    """
    df_clean = df.copy()
    
    # 1. Drop duplicate rows if present
    df_clean = df_clean.drop_duplicates()
    
    # 2. Date conversion
    if "date" in df_clean.columns:
        df_clean["date"] = pd.to_datetime(df_clean["date"])
        
    # 3. Numeric imputation with median
    num_cols = df_clean.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        if df_clean[col].isnull().any():
            median_val = df_clean[col].median()
            df_clean[col] = df_clean[col].fillna(median_val)
            
    # 4. Categorical imputation with mode
    cat_cols = df_clean.select_dtypes(include=["object"]).columns
    for col in cat_cols:
        if df_clean[col].isnull().any():
            mode_val = df_clean[col].mode()[0]
            df_clean[col] = df_clean[col].fillna(mode_val)
            
    return df_clean

def compute_descriptive_stats(df: pd.DataFrame, columns: List[str] = None) -> pd.DataFrame:
    """
    Compute mean, median, mode, standard deviation, and IQR for target columns.
    Matches standard Data Mining Lab requirements.
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
    stats = []
    for col in columns:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            series = df[col].dropna()
            mean_val = float(series.mean())
            median_val = float(series.median())
            mode_val = float(series.mode().iloc[0]) if not series.mode().empty else np.nan
            std_val = float(series.std())
            q25 = float(series.quantile(0.25))
            q75 = float(series.quantile(0.75))
            iqr = q75 - q25
            
            stats.append({
                "Feature": col,
                "Mean": round(mean_val, 2),
                "Median": round(median_val, 2),
                "Mode": round(mode_val, 2),
                "Std Dev": round(std_val, 2),
                "IQR": round(iqr, 2)
            })
            
    return pd.DataFrame(stats)

def detect_outliers_iqr(df: pd.DataFrame, column: str) -> Dict[str, Any]:
    """
    Identifies outliers using the Interquartile Range (IQR) technique:
    Q1 - 1.5*IQR to Q3 + 1.5*IQR.
    Distinguishes genuine business peaks (e.g. Diwali sales) from data entry errors.
    """
    series = df[column].dropna()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    
    outliers = df[(df[column] < lower_bound) | (df[column] > upper_bound)]
    return {
        "feature": column,
        "q1": round(float(q1), 2),
        "q3": round(float(q3), 2),
        "iqr": round(float(iqr), 2),
        "lower_bound": round(float(lower_bound), 2),
        "upper_bound": round(float(upper_bound), 2),
        "outlier_count": len(outliers),
        "outlier_indices": outliers.index.tolist()
    }

def chronological_split(df: pd.DataFrame, feature_cols: List[str], target_col: str, train_ratio: float = 0.8) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Chronological Split (Oldest 80% -> Training, Newest 20% -> Testing).
    CRITICAL: Prevents lookahead data leakage in time-series forecasting (Sales, Expenses).
    """
    df_sorted = df.sort_values(by="date") if "date" in df.columns else df
    split_idx = int(len(df_sorted) * train_ratio)
    
    train_df = df_sorted.iloc[:split_idx]
    test_df = df_sorted.iloc[split_idx:]
    
    X_train = train_df[feature_cols].values
    y_train = train_df[target_col].values
    X_test = test_df[feature_cols].values
    y_test = test_df[target_col].values
    
    return X_train, X_test, y_train, y_test

def standard_split(df: pd.DataFrame, feature_cols: List[str], target_col: str, test_size: float = 0.2, random_state: int = 42) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Standard stratified/random train-test split for non-time-series models (Demand, Catalog, Inventory).
    """
    X = df[feature_cols].values
    y = df[target_col].values
    return train_test_split(X, y, test_size=test_size, random_state=random_state)
