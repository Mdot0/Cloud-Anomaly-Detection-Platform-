# function_app.py
import csv
import io
import itertools
import json
import logging
import time
import uuid
from functools import lru_cache
from typing import TYPE_CHECKING

import azure.functions as func
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from opentelemetry import metrics
from pydantic import BaseModel, ValidationError

from ai.scorer import score_csv_bytes, utc_now_iso
from config import Settings
from models import (
    AnalyzeJobMessage,
    AnalyzeSummary,
    ErrorResponse,
    ListParams,
    ResultsParams,
    ResultsResponse,
    UploadItem,
    UploadResponse,
    UploadsResponse,
)

if TYPE_CHECKING:
    from azure.storage.blob import BlobServiceClient

app = func.FunctionApp()

# ------------------------------------------------------------
# Observability (Azure Monitor + Application Insights)
# ------------------------------------------------------------
# Exports logs/traces/metrics to Application Insights using
# APPLICATIONINSIGHTS_CONNECTION_STRING from Function App settings.
if Settings.load().appinsights_connection_string:
    configure_azure_monitor()
else:
    logging.warning("Azure Monitor not configured (no APPLICATIONINSIGHTS_CONNECTION_STRING). Running local without telemetry.")

meter = metrics.get_meter("cloudguard")

uploads_count = meter.create_counter(name="cloudguard.uploads.count", description="Number of uploaded log files")
uploads_bytes = meter.create_histogram(name="cloudguard.uploads.size_bytes", description="Size of uploaded CSVs in bytes")
analysis_duration_ms = meter.create_histogram(name="cloudguard.analysis.duration_ms", description="Time spent analyzing an upload (ms)")
analysis_failures = meter.create_counter(name="cloudguard.analysis.failures", description="Number of analysis failures")


# ----------------------------
# Helpers
# ----------------------------
def log_event(event: str, **fields) -> None:
    """Structured log as a single JSON line so it can be parsed in Application Insights."""
    logging.info(json.dumps({"event": event, **fields}))


def _is_origin_allowed(origin: str | None, allowed: set[str]) -> bool:
    if not origin:
        return False
    if origin in allowed:
        return True
    # Optional convenience: allow any Azure Static Web Apps domain (tighten later if needed).
    return origin.endswith(".azurestaticapps.net")


def _cors_headers(req: func.HttpRequest) -> dict:
    origin = req.headers.get("origin")
    if not _is_origin_allowed(origin, Settings.load().allowed_origins):
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "86400",
    }


def _json(req: func.HttpRequest, payload: BaseModel, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        payload.model_dump_json(), status_code=status_code, mimetype="application/json", headers=_cors_headers(req)
    )


