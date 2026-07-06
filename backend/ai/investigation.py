from __future__ import annotations

from typing import Any

import pandas as pd

from ai.features_logon import parse_datetime_parts

MAX_SUBJECTS = 50
MAX_FLAGGED_EVENTS_PER_SUBJECT = 10


def build_subject_summaries(scored_df: pd.DataFrame, baseline: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Per-user investigative summary over an already-scored dataframe: answers "was this person's
    behavior weird" rather than just "which individual rows are weird" -- the actual question an
    analyst investigating a flagged employee needs answered.

    Uses the same frozen historical baseline the model was scored against (see
    ai/features_logon.py / ml/feature_engineering.py:build_baseline_counts) to tell "genuinely
    never used this PC before" apart from "just doesn't show up much in this file."
    """
    if scored_df.empty or "user" not in scored_df.columns:
        return []

    df = scored_df.copy()
    hour, _dow, is_weekend = parse_datetime_parts(df)
    df["_off_hours"] = (hour < 7) | (hour > 19) | is_weekend

    user_pc_counts = baseline.get("user_pc_counts", {})

    summaries: list[dict[str, Any]] = []
    for user, sub in df.groupby("user"):
        pcs = sub["pc"].unique().tolist()
        new_pcs = sorted(pc for pc in pcs if user_pc_counts.get((user, pc), 0) == 0)
        top_flagged = sub.sort_values("anomaly_score", ascending=False).head(MAX_FLAGGED_EVENTS_PER_SUBJECT)

        summaries.append(
            {
                "user": user,
                "event_count": int(len(sub)),
                "distinct_pcs": int(len(pcs)),
                "new_pcs": new_pcs,
                "off_hours_pct": float(round(100 * sub["_off_hours"].mean(), 1)),
                "risk_score": float(sub["anomaly_score"].max()),
                "mean_anomaly_score": float(sub["anomaly_score"].mean()),
                "flagged_events": [
                    {
                        "date": str(row["date"]),
                        "pc": str(row["pc"]),
                        "activity": str(row["activity"]),
                        "anomaly_score": float(row["anomaly_score"]),
                    }
                    for _, row in top_flagged.iterrows()
                ],
            }
        )

    summaries.sort(key=lambda s: s["risk_score"], reverse=True)
    return summaries[:MAX_SUBJECTS]
