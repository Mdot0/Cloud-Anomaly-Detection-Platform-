from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _lenient_int(default: int) -> BeforeValidator:
    """Annotated-compatible validator: fall back to `default` on a bad/missing query param
    instead of erroring. Shared by every `limit` field instead of a per-model classmethod."""

    def _coerce(v: Any) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return default

    return BeforeValidator(_coerce)


class ErrorResponse(BaseModel):
    error: str


class UploadResponse(BaseModel):
    ok: bool = True
    upload_id: str
    blob: str
    container: str
    storage_account: str | None = None
    original_filename: str
    size_bytes: int
    enqueued: bool
    enqueue_error: str | None = None
    queue_name: str = ""


class UploadItem(BaseModel):
    blob: str
    size: int | None = None
    last_modified: str | None = None
    original_filename: str | None = None
    uploaded_at: str | None = None


class UploadsResponse(BaseModel):
    count: int
    items: list[UploadItem]


class FlaggedEvent(BaseModel):
    date: str
    pc: str
    activity: str
    anomaly_score: float


class SubjectSummary(BaseModel):
    """Per-user investigative summary -- answers "was this person's behavior weird" rather than
    just "which rows are weird". See backend/ai/investigation.py:build_subject_summaries."""

    user: str
    event_count: int
    distinct_pcs: int
    new_pcs: list[str]
    off_hours_pct: float
    risk_score: float
    mean_anomaly_score: float
    flagged_events: list[FlaggedEvent]


class AnalyzeSummary(BaseModel):
    # backend/ai/scorer.py adds one mode-specific extra key beyond these (`model_file` in
    # real-model mode, `notes` in dummy-fallback mode) that isn't worth modeling explicitly --
    # `extra="allow"` keeps them intact in the response/blob JSON without hardcoding both.
    model_config = ConfigDict(extra="allow")

    upload_id: str
    rows: int
    anomalies: int
    threshold: float | None = None
    model_version: str
    scored_at: str
    input_blob: str | None = None
    output_blob: str | None = None
    original_filename: str | None = None
    subjects: list[SubjectSummary] = Field(default_factory=list)


class ResultsResponse(BaseModel):
    summary: AnalyzeSummary
    rows_returned: int
    rows: list[dict[str, str]]


class AnalyzeJobMessage(BaseModel):
    """Service Bus queue message contract shared by the producer (upload_logs) and the
    consumer (analyze_worker) -- one schema instead of two implicitly-matching dict shapes."""

    upload_id: str
    container: str = "logs"
    blob: str | None = None
    requested_at: str | None = None


class ListParams(BaseModel):
    limit: Annotated[int, _lenient_int(50)] = 50


class ResultsParams(BaseModel):
    upload_id: Annotated[str, Field(min_length=1)]
    limit: Annotated[int, _lenient_int(200)] = 200
