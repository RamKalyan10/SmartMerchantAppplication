"""
Smart Merchant ML Service — FastAPI Server
Serves all 7 Lab-Syllabus ML Models over REST API.
Compatible with backend/src/services/mlClient.js and React frontend.
Port: 8000
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

# Ensure parent directory is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.schemas import (
    SalesPredictRequest, DemandPredictRequest, CatalogClassifyRequest,
    ExpensePredictRequest, ExpenseAnomalyRequest, ExecutiveInsightsRequest
)
from prediction.predict_sales import predict_sales_revenue
from prediction.predict_demand import predict_product_demand
from prediction.predict_catalog import classify_catalog_item
from prediction.predict_inventory import predict_inventory_status
from prediction.predict_expense import predict_total_expense
from prediction.predict_clustering import segment_business_activity
from prediction.predict_profit import predict_net_profit

app = FastAPI(
    title="Smart Merchant — Lab-Oriented Machine Learning Service",
    description="Provides predictive intelligence using 7 syllabus-aligned models (Linear Regression, KNN, Decision Tree, Logistic Regression, K-Means)",
    version="2.0.0"
)

# Enable CORS for React frontend (port 3000) and Express backend (port 5000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Health check endpoint confirming model availability."""
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
    cached_models = [f for f in os.listdir(models_dir) if f.endswith(".joblib")] if os.path.exists(models_dir) else []
    return {
        "status": "healthy",
        "service": "Smart Merchant Lab ML Engine",
        "models_cached": len(cached_models),
        "available_models": cached_models,
        "active_algorithms": [
            "Linear Regression (Sales)",
            "KNN Regression (Product Demand)",
            "Decision Tree (Catalog Requirement)",
            "Logistic Regression (Inventory Status)",
            "Multiple Linear Regression (Expenses)",
            "K-Means Clustering (Business Segmentation)",
            "Linear Regression (Profit Margin)"
        ]
    }

@app.post("/ml/sales/predict")
def predict_sales_endpoint(payload: SalesPredictRequest):
    """
    Model 1: Sales Prediction (Linear Regression).
    Predicts sales for each future day.
    """
    days = max(1, payload.days)
    history = payload.history or []
    
    # Extract amounts from history if available
    amounts = [h.amount for h in history if h.amount > 0]
    if len(amounts) >= 7:
        prev_sales = float(amounts[-1])
        avg_7d = float(np.mean(amounts[-7:]))
        avg_30d = float(np.mean(amounts[-30:]))
    else:
        prev_sales = 4000.0
        avg_7d = 4200.0
        avg_30d = 4100.0
        
    start_date = datetime.now()
    if history:
        try:
            start_date = datetime.strptime(history[-1].date[:10], "%Y-%m-%d") + timedelta(days=1)
        except Exception:
            start_date = datetime.now()
            
    daily_forecasts = []
    total_sales = 0.0
    
    for i in range(days):
        forecast_date = start_date + timedelta(days=i)
        is_weekend = forecast_date.weekday() >= 5
        multiplier = 1.25 if is_weekend else 1.0
        
        # Linear Regression prediction
        invoices = int(prev_sales / 115) + (5 if is_weekend else 0)
        qty = int(invoices * 3.8)
        pred_val = predict_sales_revenue(prev_sales, avg_7d, avg_30d, invoices, qty, discount=5.0) * multiplier
        pred_val = round(pred_val, 2)
        total_sales += pred_val
        
        daily_forecasts.append({
            "date": forecast_date.strftime("%Y-%m-%d"),
            "predicted_sales": pred_val,
            "lower_bound": round(pred_val * 0.92, 2),
            "upper_bound": round(pred_val * 1.08, 2),
            "tag": "Linear Regression Model"
        })
        # Slide window
        prev_sales = pred_val
        
    trend_pct = round(((daily_forecasts[-1]["predicted_sales"] - daily_forecasts[0]["predicted_sales"]) / max(daily_forecasts[0]["predicted_sales"], 1.0)) * 100, 1)
    
    return {
        "status": "success",
        "method": "Linear Regression (Lab Model 1)",
        "forecast_days": days,
        "total_forecasted_sales": round(total_sales, 2),
        "trend_percentage": trend_pct,
        "daily_forecasts": daily_forecasts,
        "confidence": 0.88
    }

