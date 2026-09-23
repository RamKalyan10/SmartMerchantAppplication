import os
from pathlib import Path
from app.config.settings import settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATA_DIR = BASE_DIR / "data"

os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR / "samples", exist_ok=True)

MIN_SALES_HISTORY_DAYS = 28        # calendar days of daily revenue
MIN_DEMAND_OBSERVATIONS = 7        # non-zero sales days for a single SKU
MIN_EXPENSE_OBSERVATIONS = 6       # records for a single expense category

MIN_ANOMALY_OBSERVATIONS = 5
ISOLATION_FOREST_MIN_N = 20        # below this, robust z-scores only

SALES_HORIZON = 30                 # how many days ahead the model trains for
SALES_LAGS = (1, 7, 14, 28)
SALES_ROLLS = (7, 14, 28)
SALES_QUANTILES = (0.025, 0.5, 0.975)   # 95% prediction interval
BACKTEST_FOLDS = 4
MIN_TRAIN_DAYS = 21                # smallest training window in walk-forward

DEFAULT_SERVICE_LEVEL = 0.95
ANNUAL_ORDERING_COST = 250.0       # currency units per purchase order
ANNUAL_HOLDING_RATE = 0.20         # fraction of unit cost, per year
DEFAULT_REVIEW_PERIOD_DAYS = 7

DEMAND_DENSE_THRESHOLD = 0.70

MODEL_TTL_HOURS = 24

SERVICE_PORT = int(os.getenv("ML_PORT", 8000))
SERVICE_HOST = os.getenv("ML_HOST", "0.0.0.0")

__all__ = [
    "settings",
    "BASE_DIR",
    "ARTIFACTS_DIR",
    "DATA_DIR",
    "MIN_SALES_HISTORY_DAYS",
    "MIN_DEMAND_OBSERVATIONS",
    "MIN_EXPENSE_OBSERVATIONS",
    "MIN_ANOMALY_OBSERVATIONS",
    "ISOLATION_FOREST_MIN_N",
    "SALES_HORIZON",
    "SALES_LAGS",
    "SALES_ROLLS",
    "SALES_QUANTILES",
    "BACKTEST_FOLDS",
    "MIN_TRAIN_DAYS",
    "DEFAULT_SERVICE_LEVEL",
    "ANNUAL_ORDERING_COST",
    "ANNUAL_HOLDING_RATE",
    "DEFAULT_REVIEW_PERIOD_DAYS",
    "DEMAND_DENSE_THRESHOLD",
    "MODEL_TTL_HOURS",
    "SERVICE_PORT",
    "SERVICE_HOST",
]
