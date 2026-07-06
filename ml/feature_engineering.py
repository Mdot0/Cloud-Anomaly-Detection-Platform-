from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

LOGON_REQUIRED_COLS = {"date", "user", "pc", "activity"}


def parse_datetime_parts(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (hour, dow, is_weekend[bool]) parsed from df["date"] (LANL-style:
    "01/04/2010 00:10:37")."""
    ts = pd.to_datetime(df["date"], errors="coerce", format="%m/%d/%Y %H:%M:%S")
    hour = ts.dt.hour.fillna(0).astype(int)
    dow = ts.dt.dayofweek.fillna(0).astype(int)
    is_weekend = dow >= 5
    return hour, dow, is_weekend


def build_baseline_counts(df: pd.DataFrame) -> dict[str, Any]:
    """
    Historical frequency baseline: how often each user/PC/(user, PC) pair appears in df.
    Computed once from the full training set and frozen into the model artifact, so
    production scoring measures rarity against real history instead of whatever happens to be
    in the (possibly tiny) file being scored.
    """
    user_counts = {k: int(v) for k, v in df["user"].value_counts(dropna=False).items()}
    pc_counts = {k: int(v) for k, v in df["pc"].value_counts(dropna=False).items()}
    user_pc_counts = {k: int(v) for k, v in df.groupby(["user", "pc"]).size().items()}
    return {"user_counts": user_counts, "pc_counts": pc_counts, "user_pc_counts": user_pc_counts}


def build_logon_features(df: pd.DataFrame, baseline: dict[str, Any] | None = None) -> np.ndarray:
    df = df.copy()

    missing = LOGON_REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"logon.csv schema mismatch. Missing columns: {sorted(missing)}")

    hour, dow, is_weekend = parse_datetime_parts(df)
    df["hour"] = hour
    df["dow"] = dow
    df["is_weekend"] = is_weekend.astype(int)

    act = df["activity"].astype("string").fillna("NA")
    df["is_logon"] = (act == "Logon").astype(int)
    df["is_logoff"] = (act == "Logoff").astype(int)

    # Frequency/rarity features. When training, df IS the historical baseline, so counts are
    # computed from it directly. When scoring production uploads, a frozen baseline (built once
    # at training time from the full history) is passed in instead -- rarity should reflect how
    # unusual something is for this user/PC historically, not how unusual it is within whatever
    # small file happens to be uploaded.
    if baseline is None:
        baseline = build_baseline_counts(df)

    user_counts = baseline["user_counts"]
    pc_counts = baseline["pc_counts"]
    user_pc_counts = baseline["user_pc_counts"]

    df["user_event_count"] = df["user"].map(user_counts).fillna(1).astype(int)
    df["pc_event_count"] = df["pc"].map(pc_counts).fillna(1).astype(int)
    df["user_pc_count"] = [int(user_pc_counts.get((u, p), 1)) for u, p in zip(df["user"], df["pc"])]

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
