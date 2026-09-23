import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from app.config.settings import settings

logger = logging.getLogger("ml-service.database")

BACKEND_DB_JSON = (
    settings.BASE_DIR.parent / "backend" / "data" / "merchant_db.json"
)


class DatabaseClient:
    """Provides unified extraction of business records from PostgreSQL or JSON fallback."""

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or settings.DATABASE_URL
        self._pg_conn = None

    def _get_pg_connection(self):
        try:
            import psycopg2

            if self._pg_conn is None or self._pg_conn.closed:
                self._pg_conn = psycopg2.connect(
                    self.database_url, connect_timeout=3
                )
            return self._pg_conn
        except Exception as e:
            logger.info(
                "PostgreSQL connection not established (%s). Using local JSON store.",
                e,
            )
            return None

    def _read_local_json(self) -> Dict[str, List[Dict[str, Any]]]:
        if not BACKEND_DB_JSON.exists():
            sample_file = settings.DATA_SAMPLES_DIR / "sample_merchant_db.json"
            if sample_file.exists():
                with open(sample_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            return {
                "invoices": [],
                "products": [],
                "expenses": [],
                "customers": [],
            }
        with open(BACKEND_DB_JSON, "r", encoding="utf-8") as f:
            return json.load(f)

    def extract_invoices(
        self, store_id: Optional[str] = None
    ) -> pd.DataFrame:
        target_store = store_id or settings.DEFAULT_STORE_ID
        pg = self._get_pg_connection()
        if pg:
            try:
                query = (
                    "SELECT * FROM invoices WHERE store_id = %s ORDER BY date ASC, time ASC;"
                )
                df = pd.read_sql_query(query, pg, params=(target_store,))
                if not df.empty:
                    df["date"] = pd.to_datetime(df["date"])
                    return df
            except Exception as e:
                logger.warning("PG extract_invoices failed (%s). Falling back.", e)

        # Fallback to local JSON
        db = self._read_local_json()
        invoices = [
            inv
            for inv in db.get("invoices", [])
            if not target_store or inv.get("store_id") == target_store
        ]
        if not invoices:
            return pd.DataFrame()
        df = pd.DataFrame(invoices)
        df["date"] = pd.to_datetime(df["date"])
        df["total_amount"] = pd.to_numeric(
            df["total_amount"], errors="coerce"
        ).fillna(0.0)
        return df.sort_values(by="date").reset_index(drop=True)

    def extract_products(
        self, store_id: Optional[str] = None
    ) -> pd.DataFrame:
        target_store = store_id or settings.DEFAULT_STORE_ID
        pg = self._get_pg_connection()
        if pg:
            try:
                query = "SELECT * FROM products WHERE store_id = %s;"
                df = pd.read_sql_query(query, pg, params=(target_store,))
                if not df.empty:
                    return df
            except Exception as e:
                logger.warning("PG extract_products failed (%s). Falling back.", e)

        db = self._read_local_json()
        products = [
            p
            for p in db.get("products", [])
            if not target_store or p.get("store_id") == target_store
        ]
        return pd.DataFrame(products)

    def extract_expenses(
        self, store_id: Optional[str] = None
    ) -> pd.DataFrame:
        target_store = store_id or settings.DEFAULT_STORE_ID
        pg = self._get_pg_connection()
        if pg:
            try:
                query = (
                    "SELECT * FROM expenses WHERE store_id = %s ORDER BY date ASC;"
                )
                df = pd.read_sql_query(query, pg, params=(target_store,))
                if not df.empty:
                    df["date"] = pd.to_datetime(df["date"])
                    return df
            except Exception as e:
                logger.warning("PG extract_expenses failed (%s). Falling back.", e)

        db = self._read_local_json()
        expenses = [
            e
            for e in db.get("expenses", [])
            if not target_store or e.get("store_id") == target_store
        ]
        if not expenses:
            return pd.DataFrame()
        df = pd.DataFrame(expenses)
        df["date"] = pd.to_datetime(df["date"])
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
        return df.sort_values(by="date").reset_index(drop=True)

    def extract_customers(
        self, store_id: Optional[str] = None
    ) -> pd.DataFrame:
        target_store = store_id or settings.DEFAULT_STORE_ID
        pg = self._get_pg_connection()
        if pg:
            try:
                query = "SELECT * FROM customers WHERE store_id = %s;"
                df = pd.read_sql_query(query, pg, params=(target_store,))
                if not df.empty:
                    return df
            except Exception as e:
                logger.warning("PG extract_customers failed (%s). Falling back.", e)

        db = self._read_local_json()
        customers = [
            c
            for c in db.get("customers", [])
            if not target_store or c.get("store_id") == target_store
        ]
        return pd.DataFrame(customers)