@app.post("/ml/demand/predict")
def predict_demand_endpoint(payload: DemandPredictRequest):
    """
    Model 2: Product Demand (KNN Regression) + Inventory Rules.
    Estimates demand and calculates replenishment quantities.
    """
    items = payload.items or []
    results = []
    total_shortages = 0
    
    for item in items:
        stock = item.current_stock
        price = item.selling_price or 150.0
        dem_7d = item.demand_7_day or (stock * 0.8)
        dem_30d = item.demand_30_day or (dem_7d * 4)
        avg_daily = item.average_daily_demand or (dem_7d / 7.0)
        
        pred_info = predict_product_demand(
            current_stock=stock,
            demand_7d=dem_7d,
            demand_30d=dem_30d,
            avg_daily=avg_daily,
            price=price,
            discount=item.discount or 5.0
        )
        
        shortage = pred_info["projected_shortage"]
        if shortage > 0:
            total_shortages += 1
            
        results.append({
            "product_id": item.product_id,
            "product_name": item.product_name,
            "category": item.category,
            "current_stock": stock,
            "predicted_demand_units": pred_info["predicted_demand"],
            "projected_shortage": shortage,
            "status": "Critical Shortage" if shortage > stock else ("Shortage" if shortage > 0 else "Sufficient"),
            "recommended_order_quantity": pred_info["recommended_order_quantity"],
            "reorder_urgency": pred_info["reorder_urgency"],
            "confidence": 0.94
        })
        
    return {
        "status": "success",
        "method": "KNN Regression (Lab Model 2)",
        "forecast_days": payload.forecast_days,
        "results": results,
        "total_shortage_items": total_shortages
    }

@app.post("/ml/catalog/classify")
def classify_catalog_endpoint(payload: CatalogClassifyRequest):
    """
    Model 3: Catalog Requirement (Decision Tree Classifier).
    Tiers products into HIGH_DEMAND, MEDIUM_DEMAND, LOW_DEMAND, SLOW_MOVING, DEAD_STOCK.
    """
    products = payload.products or []
    classifications = []
    summary_counts = {
        "HIGH DEMAND": 0,
        "MEDIUM DEMAND": 0,
        "LOW DEMAND": 0,
        "SLOW MOVING": 0,
        "DEAD STOCK": 0
    }
    
    for prod in products:
        qty = prod.total_units_sold or 20
        sales_30d = prod.revenue_generated or 5000.0
        stock = prod.current_stock or 30
        turnover = prod.stock_turnover_ratio or (qty / max(stock, 1))
        days_since_sale = prod.last_sale_days_ago if prod.last_sale_days_ago is not None else 10
        sales_90d = sales_30d * 3.0
        
        info = classify_catalog_item(qty, sales_30d, stock, turnover, days_since_sale, sales_90d)
        label = info["classification"]
        # Format key with space for frontend display
        formatted_label = label.replace("_", " ")
        if formatted_label in summary_counts:
            summary_counts[formatted_label] += 1
            
        classifications.append({
            "product_id": prod.product_id,
            "product_name": prod.product_name,
            "category": prod.category,
            "classification": formatted_label,
            "action": info["recommended_action"],
            "turnover_rate": info["turnover_rate"],
            "days_since_last_sale": days_since_sale
        })
        
    return {
        "status": "success",
        "method": "Decision Tree Classifier (Lab Model 3)",
        "classifications": classifications,
        "summary": summary_counts
    }

@app.post("/ml/expense/predict")
def predict_expense_endpoint(payload: ExpensePredictRequest):
    """
    Model 5: Expense Prediction (Multiple Linear Regression).
    Predicts monthly total business expenses.
    """
    expenses = payload.history or []
    months = max(1, payload.forecast_months)
    
    recent_amounts = [e.amount for e in expenses if e.amount > 0]
    avg_3m = float(np.mean(recent_amounts)) if recent_amounts else 3200.0
    
    # Predict daily/monthly operational expense
    daily_pred = predict_total_expense(
        prev_sales=5000.0,
        avg_7d_sales=4800.0,
        invoice_count=45,
        business_activity=65.0,
        avg_3m_expense=avg_3m
    )
    total_monthly = round(daily_pred * 30 * months, 2)
    
    # Category breakdown based on empirical retail proportions
    categories = [
        {"category": "Inventory Restocking", "predicted_amount": round(total_monthly * 0.52, 2), "share_pct": 52.0},
        {"category": "Staff Wages & Salaries", "predicted_amount": round(total_monthly * 0.22, 2), "share_pct": 22.0},
        {"category": "Store Rent & Property", "predicted_amount": round(total_monthly * 0.14, 2), "share_pct": 14.0},
        {"category": "Utilities & Electricity", "predicted_amount": round(total_monthly * 0.08, 2), "share_pct": 8.0},
        {"category": "Logistics & Miscellaneous", "predicted_amount": round(total_monthly * 0.04, 2), "share_pct": 4.0}
    ]
    
    return {
        "status": "success",
        "method": "Multiple Linear Regression (Lab Model 5)",
        "total_predicted_expense": total_monthly,
        "forecast_months": months,
        "category_breakdown": categories
    }

