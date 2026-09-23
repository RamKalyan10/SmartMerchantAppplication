"""
Smart Merchant - Synthetic Retail Master Dataset Generator
Target: College Data Mining / DWDM Lab Demonstration
Random Seed: 42 (Reproducible)
Generates 1,000 realistic daily records with trends, seasonality, and product metrics.
"""

import os
import numpy as np
import pandas as pd

def generate_master_dataset(num_records: int = 1000, random_state: int = 42, output_path: str = None) -> pd.DataFrame:
    np.random.seed(random_state)
    
    # 1. Date Range: 1000 consecutive days starting from 2024-01-01
    dates = pd.date_range(start="2024-01-01", periods=num_records, freq="D")
    
    # 2. Time-series dynamics: Trend, Weekly seasonality (weekends spike), Festival surges
    t = np.arange(num_records)
    trend = 0.05 * t  # gentle upward retail growth
    day_of_week = dates.dayofweek.values  # 0=Monday, 6=Sunday
    weekend_factor = np.where(day_of_week >= 5, 1.35, 1.0)
    month = dates.month.values
    festival_factor = np.where(np.isin(month, [10, 11, 12]), 1.25, 1.0) # festive quarter
    
    # Baseline base sales ~ 3,500 INR with realistic noise
    base_sales = (3500 + 400 * np.sin(2 * np.pi * t / 365) + 300 * np.sin(2 * np.pi * t / 7) + trend * 10) * weekend_factor * festival_factor
    noise = np.random.normal(0, 200, size=num_records)
    revenue = np.maximum(1200, np.round(base_sales + noise, 2))
    
    # Add 5 genuine festival surge outliers (e.g. Diwali / mega sale events)
    outlier_indices = [150, 310, 480, 680, 890]
    for idx in outlier_indices:
        if idx < num_records:
            revenue[idx] *= 2.2
            
    # 3. Lagged and rolling features for Sales & Time-Series Regression
    revenue_series = pd.Series(revenue)
    previous_day_sales = revenue_series.shift(1).bfill().values
    sales_7_day_average = revenue_series.rolling(window=7, min_periods=1).mean().round(2).values
    sales_30_day_average = revenue_series.rolling(window=30, min_periods=1).mean().round(2).values
    
    # Invoice count & quantities sold correlated with revenue
    invoice_count = np.maximum(8, np.round(revenue / np.random.uniform(90, 130, size=num_records))).astype(int)
    quantity_sold = np.maximum(20, np.round(invoice_count * np.random.uniform(2.8, 5.2, size=num_records))).astype(int)
    
    # Discount percentage (2% - 15%)
    discount = np.round(np.random.uniform(2.0, 15.0, size=num_records), 2)
    
    # Business activity index (0-100 scale)
    activity_raw = (invoice_count * 0.4 + (quantity_sold / 5) * 0.3 + (revenue / 200) * 0.3)
    business_activity = np.clip(np.round((activity_raw - activity_raw.min()) / (activity_raw.max() - activity_raw.min()) * 100, 2), 10, 100)
    
    # 4. Expenses: Base overheads + variable fulfillment costs + restock cycles
    base_expense = 1500 + 0.35 * revenue + 8 * invoice_count + np.random.normal(0, 150, size=num_records)
    total_expense = np.maximum(800, np.round(base_expense, 2))
    expense_series = pd.Series(total_expense)
    expense_3_month_average = expense_series.rolling(window=90, min_periods=1).mean().round(2).values
    
    # Average Order Value (AOV) and Net Profit
    average_order_value = np.round(revenue / np.maximum(invoice_count, 1), 2)
    # Net profit follows: Revenue - Expenses - COGS variation
    profit = np.round(revenue - total_expense - (0.25 * revenue * np.random.uniform(0.9, 1.1, size=num_records)), 2)
    
    # 5. Product Level Demographics (simulating representative item rotation across the master dataset)
    categories = ["Grocery", "Beverages", "Snacks", "Personal Care", "Household", "Stationery"]
    product_names = [
        "Basmati Rice 5kg", "Whole Wheat Flour 10kg", "Sunflower Oil 1L", "Full Cream Milk 1L",
        "Assam Tea 500g", "Roasted Coffee Beans 250g", "Organic Honey 500g", "Dark Chocolate 100g",
        "Hand Sanitizer 500ml", "Herbal Shampoo 200ml", "Laundry Detergent 1kg", "Ballpoint Pens Pack"
    ]
    
    prod_indices = np.random.choice(len(product_names), size=num_records)
    assigned_products = [product_names[i] for i in prod_indices]
    assigned_categories = [categories[i % len(categories)] for i in prod_indices]
    
    # Unit prices for products (ranging 30 INR to 850 INR)
    price_map = {
        "Basmati Rice 5kg": 450.0, "Whole Wheat Flour 10kg": 380.0, "Sunflower Oil 1L": 160.0,
        "Full Cream Milk 1L": 65.0, "Assam Tea 500g": 240.0, "Roasted Coffee Beans 250g": 350.0,
        "Organic Honey 500g": 280.0, "Dark Chocolate 100g": 120.0, "Hand Sanitizer 500ml": 110.0,
        "Herbal Shampoo 200ml": 175.0, "Laundry Detergent 1kg": 210.0, "Ballpoint Pens Pack": 50.0
    }
    price = np.array([price_map[p] for p in assigned_products])
    
    # Demand metrics for Model 2 (KNN Demand Regression)
    average_daily_demand = np.maximum(2.0, np.round(quantity_sold / np.random.uniform(8, 16, size=num_records), 1))
    demand_7_day = np.round(average_daily_demand * 7 * np.random.uniform(0.85, 1.15, size=num_records), 1)
    demand_30_day = np.round(average_daily_demand * 30 * np.random.uniform(0.9, 1.1, size=num_records), 1)
    
    # Target: predicted_demand for next planning horizon
    predicted_demand = np.maximum(5, np.round(average_daily_demand * 7 * (1 + (discount / 100) * 0.4) + np.random.normal(0, 3, size=num_records))).astype(int)
    
    # Current stock variation (some depleted, some healthy, some overstocked)
    stock_ratio = np.random.choice([0.4, 0.7, 1.1, 1.8, 2.6], size=num_records, p=[0.25, 0.25, 0.25, 0.15, 0.10])
    current_stock = np.maximum(0, np.round(predicted_demand * stock_ratio + np.random.normal(0, 4, size=num_records))).astype(int)
    
    # Reorder level = Safety Stock + Lead Time Demand
    reorder_level = np.maximum(8, np.round(average_daily_demand * 4 + 10)).astype(int)
    
    # 6. Catalog Requirement Features for Model 3 (Decision Tree)
    sales_30_day = np.round(demand_30_day * price * np.random.uniform(0.9, 1.1, size=num_records), 2)
    sales_90_day = np.round(sales_30_day * 3.1, 2)
    turnover_rate = np.round(quantity_sold / np.maximum(current_stock, 1), 2)
    days_since_last_sale = np.random.choice([0, 1, 2, 5, 12, 25, 45, 65], size=num_records, p=[0.45, 0.25, 0.12, 0.08, 0.04, 0.03, 0.02, 0.01])
    
    # Determine Catalog Class: HIGH_DEMAND, MEDIUM_DEMAND, LOW_DEMAND, SLOW_MOVING, DEAD_STOCK
    category_label = []
    for i in range(num_records):
        d_last = days_since_last_sale[i]
        to = turnover_rate[i]
        qty = quantity_sold[i]
        
        if d_last >= 40:
            category_label.append("DEAD_STOCK")
        elif d_last >= 15 or to < 0.35:
            category_label.append("SLOW_MOVING")
        elif to > 1.4 and qty > 160:
            category_label.append("HIGH_DEMAND")
        elif to > 0.7:
            category_label.append("MEDIUM_DEMAND")
        else:
            category_label.append("LOW_DEMAND")
            
    # 7. Inventory Status for Model 4 (Logistic Regression): RESTOCK, SUFFICIENT, OVERSTOCK
    inventory_status = []
    for i in range(num_records):
        stk = current_stock[i]
        dem = predicted_demand[i]
        rop = reorder_level[i]
        
        if stk < rop or stk < (dem * 0.75):
            inventory_status.append("RESTOCK")
        elif stk > (dem * 2.1):
            inventory_status.append("OVERSTOCK")
        else:
            inventory_status.append("SUFFICIENT")
            
    # 8. Assemble Master DataFrame
    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "day_of_week": dates.day_name(),
        "is_weekend": (day_of_week >= 5).astype(int),
        "product_name": assigned_products,
        "category": assigned_categories,
        "price": price,
        "discount": discount,
        
        # Model 1 & General Sales
        "previous_day_sales": previous_day_sales,
        "sales_7_day_average": sales_7_day_average,
        "sales_30_day_average": sales_30_day_average,
        "invoice_count": invoice_count,
        "quantity_sold": quantity_sold,
        "revenue": revenue,
        
        # Model 2: Product Demand
        "current_stock": current_stock,
        "demand_7_day": demand_7_day,
        "demand_30_day": demand_30_day,
        "average_daily_demand": average_daily_demand,
        "predicted_demand": predicted_demand,
        "reorder_level": reorder_level,
        
        # Model 3: Catalog Classification
        "sales_30_day": sales_30_day,
        "sales_90_day": sales_90_day,
        "turnover_rate": turnover_rate,
        "days_since_last_sale": days_since_last_sale,
        "category_label": category_label,
        
        # Model 4: Inventory Status
        "inventory_status": inventory_status,
        
        # Model 5: Expenses
        "business_activity": business_activity,
        "total_expense": total_expense,
        "expense_3_month_average": expense_3_month_average,
        
        # Model 7: Profit
        "average_order_value": average_order_value,
        "profit": profit
    })
    
    # Introduce ~1% intentional missing values in discount and turnover_rate to demonstrate preprocessing
    missing_indices = np.random.choice(num_records, size=int(0.015 * num_records), replace=False)
    df.loc[missing_indices[:len(missing_indices)//2], "discount"] = np.nan
    df.loc[missing_indices[len(missing_indices)//2:], "turnover_rate"] = np.nan
    
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"[OK] Master dataset successfully written to: {output_path} ({df.shape[0]} rows, {df.shape[1]} columns)")
        
    return df

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    target_csv = os.path.join(current_dir, "smart_merchant_master.csv")
    generate_master_dataset(num_records=1000, random_state=42, output_path=target_csv)
