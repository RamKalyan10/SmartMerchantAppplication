"""Per-store model registry.

Replaces two defects in the previous design:

* ``predict_sales`` refit the model — and re-pickled it to disk — on *every*
  request that carried more than 14 history rows.
* The model lived on a module-level singleton which FastAPI's threadpool
  mutated concurrently, so a request for one store could overwrite the model
  another request was mid-forecast with.

Here artifacts are keyed by ``(store_id, model_name)`` and invalidated on a
content fingerprint, so training happens once per data change rather than once
per request. Training is serialised per key but never blocks other stores.
"""

import hashlib
import os
import pickle
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import sklearn


def runtime_info() -> Dict[str, str]:
    """Library versions stamped into artifacts so stale pickles are detectable."""
    return {
        "python_pickle": "4",
        "scikit_learn": sklearn.__version__,
        "numpy": np.__version__,
        "pandas": pd.__version__,
    }


@dataclass
class ModelArtifact:
    store_id: str
    model_name: str
    fingerprint: str
    trained_at: str
    n_samples: int
    metrics: Dict[str, Any] = field(default_factory=dict)
    payload: Any = None
    runtime: Dict[str, str] = field(default_factory=runtime_info)

    def to_info(self) -> Dict[str, Any]:
        """Metadata only — the payload is deliberately excluded."""
        return {
            "store_id": self.store_id,
            "model": self.model_name,
            "trained_at": self.trained_at,
            "n_samples": self.n_samples,
            "metrics": self.metrics,
            "runtime": self.runtime,
        }


class ModelRegistry:
    """Content-addressed cache of trained models, backed by disk."""

    def __init__(self, base_dir: Path, ttl_hours: int = 24):
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)
        self._ttl = timedelta(hours=ttl_hours)
        self._cache: Dict[Tuple[str, str], ModelArtifact] = {}
        self._lock = threading.RLock()
        self._train_locks: Dict[Tuple[str, str], threading.Lock] = {}

    # -- helpers ----------------------------------------------------------

    @staticmethod
    def fingerprint(*parts: Any) -> str:
        digest = hashlib.sha256()
        for part in parts:
            digest.update(repr(part).encode("utf-8"))
            digest.update(b"\x00")
        return digest.hexdigest()[:16]

    def _key(self, store_id: str, model_name: str) -> Tuple[str, str]:
        return (store_id, model_name)

    def _path(self, store_id: str, model_name: str) -> Path:
        safe_store = "".join(c if c.isalnum() or c in "-_" else "_" for c in store_id)
        return self._base / safe_store / f"{model_name}.pkl"

    def _is_fresh(self, artifact: ModelArtifact) -> bool:
        try:
            trained = datetime.fromisoformat(artifact.trained_at)
        except (TypeError, ValueError):
            return False
        if trained.tzinfo is None:
            trained = trained.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - trained < self._ttl

    def _train_lock(self, key: Tuple[str, str]) -> threading.Lock:
        with self._lock:
            if key not in self._train_locks:
                self._train_locks[key] = threading.Lock()
            return self._train_locks[key]

    # -- persistence ------------------------------------------------------

    def _save(self, artifact: ModelArtifact) -> None:
        """Atomic write: a crash mid-save must not leave a truncated pickle."""
        path = self._path(artifact.store_id, artifact.model_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".pkl.tmp")
        with open(tmp, "wb") as handle:
            pickle.dump(artifact, handle, protocol=4)
        os.replace(tmp, path)

    def _load(self, store_id: str, model_name: str) -> Optional[ModelArtifact]:
        path = self._path(store_id, model_name)
        if not path.exists():
            return None
        try:
            with open(path, "rb") as handle:
                artifact = pickle.load(handle)
        except Exception:
            # Corrupt or version-incompatible artifact — treat as absent.
            return None
        return artifact if isinstance(artifact, ModelArtifact) else None

    # -- public API -------------------------------------------------------

    def get(self, store_id: str, model_name: str, fingerprint: str) -> Optional[ModelArtifact]:
        key = self._key(store_id, model_name)

        with self._lock:
            cached = self._cache.get(key)
        if cached and cached.fingerprint == fingerprint and self._is_fresh(cached):
            return cached

        loaded = self._load(store_id, model_name)
        if loaded and loaded.fingerprint == fingerprint and self._is_fresh(loaded):
            with self._lock:
                self._cache[key] = loaded
            return loaded

        return None

    def get_or_train(
        self,
        store_id: str,
        model_name: str,
        fingerprint: str,
        trainer: Callable[[], ModelArtifact],
    ) -> ModelArtifact:
        """Return a fresh artifact, training only if the fingerprint changed."""
        existing = self.get(store_id, model_name, fingerprint)
        if existing is not None:
            return existing

        key = self._key(store_id, model_name)
        with self._train_lock(key):
            # Another thread may have trained while we waited for the lock.
            existing = self.get(store_id, model_name, fingerprint)
            if existing is not None:
                return existing

            artifact = trainer()
            artifact.store_id = store_id
            artifact.model_name = model_name
            artifact.fingerprint = fingerprint

            with self._lock:
                self._cache[key] = artifact
            try:
                self._save(artifact)
            except Exception as exc:  # a failed save must not fail the request
                print(f"[registry] could not persist {store_id}/{model_name}: {exc}")
            return artifact

    def invalidate(self, store_id: str, model_name: Optional[str] = None) -> int:
        with self._lock:
            if model_name is None:
                keys = [k for k in self._cache if k[0] == store_id]
            else:
                keys = [self._key(store_id, model_name)]
            for key in keys:
                self._cache.pop(key, None)

        removed = 0
        for _, name in keys:
            path = self._path(store_id, name)
            if path.exists():
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
        return removed

    def preload(self) -> int:
        """Load every artifact already on disk into memory.

        Called at service start so the first request after a restart does not
        pay a cold training cost. Fingerprints are still verified on ``get()``,
        so a stale artifact found here is simply refit.
        """
        loaded = 0
        for path in sorted(self._base.glob("*/*.pkl")):
            store_id = path.parent.name
            model_name = path.stem
            artifact = self._load(store_id, model_name)
            if artifact is None:
                continue
            with self._lock:
                self._cache[self._key(store_id, model_name)] = artifact
            loaded += 1
        return loaded

    def describe(self) -> List[Dict[str, Any]]:
        """Metadata for every cached model — powers the ``/ml/metrics`` endpoint."""
        with self._lock:
            return [artifact.to_info() for artifact in self._cache.values()]

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_default_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    """Process-wide registry, created on first use.

    A function rather than an import-time global so that ``app.config`` is
    resolved lazily and module import order never matters.
    """
    global _default_registry
    if _default_registry is None:
        from app.config import ARTIFACTS_DIR, MODEL_TTL_HOURS

        _default_registry = ModelRegistry(ARTIFACTS_DIR, ttl_hours=MODEL_TTL_HOURS)
    return _default_registry
