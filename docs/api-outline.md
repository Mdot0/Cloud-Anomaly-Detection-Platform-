# API Outline

Routes exposed by `backend/function_app.py` (Azure Functions, anonymous auth). All paths are
served under the Function App's `/api` prefix (e.g. `https://<functionapp>/api/upload-logs`).

## `GET /ping`
Liveness check. Returns `200 text/plain`.

## `POST /upload-logs`
Upload a CSV. Body is `multipart/form-data` with key `file`.

- Generates an `upload_id` (UUID) and stores the raw file at `logs/<upload_id>.csv` in Blob
  Storage.
- Best-effort enqueues a Service Bus message so `analyze_worker` can score it in the background.

Response:
```json
{
  "ok": true,
  "upload_id": "…",
  "blob": "<upload_id>.csv",
  "container": "logs",
  "storage_account": "…",
  "original_filename": "logon.csv",
  "size_bytes": 12345,
  "enqueued": true,
  "enqueue_error": null,
  "queue_name": "analyze-job"
}
```

## `GET /uploads?limit=N`
List recently uploaded blobs (default `limit=50`).

Response:
```json
{
  "count": 2,
  "items": [
    {
      "blob": "<upload_id>.csv",
      "size": 12345,
      "last_modified": "2026-01-01T00:00:00+00:00",
      "original_filename": "logon.csv",
      "uploaded_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

## `GET /results?upload_id=...&limit=N`
There is no synchronous "analyze" endpoint -- scoring always happens in the background via
`analyze_worker` (Service Bus queue trigger), kicked off automatically by `upload-logs`'s enqueue
step. This endpoint reads back whatever `analyze_worker` has produced (default `limit=200`).
Returns `404` if analysis hasn't finished yet (the frontend polls on a short interval and treats
404/202 as "still processing", not an error).

Response:
```json
{
  "summary": {
    "upload_id": "…",
    "rows": 84984,
    "anomalies": 850,
    "threshold": 0.62,
    "model_version": "iforest-v1",
    "scored_at": "2026-01-01T00:00:00Z",
    "input_blob": "logs/<upload_id>.csv",
    "output_blob": "results/scored/<upload_id>.csv",
    "original_filename": "logon.csv",
    "subjects": [
      {
        "user": "DNS1758",
        "event_count": 42,
        "distinct_pcs": 3,
        "new_pcs": ["PC-9981"],
        "off_hours_pct": 23.8,
        "risk_score": 0.31,
        "mean_anomaly_score": 0.04,
        "flagged_events": [
          { "date": "2010-02-02T23:58:56", "pc": "PC-9981", "activity": "Logon", "anomaly_score": 0.31 }
        ]
      }
    ]
  },
  "rows_returned": 200,
  "rows": [
    { "id": "…", "date": "…", "user": "…", "pc": "…", "activity": "Logon", "anomaly_score": 0.97, "is_anomaly": "1", "model_version": "iforest-v1", "scored_at": "…" }
  ]
}
```
See `docs/anomaly-schema.md` for what each `subjects` field means — this is the primary output
for the insider-threat/offboarding investigation use case; `rows` is supporting raw detail.