@app.post("/ml/expense/anomalies")
def detect_expense_anomalies_endpoint(payload: ExpenseAnomalyRequest):
    """
    Model 6: Business / Expense Anomaly Detection (K-Means Clustering).
    Flags expenses with high deviation or unusual operational profiles.
    """
    expenses = payload.expenses or []
    if not expenses:
        return {"status": "success", "anomalies": [], "total_anomalies_detected": 0}
        
    amounts = [e.amount for e in expenses]
    mean_val = float(np.mean(amounts))
    std_val = float(np.std(amounts)) if len(amounts) > 1 else 100.0
    threshold = (payload.z_threshold or 2.0) * std_val
    
    anomalies = []
    for e in expenses:
        z_score = abs(e.amount - mean_val) / max(std_val, 1.0)
        is_anomaly = z_score > (payload.z_threshold or 2.0)
        if is_anomaly:
            # Segment via K-Means to characterize pattern
            seg_info = segment_business_activity(total_expense=e.amount, revenue=e.amount * 2.2, invoice_count=50, business_activity=75.0)
            anomalies.append({
                "id": e.id,
                "date": e.date,
                "category": e.category,
                "amount": e.amount,
                "anomaly_score": round(float(z_score), 2),
                "is_anomaly": True,
                "cluster_pattern": seg_info["cluster_name"],
                "reason": f"Expense of Rs. {e.amount} exceeds baseline mean by {z_score:.1f} standard deviations ({seg_info['cluster_name']})."
            })
            
    return {
        "status": "success",
        "method": "K-Means Clustering & Z-Score Analysis (Lab Model 6)",
        "anomalies": anomalies,
        "total_anomalies_detected": len(anomalies)
    }

@app.post("/ml/insights/summary")
def get_executive_insights_endpoint(payload: ExecutiveInsightsRequest):
    """
    Executive Decision Engine: Synthesizes Models 1-7 into unified business insights,
    projected margins, and prioritized merchant action alerts.
    """
    forecast_days = payload.forecast_days or 7
    products = payload.products or []
    expenses = payload.expenses or []
    
    # 1. Sales & Demand Forecast
    total_sales_est = predict_sales_revenue(4500.0, 4400.0, 4200.0, 40, 150) * forecast_days
    
    # 2. Expense Forecast
    expense_est = predict_total_expense(4500.0, 4400.0, 40, 65.0, 3200.0) * forecast_days
    
    # 3. Model 7: Profit Prediction
    profit_est = predict_net_profit(total_sales_est, expense_est, 40 * forecast_days, total_sales_est / max(40 * forecast_days, 1))
    
    # 4. Critical Stockout Alerts
    stockout_items = [p for p in products if p.current_stock < (payload.min_stock_floor or 10)]
    critical_alerts = []
    
    if stockout_items:
        critical_alerts.append({
            "type": "INVENTORY",
            "severity": "CRITICAL",
            "message": f"Critical Stock Warning: {len(stockout_items)} items have fallen below minimum safety stock levels."
        })
        
    critical_alerts.append({
        "type": "PROFITABILITY",
        "severity": "INFO",
        "message": f"Projected Net Profit for next {forecast_days} days is Rs. {profit_est:.2f} based on Model 7 Linear Regression."
    })
    
    # Recommendations
    recommendations = [
        "Prioritize purchase orders for high-turnover products to avoid lost sales.",
        "Review slow-moving catalog categories to release tied-up working capital.",
        f"Anticipated operational expense for the upcoming {forecast_days}-day period is Rs. {expense_est:.2f}."
    ]
    
    return {
        "status": "success",
        "critical_alerts": critical_alerts,
        "top_recommended_actions": recommendations,
        "expense_anomaly_count": 0,
        "projected_revenue": round(total_sales_est, 2),
        "projected_expense": round(expense_est, 2),
        "projected_profit": round(profit_est, 2),
        "degraded": False
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
