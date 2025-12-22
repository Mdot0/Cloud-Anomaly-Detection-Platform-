\# CloudGuard AI ↔ Azure Contract (v0.1)



This document defines the \*\*interface\*\* between:

\- \*\*Azure pipeline\*\* (uploads + triggers + storage + dashboard API)

\- \*\*AI/ML scorer\*\* (feature engineering + anomaly model)



The goal: you (Azure) can ship the pipeline + dashboard even if the AI model is still being developed.



---



\## 1) Storage layout (Blob)



We standardize blob paths so automation + dashboard queries are stable.



\### Containers

\- \*\*logs\*\*: raw uploads (input)

\- \*\*results\*\*: scored outputs + summaries (output)

\- \*\*models\*\* (optional): trained model artifacts



\### Blob path conventions

\*\*Input\*\*

\- `logs/raw/<upload\_id>.csv`



\*\*Output\*\*

\- `results/scored/<upload\_id>.csv`

\- `results/summary/<upload\_id>.json`



> `upload\_id` is the filename (without extension) generated at upload time (UUID recommended).



---



\## 2) Input format (what Azure gives AI)



\### File format

\- CSV with a header row

\- UTF-8 encoding recommended



\### Required minimum columns (v0.1)

The scorer must handle at least these (names are case-insensitive; Azure will normalize to lower snake\_case):



\- `ts` (timestamp; integer epoch seconds OR ISO8601 string)

\- `user` (string)

\- `action` (string)



\### Optional columns (if present, keep them)

\- `src\_ip` or `ip`

\- `host`, `src\_host`, `dest\_host`

\- `status` (e.g., SUCCESS/FAIL)

\- any other dataset/vendor-specific fields



\### Timestamp rules

\- If `ts` is numeric: interpret as epoch seconds

\- If `ts` is string: parse as ISO8601

\- If parsing fails: AI should still return output rows and set `is\_anomaly=0` and optionally `reason="invalid\_ts"`



---



\## 3) Output format (what AI returns)



\### 3.1 Scored CSV

Blob: `results/scored/<upload\_id>.csv`



This must include:

\- all original columns (at least `ts`, `user`, `action`)

\- plus the required scoring columns below.



\*\*Required scoring columns\*\*



| Column | Type | Meaning |

|---|---:|---|

| `anomaly\_score` | float | Higher means “more anomalous”. |

| `is\_anomaly` | int | 1 = anomaly, 0 = normal. |

| `model\_version` | string | e.g., `iforest-v1` |

| `scored\_at` | string | ISO8601 UTC timestamp |



\*\*Optional (nice-to-have)\*\*

\- `reason` (short string)

\- `top\_features` (stringified list)

\- `confidence` (float)



\### 3.2 Summary JSON

Blob: `results/summary/<upload\_id>\_



