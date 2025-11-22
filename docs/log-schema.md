# Log Schema (CERT v6 - Logon Dataset)

| Field     | Type   | Description                                       |
|-----------|--------|---------------------------------------------------|
| id        | string | Unique logon event identifier                     |
| date      | string | Timestamp of the event (MM/DD/YYYY HH:MM:SS)      |
| user      | string | Username in DOMAIN/USER format                    |
| pc        | string | Machine/workstation identifier                    |
| activity  | string | Type of event: Logon or Logoff                    |