def _text(req: func.HttpRequest, text: str, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(text, status_code=status_code, mimetype="text/plain", headers=_cors_headers(req))


def _preflight(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(status_code=204, headers=_cors_headers(req))


def _parse_params(model_cls: type[BaseModel], req: func.HttpRequest) -> tuple[BaseModel | None, func.HttpResponse | None]:
    """Validate query params against a pydantic model. Returns (params, None) or (None, error_response)."""
    try:
        return model_cls(**dict(req.params)), None
    except ValidationError as e:
        fields = ", ".join(str(err["loc"][0]) for err in e.errors())
        return None, _json(req, ErrorResponse(error=f"Missing or invalid query param(s): {fields}"), 400)


@lru_cache(maxsize=1)
def _blob_service_client(connection_string: str) -> "BlobServiceClient":
    # Cached per worker process: Azure Functions keeps warm instances around across
    # invocations, so we want one client (and its underlying connection pool) reused
    # rather than a brand-new one constructed on every single call. Keyed by the
    # connection string itself so a changed setting still gets a fresh client.
    from azure.storage.blob import BlobServiceClient  # local import: keep the SDK optional for routes that don't need it

    return BlobServiceClient.from_connection_string(connection_string)


def _get_blob_service_client(settings: Settings) -> "BlobServiceClient":
    if not settings.storage_connection:
        raise RuntimeError("Missing AzureWebJobsStorage in app settings.")
    return _blob_service_client(settings.storage_connection)


@lru_cache(maxsize=1)
def _service_bus_client(connection_string: str) -> ServiceBusClient:
    # Same reuse rationale as _blob_service_client: keep one AMQP connection alive
    # across invocations instead of opening/closing a new one every enqueue.
    return ServiceBusClient.from_connection_string(connection_string)


def enqueue_analyze_job(settings: Settings, upload_id: str, blob: str, container: str = "logs") -> tuple[bool, str | None]:
    """
    Enqueue an analysis job to Azure Service Bus.

    Requires Function App Application Settings:
      - SERVICEBUS_CONNECTION: Service Bus connection string
      - ANALYZE_QUEUE_NAME: queue name (e.g., analyze-job)

    Returns:
      (ok, error_message)
    """
    if not settings.servicebus_connection or not settings.analyze_queue_name:
        err = "Missing SERVICEBUS_CONNECTION or ANALYZE_QUEUE_NAME"
        log_event("job_enqueue_skipped", upload_id=upload_id, reason=err)
        return False, err

    job = AnalyzeJobMessage(upload_id=upload_id, container=container, blob=blob, requested_at=utc_now_iso())

    try:
        client = _service_bus_client(settings.servicebus_connection)
        with client.get_queue_sender(settings.analyze_queue_name) as sender:
            sender.send_messages(ServiceBusMessage(job.model_dump_json()))

        log_event("job_enqueue_ok", upload_id=upload_id, queue=settings.analyze_queue_name, blob=blob, container=container)
        return True, None

    except Exception as e:
        logging.exception("Service Bus enqueue failed")
        log_event("job_enqueue_failed", upload_id=upload_id, queue=settings.analyze_queue_name, error=str(e))
        return False, str(e)


# ----------------------------
# Routes
# ----------------------------
@app.function_name(name="ping")
@app.route(route="ping", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def ping(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)
    return _text(req, "YES: function_app.py is running in Azure")


@app.function_name(name="upload_logs")
@app.route(route="upload-logs", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def upload_logs(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    settings = Settings.load()
    try:
        blob_service = _get_blob_service_client(settings)
    except (ImportError, RuntimeError) as e:
        return _json(req, ErrorResponse(error=str(e)), 500)

    upload_id: str | None = None
    try:
        # Expecting multipart/form-data with key "file"
        file = req.files.get("file")
        if not file:
            return _json(req, ErrorResponse(error="No file uploaded. Send as form-data with key 'file'."), 400)

        container_client = blob_service.get_container_client("logs")
        try:
            container_client.create_container()
        except Exception:
            pass

        upload_id = str(uuid.uuid4())
        blob_name = f"{upload_id}.csv"
        blob_client = container_client.get_blob_client(blob_name)

        original_filename = getattr(file, "filename", None) or "uploaded.csv"

        # Read the uploaded file ONCE (stream is consumed after reading)
        data = file.stream.read()
        size_bytes = len(data)

        log_event(
            "upload_received", endpoint="upload-logs", upload_id=upload_id, original_filename=original_filename, size_bytes=size_bytes
        )
        uploads_count.add(1, {"endpoint": "upload-logs"})
        uploads_bytes.record(size_bytes, {"endpoint": "upload-logs"})

        blob_client.upload_blob(data, overwrite=True)
        blob_client.set_blob_metadata({"original_filename": original_filename, "uploaded_at": utc_now_iso()})

        account_name = dict(p.split("=", 1) for p in settings.storage_connection.split(";") if "=" in p).get("AccountName")

        log_event(
            "upload_stored", endpoint="upload-logs", upload_id=upload_id, blob=blob_name, container="logs", storage_account=account_name
        )

        enq_ok, enq_err = enqueue_analyze_job(settings, upload_id=upload_id, blob=blob_name, container="logs")

        return _json(
            req,
            UploadResponse(
                upload_id=upload_id,
                blob=blob_name,
                container="logs",
                storage_account=account_name,
                original_filename=original_filename,
                size_bytes=size_bytes,
                enqueued=enq_ok,
                enqueue_error=enq_err,
                queue_name=settings.analyze_queue_name,
            ),
            200,
        )

    except Exception as e:
        logging.exception("Error in upload_logs")
        log_event("upload_failed", endpoint="upload-logs", upload_id=upload_id, error=str(e))
        return _json(req, ErrorResponse(error=f"Error during upload: {e}"), 500)


@app.function_name(name="list_uploads")
@app.route(route="uploads", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def list_uploads(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    settings = Settings.load()
    try:
        blob_service = _get_blob_service_client(settings)
    except (ImportError, RuntimeError) as e:
        return _json(req, ErrorResponse(error=str(e)), 500)

    params, err = _parse_params(ListParams, req)
    if err:
        return err

    try:
        container_client = blob_service.get_container_client("logs")

        # If container doesn't exist yet, return empty list (instead of 500)
        try:
            container_client.get_container_properties()
        except Exception:
            return _json(req, UploadsResponse(count=0, items=[]), 200)

        blobs = container_client.list_blobs(include=["metadata"])
        items = [
            UploadItem(
                blob=b.name,
                size=getattr(b, "size", None),
                last_modified=b.last_modified.isoformat() if getattr(b, "last_modified", None) else None,
                original_filename=(b.metadata or {}).get("original_filename"),
                uploaded_at=(b.metadata or {}).get("uploaded_at"),
            )
            for b in itertools.islice(blobs, params.limit)
        ]

        return _json(req, UploadsResponse(count=len(items), items=items), 200)

    except Exception as e:
        logging.exception("Error in list_uploads")
        return _json(req, ErrorResponse(error=str(e)), 500)


@app.function_name(name="get_results")
@app.route(route="results", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def get_results(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    settings = Settings.load()
    try:
        blob_service = _get_blob_service_client(settings)
    except (ImportError, RuntimeError) as e:
        return _json(req, ErrorResponse(error=str(e)), 500)

    params, err = _parse_params(ResultsParams, req)
    if err:
        return err

    results_client = blob_service.get_container_client("results")
    scored_blob = f"scored/{params.upload_id}.csv"
    summary_blob = f"summary/{params.upload_id}.json"

    try:
        summary_bytes = results_client.get_blob_client(summary_blob).download_blob().readall()
        scored_bytes = results_client.get_blob_client(scored_blob).download_blob().readall()
    except Exception:
        return _json(req, ErrorResponse(error="Results not ready yet. Analysis runs automatically after upload."), 404)

    try:
        summary = AnalyzeSummary.model_validate_json(summary_bytes)
        text = scored_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(itertools.islice(reader, params.limit))

        return _json(req, ResultsResponse(summary=summary, rows_returned=len(rows), rows=rows), 200)

    except Exception as e:
        logging.exception("Error in get_results")
        return _json(req, ErrorResponse(error=str(e)), 500)


# ============================================================
# Queue-based analysis worker (Service Bus trigger)
# ============================================================
@app.function_name(name="analyze_worker")
@app.service_bus_queue_trigger(arg_name="msg", queue_name="%ANALYZE_QUEUE_NAME%", connection="SERVICEBUS_CONNECTION")
def analyze_worker(msg: func.ServiceBusMessage) -> None:
    """
    Queue worker: consumes analyze jobs enqueued by upload_logs and produces results.
    This is the only scoring path -- there is no synchronous HTTP equivalent. The frontend
    polls GET /results until this has written scored/summary blobs for the upload.
    """
    t0 = time.time()
    settings = Settings.load()

    try:
        blob_service = _get_blob_service_client(settings)
    except (ImportError, RuntimeError):
        logging.exception("Worker misconfigured")
        return

    try:
        job = AnalyzeJobMessage.model_validate_json(msg.get_body())
    except ValidationError:
        logging.exception("Invalid Service Bus message JSON")
        raise

    input_blob = job.blob or f"{job.upload_id}.csv"
    log_event("worker_analyze_started", upload_id=job.upload_id, input_blob=f"{job.container}/{input_blob}")

    try:
        logs_client = blob_service.get_container_client(job.container)
        results_client = blob_service.get_container_client("results")

        try:
            results_client.create_container()
        except Exception:
            pass

        in_blob_client = logs_client.get_blob_client(input_blob)
        props = in_blob_client.get_blob_properties()
        original_filename = (props.metadata or {}).get("original_filename")

        raw = in_blob_client.download_blob().readall()

        # AI scoring: delegate to backend/ai/scorer.py
        scored_bytes, summary_dict = score_csv_bytes(raw, upload_id=job.upload_id)

        scored_blob = f"scored/{job.upload_id}.csv"
        summary_blob = f"summary/{job.upload_id}.json"

        results_client.get_blob_client(scored_blob).upload_blob(scored_bytes, overwrite=True)

        summary = AnalyzeSummary.model_validate(
            {
                **summary_dict,
                "upload_id": job.upload_id,
                "input_blob": f"{job.container}/{input_blob}",
                "output_blob": f"results/{scored_blob}",
                "original_filename": original_filename,
            }
        )

        results_client.get_blob_client(summary_blob).upload_blob(summary.model_dump_json().encode("utf-8"), overwrite=True)

        dt_ms = int((time.time() - t0) * 1000)
        analysis_duration_ms.record(dt_ms, {"endpoint": "worker"})
        log_event(
            "worker_analyze_complete",
            upload_id=job.upload_id,
            duration_ms=dt_ms,
            rows=summary.rows,
            anomalies=summary.anomalies,
            model_version=summary.model_version,
        )

    except Exception as e:
        logging.exception("Worker analyze failed")
        analysis_failures.add(1, {"endpoint": "worker"})
        dt_ms = int((time.time() - t0) * 1000)
        analysis_duration_ms.record(dt_ms, {"endpoint": "worker"})
        log_event("worker_analyze_failed", upload_id=job.upload_id, duration_ms=dt_ms, error=str(e))
        # Let Azure Functions handle retry/backoff; dead-letter if it keeps failing.
        raise
