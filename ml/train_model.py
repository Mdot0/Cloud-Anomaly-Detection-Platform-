from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from feature_engineering import build_baseline_counts, build_logon_features
from anomaly_model import MODEL_VERSION, default_paths, save_model, train_model


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to logon.csv training file")
    ap.add_argument("--contamination", type=float, default=0.01, help="Target anomaly rate (default 0.01)")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    X = build_logon_features(df)

    # The training set doubles as the historical baseline: production scoring will look up
    # rarity against these counts rather than recomputing them from whatever gets uploaded.
    baseline = build_baseline_counts(df)

    model = train_model(X, contamination=args.contamination)

    paths = default_paths()

    # Save local artifact (training record)
    save_model(model, baseline, paths.local_artifact)

    # Export production artifact (what backend loads)
    save_model(model, baseline, paths.production_artifact)

    print(f"[OK] Trained {MODEL_VERSION}")
    print(f"[OK] Saved local artifact -> {paths.local_artifact}")
    print(f"[OK] Exported production artifact -> {paths.production_artifact}")


if __name__ == "__main__":
    main()
