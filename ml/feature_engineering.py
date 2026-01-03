from __future__ import annotations

import pandas as pd
import numpy as np


def build_features(df: pd.DataFrame) -> np.ndarray:
    """
    Convert a log dataframe into numeric feature matrix.
    Keep this robust:
      - handle missing columns
      - convert timestamps if present
      - encode categoricals safely
    Start simple and iterate.
    """
    df2 = df.copy()

    # Example: if Timestamp-like column exists, extract hour
    for col in ["timestamp", "Timestamp", "time", "Time"]:
        if col in df2.columns:
            t = pd.to_datetime(df2[col], errors="coerce", utc=True)
            df2["hour"] = t.dt.hour.fillna(-1).astype(int)
            break
    if "hour" not in df2.columns:
        df2["hour"] = -1

    # Keep only numeric columns (basic baseline)
    for c in df2.columns:
        if df2[c].dtype == object:
            # lightweight hash encoding for categoricals
            df2[c] = df2[c].fillna("").astype(str).map(lambda x: hash(x) % 10000)

    df2 = df2.fillna(0)

    X = df2.to_numpy(dtype=float)
    return X
