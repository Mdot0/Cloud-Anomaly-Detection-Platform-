POST /upload-logs

Same — upload CSV.

POST /run-anomaly-detection

Updated response schema:

{
  "entries_analyzed": 84984,
  "anomalies_found": 221,
  "anomalies": [
    {
      "id": "{NZF8-B4QJ42SF-8977DOEA}",
      "user": "DTAA/CLN0999",
      "pc": "PC-4337",
      "activity": "Logon",
      "timestamp": "2010-02-02T23:58:56",
      "anomaly_score": 0.97,
      "reason": "Rare user-PC combination"
    }
  ]
}

GET /anomalies

Return list of most recent anomaly records.

GET /schema

Return the 5-field log schema.