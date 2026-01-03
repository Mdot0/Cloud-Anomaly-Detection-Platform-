from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

MODEL_VERSION = "iforest-v1"


@dataclass(frozen=True)
class ModelPaths:
    # local training artifact
    local_artifact: Path
    # production export artifact (what backend loads)
    production_artifact: Path


def default_paths() -> ModelPaths:
    ml_dir = Path(__file__).resolve().parent
    repo_root = ml_dir.parent
    return ModelPaths(
        local_artifact=ml_dir / "artifacts" / "logon_iforest_v1.joblib",
        production_artifact=repo_root / "backend" / "models" / "logon_iforest_v1.joblib",
    )


def train_model(X: np.ndarray, contamination: float = 0.01) -> Any:
    """
    Train IsolationForest for unsupervised anomaly detection.
    contamination=0.01 means target ~1% anomalies (baseline).
    """
    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    return model


def save_model(model: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)


def load_model(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Model artifact not found: {path}")
    return joblib.load(path)


def score_samples(model: Any, X: np.ndarray) -> np.ndarray:
    """
    sklearn IsolationForest: decision_function higher = more normal.
    We invert so higher = more suspicious (matches API meaning).
    """
    normality = model.decision_function(X)
    return (-normality).astype(float)


def pick_threshold(scores: np.ndarray, percentile: float = 99.0) -> float:
    """
    percentile=99 means top 1% flagged as anomalies.
    """
    return float(np.percentile(scores, percentile))
