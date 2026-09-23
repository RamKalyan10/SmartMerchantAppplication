import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings:
    SERVICE_HOST: str = os.getenv("HOST", "0.0.0.0")
    SERVICE_PORT: int = int(os.getenv("PORT", os.getenv("ML_PORT", 8000)))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/smart_merchant"
    )

    BASE_DIR: Path = BASE_DIR
    MODEL_DIR: Path = BASE_DIR / os.getenv("MODEL_DIR", "app/models")
    PREPROCESSOR_DIR: Path = BASE_DIR / os.getenv("PREPROCESSOR_DIR", "app/preprocessing")
    METRICS_PATH: Path = BASE_DIR / os.getenv("METRICS_PATH", "app/models/model_metrics.json")
    METADATA_PATH: Path = BASE_DIR / os.getenv("METADATA_PATH", "app/models/model_metadata.json")

    DATA_RAW_DIR: Path = BASE_DIR / os.getenv("DATA_RAW_DIR", "data/raw")
    DATA_PROCESSED_DIR: Path = BASE_DIR / os.getenv("DATA_PROCESSED_DIR", "data/processed")
    DATA_SAMPLES_DIR: Path = BASE_DIR / os.getenv("DATA_SAMPLES_DIR", "data/samples")

    DEFAULT_STORE_ID: str = "store_dwdm_001"

    # Minimum data sufficiency thresholds in days
    MIN_DAYS_INSUFFICIENT: int = 7
    MIN_DAYS_LIMITED: int = 30
    MIN_DAYS_NORMAL: int = 90


settings = Settings()

# Ensure required directories exist
for folder in [
    settings.MODEL_DIR,
    settings.PREPROCESSOR_DIR,
    settings.DATA_RAW_DIR,
    settings.DATA_PROCESSED_DIR,
    settings.DATA_SAMPLES_DIR,
]:
    folder.mkdir(parents=True, exist_ok=True)
