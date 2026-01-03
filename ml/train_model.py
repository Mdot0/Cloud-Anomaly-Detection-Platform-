from __future__ import annotations

import argparse
import pandas as pd

from .feature_engineering import build_features
from .anomaly_model import train_model, save_model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to training CSV (e.g., logon.csv)")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    X = build_features(df)

    model = train_model(X)
    save_model(model)

    print("Saved model to ml/artifacts/model.pkl")


if __name__ == "__main__":
    main()