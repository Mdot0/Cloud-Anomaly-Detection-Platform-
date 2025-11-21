\# API Outline (Draft)



\## POST /upload-logs

\- Upload CSV log file

\- Validate schema

\- Save to Blob Storage

\- Return dataset\_id



\## POST /run-anomaly-detection

\- Input: dataset\_id

\- Load CSV

\- Call ML run\_inference()

\- Save anomalies in Table Storage

\- Return summary



\## GET /anomalies?dataset\_id=<id>

\- Return list of anomalies



\## GET /anomalies/{id}

\- Return details for one anomaly



\## GET /stats

\- Return summary counts, top hosts, severity distribution



\## POST /chat

\- Input: anomaly\_id + question

\- Output: LLM-generated explanation



