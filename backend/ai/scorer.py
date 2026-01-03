from __future__ import annotations

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
import joblib

from ai.features_logon import build_logon_features


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _model_path() -> Path:
    # backend/ai/scorer.py -> backend/models/logon_iforest_v1.joblib
    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / "models" / "logon_iforest_v1.joblib"


def score_csv_bytes(raw_csv: bytes, upload_id: str) -> Tuple[bytes, Dict[str, Any]]:
    """
    Production interface used by Azure Functions.

    Inputs:
      raw_csv: bytes of the uploaded CSV from Blob
      upload_id: id used for storage keys + traceability

    Outputs:
      scored_csv_bytes: CSV bytes with extra columns appended
      summary: dict written to results/summary/<upload_id>.json
    """
    scored_at = utc_now_iso()

    # Read CSV to DataFrame (handles BOM)
    df = pd.read_csv(io.BytesIO(raw_csv), encoding="utf-8-sig")
    rows = int(len(df))

    model_file = _model_path()

    # ---------- Fallback: dummy mode if model missing ----------
    if not model_file.exists():
        model_version = "dummy-v0"
        df["anomaly_score"] = 0.0
        df["is_anomaly"] = 0
        df["model_version"] = model_version
        df["scored_at"] = scored_at

        summary = {
            "upload_id": upload_id,
            "rows": rows,
            "anomalies": 0,
            "threshold": None,
            "model_version": model_version,
            "scored_at": scored_at,
            "notes": f"Model not found at {str(model_file)}; dummy scoring used.",
        }
        return df.to_csv(index=False).encode("utf-8"), summary

    # ---------- Real scoring ----------
    model = joblib.load(model_file)
    model_version = "iforest-v1"

    # Build numeric features for logon.csv
    X = build_logon_features(df)

    # IsolationForest decision_function: higher = more normal -> invert
    scores = (-model.decision_function(X)).astype(float)

    # Threshold: mark top 1% as anomalies (stable baseline)
    # If file is tiny, avoid marking everything as anomaly
    if rows >= 200:
        threshold = float(np.quantile(scores, 0.99))
    else:
        threshold = float("inf")

    is_anom = (scores >= threshold).astype(int)
    anomalies = int(is_anom.sum())

    # Append required output columns
    df["anomaly_score"] = scores
    df["is_anomaly"] = is_anom
    df["model_version"] = model_version
    df["scored_at"] = scored_at

    summary = {
        "upload_id": upload_id,
        "rows": rows,
        "anomalies": anomalies,
        "threshold": None if threshold == float("inf") else threshold,
        "model_version": model_version,
        "scored_at": scored_at,
        "model_file": str(model_file),
    }

    return df.to_csv(index=False).encode("utf-8"), summary
