from __future__ import annotations

import json
import os
import pickle
from typing import Any, Optional

import numpy as np
from sklearn.ensemble import IsolationForest

MODEL_VERSION = "iforest-v1"
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.pkl")


def train_model(X) -> Any:
    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    return model


def save_model(model: Any) -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)


def load_model() -> Any:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model artifact not found at {MODEL_PATH}. Run ml/train_model.py first."
        )
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def score_samples(model: Any, X) -> np.ndarray:
    """
    IsolationForest returns anomaly score via decision_function (higher = more normal),
    so we invert sign so higher means more anomalous.
    """
    normality = model.decision_function(X)
    return (-normality).astype(float)


def pick_threshold(scores: np.ndarray, percentile: float = 95.0) -> float:
    """
    Pick threshold so top ~5% are flagged as anomalies.
    """
    return float(np.percentile(scores, percentile))
