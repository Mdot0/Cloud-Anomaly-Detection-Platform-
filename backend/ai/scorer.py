from __future__ import annotations
import csv, io
from datetime import datetime, timezone
from typing import Tuple, Dict, Any

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

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
    text = raw_csv.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []

    required_cols = ["anomaly_score", "is_anomaly", "model_version", "scored_at"]
    for c in required_cols:
        if c not in fieldnames:
            fieldnames.append(c)

    scored_at = utc_now_iso()
    model_version = "dummy-v0"  # partner will replace with real model version

    out_buf = io.StringIO()
    writer = csv.DictWriter(out_buf, fieldnames=fieldnames)
    writer.writeheader()

    rows = 0
    anomalies = 0
    for row in reader:
        # TODO: replace with real scoring
        row["anomaly_score"] = "0.0"
        row["is_anomaly"] = "0"
        row["model_version"] = model_version
        row["scored_at"] = scored_at
        writer.writerow(row)
        rows += 1

    scored_bytes = out_buf.getvalue().encode("utf-8")

    summary = {
        "upload_id": upload_id,
        "rows": rows,
        "anomalies": anomalies,
        "threshold": "none (dummy)",
        "model_version": model_version,
        "scored_at": scored_at,
    }
    return scored_bytes, summary
