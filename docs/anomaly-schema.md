# Anomaly Schema (v1) – Azure Table Storage `Anomalies`

Each anomaly row contains:

- `PartitionKey`: `dataset_id` (string)
- `RowKey`: `anomaly_id` (UUID string)

Other properties:
- `timestamp`: string
- `host`: string
- `user`: string
- `process_name`: string
- `parent_process`: string
- `command_line`: string

ML fields:
- `score`: float (0–1 anomaly score or model-specific)
- `severity`: string (`low`, `medium`, `high`)
- (optional) `model_version`: string
