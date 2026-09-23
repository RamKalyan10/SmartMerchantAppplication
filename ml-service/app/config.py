import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATA_DIR = BASE_DIR / "data"

os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR / "samples", exist_ok=True)

# --------------------------------------------------------------------------
# History requirements.
#
# Below these thresholds a model refuses to train and the API returns an
# explicit ``insufficient_data`` payload. Nothing in this service fabricates
# history to fill the gap.
# --------------------------------------------------------------------------
MIN_SALES_HISTORY_DAYS = 28        # calendar days of daily revenue
MIN_DEMAND_OBSERVATIONS = 7        # non-zero sales days for a single SKU
MIN_EXPENSE_OBSERVATIONS = 6       # records for a single expense category

# Records a category needs before its values are scored at all. Four is the
# floor at which a leave-one-out MAD baseline still has three points to work
# with; below that the "expected range" would be an artefact of one number.
# The old detector scored categories with as few as five records using a forced
# contamination rate, so it always produced flags — this floor trades that for
# an explicit "not scored, and here is why".
MIN_ANOMALY_OBSERVATIONS = 5
ISOLATION_FOREST_MIN_N = 20        # below this, robust z-scores only

# --------------------------------------------------------------------------
# Sales forecaster — direct multi-horizon quantile gradient boosting.
# --------------------------------------------------------------------------
SALES_HORIZON = 30                 # how many days ahead the model trains for
SALES_LAGS = (1, 7, 14, 28)
SALES_ROLLS = (7, 14, 28)
SALES_QUANTILES = (0.025, 0.5, 0.975)   # 95% prediction interval
BACKTEST_FOLDS = 4
MIN_TRAIN_DAYS = 21                # smallest training window in walk-forward

# --------------------------------------------------------------------------
# Inventory policy
# --------------------------------------------------------------------------
DEFAULT_SERVICE_LEVEL = 0.95
ANNUAL_ORDERING_COST = 250.0       # currency units per purchase order
ANNUAL_HOLDING_RATE = 0.20         # fraction of unit cost, per year
DEFAULT_REVIEW_PERIOD_DAYS = 7

# Density threshold (fraction of non-zero days) above which a SKU is modelled
# by the pooled gradient boosting model rather than Croston/SBA.
DEMAND_DENSE_THRESHOLD = 0.70

# --------------------------------------------------------------------------
# Registry
# --------------------------------------------------------------------------
MODEL_TTL_HOURS = 24

SERVICE_PORT = int(os.getenv("ML_PORT", 8000))
SERVICE_HOST = os.getenv("ML_HOST", "0.0.0.0")
