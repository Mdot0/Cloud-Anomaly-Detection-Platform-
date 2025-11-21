\# Log Schema (v1) – Process Creation Logs



We only support \*\*process creation logs\*\* in CSV form.



Required columns:



\- `timestamp` (ISO 8601 string, e.g., `2025-11-20T14:32:01Z`)

\- `host` (string, machine name)

\- `user` (string, account name)

\- `parent\_process` (string, full path or exe name)

\- `process\_name` (string, full path or exe name)

\- `command\_line` (string, full original command line)



Notes:

\- File must be CSV with a header row.

\- Any missing required column → upload rejected.

\- This is what `/upload-logs` expects.



