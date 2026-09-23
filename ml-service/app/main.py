"""Smart Merchant AI & Predictive Analytics Engine — FastAPI Application Entrypoint."""

import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    anomaly,
    catalog,
    demand,
    expense,
    inventory,
    profit,
    recommendations,
    sales,
)
from app.config.settings import settings
from app.services.prediction_service import get_prediction_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==========================================================")
    print("[INFO] Initializing Smart Merchant Machine Learning Service...")
    loaded = get_prediction_service().load_models()
    print(f"[OK] In-Memory Model Cache Ready: {loaded} Joblib model(s) loaded.")
    print("==========================================================")
    yield
    print("[INFO] Shutting down Smart Merchant ML Service...")


app = FastAPI(
    title="Smart Merchant AI & Predictive Analytics Engine",
    description=(
        "Production Machine Learning pipeline providing Sales Forecasting (XGBoost), "
        "Product Demand Estimation, Catalog Segmentation, Expense Prediction, "
        "Isolation Forest Anomaly Detection, Inventory Replenishment Decision Engine, "
        "and Executive Profit Forecasts."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Primary API v1 Router Endpoints
api_v1_routers = [
    sales.router,
    demand.router,
    catalog.router,
    expense.router,
    anomaly.router,
    inventory.router,
    profit.router,
    recommendations.router,
    insights.router,
    metrics.router,
]

for r in api_v1_routers:
    app.include_router(r, prefix="/api/v1")
    # Backwards compatibility mounts for existing Node.js Express proxy
    app.include_router(r, prefix="/ml")


@app.get("/")
def root():
    return {
        "service": "Smart Merchant Machine Learning Engine",
        "status": "online",
        "version": "2.0.0",
        "endpoints": {
            "sales_prediction": "/api/v1/predict/sales",
            "demand_prediction": "/api/v1/predict/demand",
            "catalog_classification": "/api/v1/predict/catalog",
            "expense_prediction": "/api/v1/predict/expense",
            "anomaly_detection": "/api/v1/predict/anomaly",
            "inventory_engine": "/api/v1/predict/inventory",
            "profit_forecast": "/api/v1/predict/profit",
            "recommendations": "/api/v1/recommendations",
            "health": "/api/v1/health",
            "swagger_docs": "/docs",
        },
    }


@app.get("/api/v1/health")
@app.get("/health")
def health():
    pred_svc = get_prediction_service()
    cached = sum(
        1
        for m in [
            pred_svc._sales_model,
            pred_svc._demand_model,
            pred_svc._catalog_model,
            pred_svc._expense_model,
            pred_svc._anomaly_bundle,
        ]
        if m is not None
    )
    return {
        "status": "healthy",
        "service": "smart-merchant-ml",
        "models_cached": cached,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.SERVICE_HOST,
        port=settings.SERVICE_PORT,
        reload=False,
    )
