# function_app.py
import csv
import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import azure.functions as func

app = func.FunctionApp()


# ----------------------------
# Helpers
# ----------------------------
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _allowed_origins() -> set[str]:
    """
    Comma-separated list in Azure App Settings:
      CORS_ALLOWED_ORIGINS = "http://localhost:5173,https://yourapp.azurestaticapps.net"
    """
    raw = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    origins = set()
    if raw:
        for part in raw.split(","):
            o = part.strip()
            if o:
                origins.add(o)
    # always allow local dev
    origins.add("http://localhost:5173")
    origins.add("http://127.0.0.1:5173")
    return origins


def _is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False

    if origin in _allowed_origins():
        return True

    # Optional convenience: allow any Azure Static Web Apps domain
    # (tighten later if you want)
    if origin.endswith(".azurestaticapps.net"):
        return True

    return False


def _cors_headers(req: func.HttpRequest) -> dict:
    origin = req.headers.get("origin")
    if _is_origin_allowed(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Vary": "Origin",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Max-Age": "86400",
        }
    return {}


def _json(req: func.HttpRequest, payload: dict, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status_code,
        mimetype="application/json",
        headers=_cors_headers(req),
    )


def _text(req: func.Http.HttpRequest, text: str, status_code: int = 200) -> func.HttpResponse:  # type: ignore
    return func.HttpResponse(
        text,
        status_code=status_code,
        mimetype="text/plain",
        headers=_cors_headers(req),
    )


