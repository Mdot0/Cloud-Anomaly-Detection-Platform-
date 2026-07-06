from __future__ import annotations

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
import joblib

from ai.features_logon import build_logon_features
from ai.investigation import build_subject_summaries

# Mirrors ml/anomaly_model.py:MODEL_VERSION -- kept as a separate constant here (not imported)
# because backend/ai/ deliberately never imports from ml/ (see CLAUDE.md training/inference split).
MODEL_VERSION = "iforest-v1"
DUMMY_MODEL_VERSION = "dummy-v0"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _model_path() -> Path:
    # backend/ai/scorer.py -> backend/models/logon_iforest_v1.joblib
    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / "models" / "logon_iforest_v1.joblib"


def _dummy_score_df(df: pd.DataFrame, upload_id: str, scored_at: str, notes: str) -> Tuple[bytes, Dict[str, Any]]:
    model_version = DUMMY_MODEL_VERSION
    df = df.copy()
    df["anomaly_score"] = 0.0
    df["is_anomaly"] = 0
    df["model_version"] = model_version
    df["scored_at"] = scored_at

    summary = {
        "upload_id": upload_id,
        "rows": int(len(df)),
        "anomalies": 0,
        "threshold": None,
        "model_version": model_version,
        "scored_at": scored_at,
        "notes": notes,
    }
    return df.to_csv(index=False).encode("utf-8"), summary


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
        return _dummy_score_df(
            df,
            upload_id=upload_id,
            scored_at=scored_at,
            notes=f"Model not found at {str(model_file)}; dummy scoring used.",
        )

    # ---------- Real scoring ----------
    artifact = joblib.load(model_file)
    model, baseline = artifact["model"], artifact["baseline"]
    model_version = MODEL_VERSION

    # Build numeric features for logon.csv (may fail if wrong schema)
    try:
        # Score against the trained baseline, not this upload's own within-file frequency --
        # rarity should reflect how unusual something is historically, not how unusual it is
        # relative to whatever else happens to be in this particular file.
        X = build_logon_features(df, baseline=baseline)

        # IsolationForest decision_function: higher = more normal -> invert
        scores = (-model.decision_function(X)).astype(float)

    except Exception as e:
        # KeyError('date') or any schema / parsing error -> don't crash the worker
        return _dummy_score_df(
            df,
            upload_id=upload_id,
            scored_at=scored_at,
            notes=f"Scoring skipped (logon feature/schema mismatch): {repr(e)}",
        )

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

    # Per-user investigative summary: "was this person's behavior weird", not just "which
    # rows are weird" -- the actual question for an insider-threat/offboarding investigation.
    subjects = build_subject_summaries(df, baseline)

    summary = {
        "upload_id": upload_id,
        "rows": rows,
        "anomalies": anomalies,
        "threshold": None if threshold == float("inf") else threshold,
        "model_version": model_version,
        "scored_at": scored_at,
        "model_file": str(model_file),
        "subjects": subjects,
    }

    return df.to_csv(index=False).encode("utf-8"), summary
