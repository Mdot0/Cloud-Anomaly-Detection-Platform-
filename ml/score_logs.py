from __future__ import annotations

import argparse

import numpy as np
import pandas as pd

from anomaly_model import default_paths, load_model, pick_threshold, score_samples
from feature_engineering import build_logon_features


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to logon.csv to score")
    ap.add_argument("--percentile", type=float, default=99.0, help="Threshold percentile (default 99)")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    X = build_logon_features(df)

    paths = default_paths()
    model = load_model(paths.production_artifact)

    scores = score_samples(model, X)
    threshold = pick_threshold(scores, percentile=args.percentile)
    is_anom = (scores >= threshold).astype(int)

    print("Rows:", len(df))
    print("Score stats (min/mean/max):", float(scores.min()), float(scores.mean()), float(scores.max()))
    print("Threshold:", threshold)
    print("Anomalies:", int(is_anom.sum()))

    out = df.copy()
    out["anomaly_score"] = scores
    out["is_anomaly"] = is_anom

    cols = [c for c in ["id", "date", "user", "pc", "activity"] if c in out.columns]
    cols += ["anomaly_score", "is_anomaly"]

    print("\nTop 20 anomalies:")
    print(out.sort_values("anomaly_score", ascending=False).head(20)[cols])


if __name__ == "__main__":
    main()
