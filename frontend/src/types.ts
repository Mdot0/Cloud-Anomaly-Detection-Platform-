export type UploadItem = {
  blob: string; // "<uuid>.csv"
  size: number;
  last_modified: string;
  original_filename?: string | null;
  uploaded_at?: string | null;
};

export type UploadsResponse = {
  count: number;
  items: UploadItem[];
};

export type FlaggedEvent = {
  date: string;
  pc: string;
  activity: string;
  anomaly_score: number;
};

export type SubjectSummary = {
  user: string;
  event_count: number;
  distinct_pcs: number;
  new_pcs: string[];
  off_hours_pct: number;
  risk_score: number;
  mean_anomaly_score: number;
  flagged_events: FlaggedEvent[];
};

export type AnalyzeSummary = {
  upload_id: string;
  input_blob: string;
  output_blob: string;
  rows: number;
  anomalies: number;
  threshold: string;
  model_version: string;
  scored_at: string;
  original_filename?: string | null;
  subjects: SubjectSummary[];
};

export type ResultsResponse = {
  summary?: AnalyzeSummary;
  rows?: Record<string, any>[];
  // fallback for broken/non-json responses
  _raw?: string;
  _contentType?: string;
  _status?: number;
};
