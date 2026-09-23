from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


def aggregate_daily_sales(invoices_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregates individual invoice transactions into daily store summary."""
    if invoices_df.empty:
        return pd.DataFrame(
            columns=["date", "total_sales", "invoice_count", "total_discount", "avg_order_value"]
        )

    df = invoices_df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.date

    daily = (
        df.groupby("date")
        .agg(
            total_sales=("total_amount", "sum"),
            invoice_count=("id", "count"),
            total_discount=("discount", "sum") if "discount" in df.columns else ("total_amount", lambda x: 0.0),
        )
        .reset_index()
    )
    daily["date"] = pd.to_datetime(daily["date"])
    daily["avg_order_value"] = daily["total_sales"] / daily["invoice_count"].replace(0, 1)
    daily["discount_rate"] = daily["total_discount"] / daily["total_sales"].replace(0, 1)

    # Reindex to full continuous calendar range to ensure regular time step
    full_dates = pd.date_range(
        start=daily["date"].min(), end=daily["date"].max(), freq="D"
    )
    daily = (
        daily.set_index("date")
        .reindex(full_dates)
        .fillna({"total_sales": 0.0, "invoice_count": 0, "total_discount": 0.0, "avg_order_value": 0.0, "discount_rate": 0.0})
        .rename_axis("date")
        .reset_index()
    )
    return daily


def build_sales_features(daily_df: pd.DataFrame) -> pd.DataFrame:
    """Computes time-series lags and rolling window features for sales forecasting."""
    if daily_df.empty:
        return daily_df

    df = daily_df.sort_values(by="date").copy()

    # Calendar features
    df["day"] = df["date"].dt.day
    df["month"] = df["date"].dt.month
    df["weekday"] = df["date"].dt.weekday  # 0=Mon, 6=Sun
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["is_weekend"] = df["weekday"].isin([5, 6]).astype(int)

    # Lags (strictly using past data to prevent leakage)
    df["previous_day_sales"] = df["total_sales"].shift(1).fillna(df["total_sales"].median())
    df["sales_lag_2"] = df["total_sales"].shift(2).fillna(df["total_sales"].median())
    df["sales_lag_7"] = df["total_sales"].shift(7).fillna(df["total_sales"].median())

    # Rolling window averages (shifted by 1 day to exclude current day)
    df["rolling_7_day_sales"] = (
        df["total_sales"].shift(1).rolling(window=7, min_periods=1).mean()
    )
    df["rolling_30_day_sales"] = (
        df["total_sales"].shift(1).rolling(window=30, min_periods=1).mean()
    )

    # Target: 1-day ahead sales
    df["future_sales"] = df["total_sales"]

    # Fill initial boundary gaps
    df = df.bfill().ffill()
    return df


def unpack_invoice_items(invoices_df: pd.DataFrame) -> pd.DataFrame:
    """Extracts line items from nested JSON or lists in invoices."""
    records = []
    for _, inv in invoices_df.iterrows():
        inv_date = inv.get("date")
        items = inv.get("items") or []
        if isinstance(items, str):
            import json
            try:
                items = json.loads(items)
            except Exception:
                items = []
        for it in items:
            records.append({
                "invoice_id": inv.get("id"),
                "date": pd.to_datetime(inv_date),
                "product_id": it.get("product_id"),
                "product_name": it.get("product_name"),
                "category_id": it.get("category_id"),
                "quantity": float(it.get("quantity") or 1.0),
                "unit_price": float(it.get("unit_price") or 0.0),
                "cost_price": float(it.get("cost_price") or 0.0),
                "line_total": float(it.get("total_amount") or 0.0),
            })
    return pd.DataFrame(records)


def build_demand_features(
    invoices_df: pd.DataFrame, products_df: pd.DataFrame
) -> pd.DataFrame:
    """Builds product-level historical demand velocity and lag features."""
    items_df = unpack_invoice_items(invoices_df)
    if items_df.empty:
        return pd.DataFrame()

    max_date = items_df["date"].max()

    # Aggregate total quantities in past 7, 30, and 90 day windows
    features = []
    for _, prod in products_df.iterrows():
        p_id = prod["id"]
        p_name = prod.get("name", "")
        cat = prod.get("category_name", "General")
        stock = float(prod.get("stock_quantity") or 0.0)
        price = float(prod.get("selling_price") or 0.0)
        cost = float(prod.get("cost_price") or 0.0)

        p_items = items_df[items_df["product_id"] == p_id]
        if p_items.empty:
            q_7, q_30, q_90 = 0.0, 0.0, 0.0
            avg_daily = 0.0
            days_since = 90
            velocity = 0.0
        else:
            p_items_7 = p_items[p_items["date"] >= max_date - timedelta(days=7)]
            p_items_30 = p_items[p_items["date"] >= max_date - timedelta(days=30)]
            p_items_90 = p_items[p_items["date"] >= max_date - timedelta(days=90)]

            q_7 = float(p_items_7["quantity"].sum())
            q_30 = float(p_items_30["quantity"].sum())
            q_90 = float(p_items_90["quantity"].sum())

            avg_daily = round(q_30 / 30.0, 2)
            last_sale = p_items["date"].max()
            days_since = (max_date - last_sale).days if pd.notnull(last_sale) else 90
            velocity = round((q_7 / 7.0) / max(0.01, (q_30 / 30.0)), 2)

        features.append({
            "product_id": p_id,
            "product_name": p_name,
            "category": cat,
            "current_stock": stock,
            "price": price,
            "cost_price": cost,
            "previous_7_day_demand": q_7,
            "previous_30_day_demand": q_30,
            "previous_90_day_demand": q_90,
            "average_daily_demand": avg_daily,
            "sales_velocity": velocity,
            "days_since_last_sale": days_since,
            "weekday": max_date.weekday() if pd.notnull(max_date) else 0,
            "month": max_date.month if pd.notnull(max_date) else 1,
            "future_quantity_demand": round(q_7, 1),  # Next 7-day demand target
        })

    return pd.DataFrame(features)


def build_catalog_features(
    invoices_df: pd.DataFrame, products_df: pd.DataFrame
) -> pd.DataFrame:
    """Builds inventory movement metrics for catalog classification."""
    demand_df = build_demand_features(invoices_df, products_df)
    if demand_df.empty:
        return pd.DataFrame()

    df = demand_df.copy()
    df["sales_7_days"] = df["previous_7_day_demand"]
    df["sales_30_days"] = df["previous_30_day_demand"]
    df["sales_90_days"] = df["previous_90_day_demand"]
    df["turnover_rate"] = df["sales_30_days"] / df["current_stock"].replace(0, 1)
    df["total_quantity_sold"] = df["sales_90_days"]
    df["revenue"] = df["sales_30_days"] * df["price"]
    df["average_daily_sales"] = df["average_daily_demand"]

    # Target class labeling based on multi-dimensional movement
    def assign_class(row):
        if row["days_since_last_sale"] > 45 or (row["sales_90_days"] == 0 and row["current_stock"] > 0):
            return "DEAD_STOCK"
        elif row["sales_30_days"] < 3 and row["days_since_last_sale"] > 20:
            return "SLOW_MOVING"
        elif row["sales_30_days"] >= 35 or row["sales_7_days"] >= 10:
            return "HIGH_DEMAND"
        elif row["sales_30_days"] >= 15:
            return "MEDIUM_DEMAND"
        else:
            return "LOW_DEMAND"

    df["classification"] = df.apply(assign_class, axis=1)
    return df


def build_expense_features(
    expenses_df: pd.DataFrame, invoices_df: pd.DataFrame
) -> pd.DataFrame:
    """Aggregates monthly expenses with business activity indicators."""
    if expenses_df.empty:
        return pd.DataFrame()

    exp = expenses_df.copy()
    exp["date"] = pd.to_datetime(exp["date"])
    exp["year_month"] = exp["date"].dt.to_period("M")

    # Monthly total by category
    monthly_cat = (
        exp.groupby(["year_month", "category"])
        .agg(amount=("amount", "sum"), count=("id", "count"))
        .reset_index()
    )

    # Monthly store sales volume
    if not invoices_df.empty:
        inv = invoices_df.copy()
        inv["date"] = pd.to_datetime(inv["date"])
        inv["year_month"] = inv["date"].dt.to_period("M")
        inv_monthly = (
            inv.groupby("year_month")
            .agg(sales=("total_amount", "sum"), invoice_count=("id", "count"))
            .reset_index()
        )
        monthly_cat = monthly_cat.merge(inv_monthly, on="year_month", how="left")
    else:
        monthly_cat["sales"] = 0.0
        monthly_cat["invoice_count"] = 0

    monthly_cat["sales"] = monthly_cat["sales"].fillna(0.0)
    monthly_cat["invoice_count"] = monthly_cat["invoice_count"].fillna(0)
    monthly_cat["month"] = monthly_cat["year_month"].dt.month
    monthly_cat = monthly_cat.sort_values(by=["category", "year_month"]).reset_index(drop=True)

    # Category lags & rolling averages
    monthly_cat["previous_month_expense"] = (
        monthly_cat.groupby("category")["amount"].shift(1).fillna(monthly_cat["amount"].median())
    )
    monthly_cat["rolling_3_month_expense"] = (
        monthly_cat.groupby("category")["amount"]
        .shift(1)
        .rolling(window=3, min_periods=1)
        .mean()
        .fillna(monthly_cat["amount"].median())
    )
    monthly_cat["rolling_6_month_expense"] = (
        monthly_cat.groupby("category")["amount"]
        .shift(1)
        .rolling(window=6, min_periods=1)
        .mean()
        .fillna(monthly_cat["amount"].median())
    )

    monthly_cat["future_expense"] = monthly_cat["amount"]
    return monthly_cat