def _preflight(req: func.HttpRequest) -> func.HttpResponse:
    # Return 204 for OPTIONS preflight
    return func.HttpResponse(status_code=204, headers=_cors_headers(req))


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

    logging.info("upload_logs function triggered.")

    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        logging.exception("azure-storage-blob is not installed")
        return _json(req, {"error": "Server misconfigured: azure-storage-blob not installed."}, 500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return _json(req, {"error": "Missing AzureWebJobsStorage in app settings."}, 500)

    account_name = None
    for part in conn_str.split(";"):
        if part.startswith("AccountName="):
            account_name = part.split("=", 1)[1]
            break

    try:
        # Expecting multipart/form-data with key "file"
        file = req.files.get("file")
        if not file:
            return _json(req, {"error": "No file uploaded. Send as form-data with key 'file'."}, 400)

        blob_service = BlobServiceClient.from_connection_string(conn_str)

        container_name = "logs"
        container_client = blob_service.get_container_client(container_name)

        # Create container if it doesn't exist
        try:
            container_client.create_container()
        except Exception:
            pass

        upload_id = str(uuid.uuid4())
        blob_name = f"{upload_id}.csv"
        blob_client = container_client.get_blob_client(blob_name)

        original_filename = getattr(file, "filename", None) or "uploaded.csv"
        data = file.stream.read()

        # Upload file contents
        blob_client.upload_blob(data, overwrite=True)

        # Store human-readable info as metadata (keys must be lowercase)
        metadata = {
            "original_filename": original_filename,
            "uploaded_at": utc_now_iso(),
        }
        blob_client.set_blob_metadata(metadata)

        return _json(
            req,
            {
                "ok": True,
                "upload_id": upload_id,
                "blob": blob_name,
                "container": container_name,
                "storage_account": account_name,
                "original_filename": original_filename,
            },
            200,
        )

    except Exception as e:
        logging.exception("Error in upload_logs")
        return _json(req, {"error": f"Error during upload: {str(e)}"}, 500)


@app.function_name(name="list_uploads")
@app.route(route="uploads", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def list_uploads(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return _json(req, {"error": "azure-storage-blob not installed."}, 500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return _json(req, {"error": "Missing AzureWebJobsStorage in app settings."}, 500)

    try:
        limit = int(req.params.get("limit", "50"))
    except ValueError:
        limit = 50

    container_name = "logs"

    try:
        blob_service = BlobServiceClient.from_connection_string(conn_str)
        container_client = blob_service.get_container_client(container_name)

        # If container doesn't exist yet, return empty list (instead of 500)
        try:
            container_client.get_container_properties()
        except Exception:
            return _json(req, {"count": 0, "items": []}, 200)

        blobs = container_client.list_blobs(include=["metadata"])

        items = []
        for b in blobs:
            items.append(
                {
                    "blob": b.name,
                    "size": getattr(b, "size", None),
                    "last_modified": b.last_modified.isoformat() if getattr(b, "last_modified", None) else None,
                    "original_filename": (b.metadata or {}).get("original_filename"),
                    "uploaded_at": (b.metadata or {}).get("uploaded_at"),
                }
            )
            if len(items) >= limit:
                break

        return _json(req, {"count": len(items), "items": items}, 200)

    except Exception as e:
        logging.exception("Error in list_uploads")
        return _json(req, {"error": str(e)}, 500)


@app.function_name(name="analyze_upload")
@app.route(route="analyze", methods=["POST", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def analyze_upload(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return _json(req, {"error": "azure-storage-blob not installed."}, 500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return _json(req, {"error": "Missing AzureWebJobsStorage in app settings."}, 500)

    upload_id = req.params.get("upload_id")
    if not upload_id:
        return _json(req, {"error": "Missing query param: upload_id"}, 400)

    logs_container = "logs"
    results_container = "results"

    input_blob = upload_id if upload_id.endswith(".csv") else f"{upload_id}.csv"
    scored_blob = f"scored/{upload_id}.csv"
    summary_blob = f"summary/{upload_id}.json"

    try:
        blob_service = BlobServiceClient.from_connection_string(conn_str)
        logs_client = blob_service.get_container_client(logs_container)
        results_client = blob_service.get_container_client(results_container)

        try:
            results_client.create_container()
        except Exception:
            pass

        # Download the uploaded CSV
        in_blob_client = logs_client.get_blob_client(input_blob)
        try:
            props = in_blob_client.get_blob_properties()
        except Exception:
            return _json(req, {"error": f"Upload not found: {input_blob}"}, 404)

        meta = props.metadata or {}
        original_filename = meta.get("original_filename")

        raw = in_blob_client.download_blob().readall()

        # Dummy “scoring”: add required columns to each row
        text = raw.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []

        required_cols = ["anomaly_score", "is_anomaly", "model_version", "scored_at"]
        for c in required_cols:
            if c not in fieldnames:
                fieldnames.append(c)

        scored_at = utc_now_iso()
        model_version = "dummy-v0"

        out_buf = io.StringIO()
        writer = csv.DictWriter(out_buf, fieldnames=fieldnames)
        writer.writeheader()

        rows = 0
        anomalies = 0
        for row in reader:
            row["anomaly_score"] = "0.0"
            row["is_anomaly"] = "0"
            row["model_version"] = model_version
            row["scored_at"] = scored_at
            writer.writerow(row)
            rows += 1

        scored_bytes = out_buf.getvalue().encode("utf-8")

        results_client.get_blob_client(scored_blob).upload_blob(scored_bytes, overwrite=True)

        summary = {
            "upload_id": upload_id,
            "input_blob": f"{logs_container}/{input_blob}",
            "output_blob": f"{results_container}/{scored_blob}",
            "rows": rows,
            "anomalies": anomalies,
            "threshold": "none (dummy)",
            "model_version": model_version,
            "scored_at": scored_at,
            "original_filename": original_filename,
        }

        results_client.get_blob_client(summary_blob).upload_blob(
            json.dumps(summary).encode("utf-8"),
            overwrite=True,
        )

        return _json(req, summary, 200)

    except Exception as e:
        logging.exception("Error in analyze_upload")
        return _json(req, {"error": str(e)}, 500)


@app.function_name(name="get_results")
@app.route(route="results", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def get_results(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight(req)

    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return _json(req, {"error": "azure-storage-blob not installed."}, 500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return _json(req, {"error": "Missing AzureWebJobsStorage in app settings."}, 500)

    upload_id = req.params.get("upload_id")
    if not upload_id:
        return _json(req, {"error": "Missing query param: upload_id"}, 400)

    try:
        limit = int(req.params.get("limit", "200"))
    except ValueError:
        limit = 200

    results_container = "results"
    scored_blob = f"scored/{upload_id}.csv"
    summary_blob = f"summary/{upload_id}.json"

    try:
        blob_service = BlobServiceClient.from_connection_string(conn_str)
        results_client = blob_service.get_container_client(results_container)

        try:
            summary_bytes = results_client.get_blob_client(summary_blob).download_blob().readall()
            scored_bytes = results_client.get_blob_client(scored_blob).download_blob().readall()
        except Exception:
            return _json(req, {"error": "Results not found. Run /api/analyze first."}, 404)

        summary = json.loads(summary_bytes.decode("utf-8"))
        text = scored_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))

        rows = []
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append(row)

        return _json(req, {"summary": summary, "rows_returned": len(rows), "rows": rows}, 200)

    except Exception as e:
        logging.exception("Error in get_results")
        return _json(req, {"error": str(e)}, 500)
