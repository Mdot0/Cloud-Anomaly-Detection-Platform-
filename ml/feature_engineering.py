from __future__ import annotations

import numpy as np
import pandas as pd


LANL_DATE_FORMAT = "%m/%d/%Y %H:%M:%S"


def build_logon_features(df: pd.DataFrame) -> np.ndarray:
    """
    Build numeric features for LANL-style logon.csv:

    Expected columns:
      id, date, user, pc, activity

    Features:
      - time: hour, dow, is_weekend
      - activity: is_logon, is_logoff
      - within-file frequency/rarity:
        user_event_count, pc_event_count, user_pc_count
        inv_user_event_count, inv_pc_event_count, inv_user_pc_count
    """
    df = df.copy()

    # --- required columns sanity (don't crash if missing; fill safe defaults)
    for col in ["date", "user", "pc", "activity"]:
        if col not in df.columns:
            df[col] = ""

    # --- time features from "date"
    ts = pd.to_datetime(df["date"], errors="coerce", format=LANL_DATE_FORMAT)
    df["hour"] = ts.dt.hour.fillna(0).astype(int)
    df["dow"] = ts.dt.dayofweek.fillna(0).astype(int)
    df["is_weekend"] = (df["dow"] >= 5).astype(int)

    # --- activity encoding
    act = df["activity"].astype("string").fillna("NA")
    df["is_logon"] = (act == "Logon").astype(int)
    df["is_logoff"] = (act == "Logoff").astype(int)

    # --- within-file counts
    user_counts = df["user"].value_counts(dropna=False)
    pc_counts = df["pc"].value_counts(dropna=False)

    df["user_event_count"] = df["user"].map(user_counts).fillna(1).astype(int)
    df["pc_event_count"] = df["pc"].map(pc_counts).fillna(1).astype(int)

    user_pc_counts = df.groupby(["user", "pc"]).size()
    df["user_pc_count"] = [
        int(user_pc_counts.get((u, p), 1)) for u, p in zip(df["user"], df["pc"])
    ]

    # --- rarity transforms (higher = rarer)
    df["inv_user_event_count"] = 1.0 / df["user_event_count"].clip(lower=1)
    df["inv_pc_event_count"] = 1.0 / df["pc_event_count"].clip(lower=1)
    df["inv_user_pc_count"] = 1.0 / pd.Series(df["user_pc_count"]).clip(lower=1)

    feature_cols = [
        "hour", "dow", "is_weekend",
        "is_logon", "is_logoff",
        "user_event_count", "pc_event_count", "user_pc_count",
        "inv_user_event_count", "inv_pc_event_count", "inv_user_pc_count",
    ]

    return df[feature_cols].to_numpy(dtype=np.float32)
