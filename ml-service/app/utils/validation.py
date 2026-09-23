import logging
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd

from app.config.settings import settings

logger = logging.getLogger("ml-service.validation")


def clean_invoices_df(df: pd.DataFrame) -> pd.DataFrame:
    """Validate and clean raw invoices dataframe."""
    if df.empty:
        return df

    cleaned = df.copy()

    # Drop duplicate invoice ids if present
    if "invoice_number" in cleaned.columns:
        cleaned = cleaned.drop_duplicates(subset=["invoice_number"])
    elif "id" in cleaned.columns:
        cleaned = cleaned.drop_duplicates(subset=["id"])

    # Ensure date column is valid datetime
    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    cleaned = cleaned.dropna(subset=["date"])

    # Filter out invalid financial numbers
    if "total_amount" in cleaned.columns:
        cleaned["total_amount"] = pd.to_numeric(
            cleaned["total_amount"], errors="coerce"
        )
        invalid_count = (cleaned["total_amount"] <= 0).sum()
        if invalid_count > 0:
            logger.info("Filtered %d records with non-positive total_amount", invalid_count)
        cleaned = cleaned[cleaned["total_amount"] > 0]

    # Fill missing optional text fields
    if "customer_name" in cleaned.columns:
        cleaned["customer_name"] = cleaned["customer_name"].fillna("Walk-in Customer")
    if "payment_method" in cleaned.columns:
        cleaned["payment_method"] = cleaned["payment_method"].fillna("Cash")

    return cleaned.sort_values(by="date").reset_index(drop=True)


def clean_expenses_df(df: pd.DataFrame) -> pd.DataFrame:
    """Validate and clean raw expenses dataframe."""
    if df.empty:
        return df

    cleaned = df.copy()
    if "id" in cleaned.columns:
        cleaned = cleaned.drop_duplicates(subset=["id"])

    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    cleaned = cleaned.dropna(subset=["date"])

    if "amount" in cleaned.columns:
        cleaned["amount"] = pd.to_numeric(cleaned["amount"], errors="coerce")
        cleaned = cleaned[cleaned["amount"] > 0]

    if "category" in cleaned.columns:
        cleaned["category"] = cleaned["category"].fillna("General Operations")

    return cleaned.sort_values(by="date").reset_index(drop=True)


def time_aware_split(
    df: pd.DataFrame,
    date_col: str = "date",
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Strictly chronological time-aware train/val/test split (no random shuffling)."""
    if df.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    sorted_df = df.sort_values(by=date_col).reset_index(drop=True)
    n = len(sorted_df)

    if n < 4:
        return sorted_df, pd.DataFrame(), pd.DataFrame()

    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_df = sorted_df.iloc[:train_end].copy()
    val_df = sorted_df.iloc[train_end:val_end].copy()
    test_df = sorted_df.iloc[val_end:].copy()

    return train_df, val_df, test_df


def evaluate_data_sufficiency(days: int) -> Dict[str, Any]:
    """Determines forecasting confidence status based on length of historical window."""
    if days < settings.MIN_DAYS_INSUFFICIENT:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": f"Historical window ({days} days) is under minimum required {settings.MIN_DAYS_INSUFFICIENT} days.",
            "confidence": 0.0,
            "usable": False,
        }
    elif days < settings.MIN_DAYS_LIMITED:
        return {
            "status": "LIMITED_DATA",
            "message": f"Historical data ({days} days) allows preliminary baseline forecasts with limited confidence.",
            "confidence": 0.55,
            "usable": True,
        }
    elif days < settings.MIN_DAYS_NORMAL:
        return {
            "status": "NORMAL",
            "message": f"Sufficient history ({days} days) for multi-horizon seasonal forecasting.",
            "confidence": 0.85,
            "usable": True,
        }
    else:
        return {
            "status": "STRONG",
            "message": f"Strong history ({days} days) capturing full multi-month seasonal dynamics.",
            "confidence": 0.95,
            "usable": True,
        }
