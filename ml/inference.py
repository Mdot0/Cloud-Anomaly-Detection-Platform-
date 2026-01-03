from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Tuple

import pandas as pd

from .feature_engineering import build_features
from .anomaly_model import load_model, score_samples, pick_threshold, MODEL_VERSION


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def score_rows(rows: List[Dict]) -> Tuple[List[Dict], Dict]:
    """
    INPUT:
      rows: list of dict rows from csv.DictReader

    OUTPUT:
      scored_rows: same rows but with extra fields added:
        anomaly_score, is_anomaly, model_version, scored_at
      summary: dict with at least:
        rows, anomalies, threshold, model_version, scored_at
    """
    if not rows:
        return [], {
            "rows": 0,
            "anomalies": 0,
            "threshold": None,
            "model_version": MODEL_VERSION,
            "scored_at": utc_now_iso(),
        }

    df = pd.DataFrame(rows)

    # 1) build features (shared with training)
    X = build_features(df)

    # 2) load trained model artifact
    model = load_model()

    # 3) get numeric anomaly scores (float per row)
    scores = score_samples(model, X)  # List[float] or np.array

    # 4) choose a threshold (static or percentile)
    threshold = pick_threshold(scores)

    scored_at = utc_now_iso()

    scored_rows: List[Dict] = []
    anomalies = 0

    for row, s in zip(rows, scores):
        score_f = float(s)
        is_anom = 1 if score_f >= threshold else 0
        anomalies += is_anom

        out = dict(row)
        out["anomaly_score"] = score_f
        out["is_anomaly"] = is_anom
        out["model_version"] = MODEL_VERSION
        out["scored_at"] = scored_at
        scored_rows.append(out)

    summary = {
        "rows": len(rows),
        "anomalies": anomalies,
        "threshold": float(threshold) if threshold is not None else None,
        "model_version": MODEL_VERSION,
        "scored_at": scored_at,
    }

    return scored_rows, summary
