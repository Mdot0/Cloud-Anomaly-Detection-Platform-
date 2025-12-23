import csv
import io
import json
from datetime import datetime, timezone
import logging
import os
import uuid
import azure.functions as func

app = func.FunctionApp()
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@app.function_name(name="ping")
@app.route(route="ping", auth_level=func.AuthLevel.ANONYMOUS)
def ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("YES: function_app.py is running in Azure")


@app.function_name(name="upload_logs")
@app.route(route="upload-logs", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def upload_logs(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("upload_logs function triggered.")

    # Import inside the function so indexing is safe
    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        logging.exception("azure-storage-blob is not installed")
        return func.HttpResponse(
            "Server misconfigured: azure-storage-blob not installed.",
            status_code=500,
        )

    # Show exactly what storage account we are using
    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return func.HttpResponse(
            "Missing AzureWebJobsStorage in app settings.",
            status_code=500,
        )

    account_name = None
    for part in conn_str.split(";"):
        if part.startswith("AccountName="):
            account_name = part.split("=", 1)[1]
            break

    try:
        # Expecting multipart/form-data with key "file"
        file = req.files.get("file")
        if not file:
            return func.HttpResponse(
                "No file uploaded. Send as form-data with key 'file'.",
                status_code=400,
            )

        blob_service = BlobServiceClient.from_connection_string(conn_str)

        container_name = "logs"
        container_client = blob_service.get_container_client(container_name)

        # Create container if it doesn't exist
        try:
            container_client.create_container()
        except Exception:
            # already exists / ignore
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


        msg_lines = [
            "Uploaded successfully.",
            f"UploadId: {upload_id}",
            f"Storage account: {account_name}",
            f"Container: {container_name}",
            f"Blob: {blob_name}",
            f"OriginalFilename: {original_filename}",
        ]

        return func.HttpResponse("\n".join(msg_lines), status_code=200, mimetype="text/plain")

    except Exception as e:
        logging.exception("Error in upload_logs")
        return func.HttpResponse(
            f"Error during upload: {str(e)}",
            status_code=500,
        )
    

@app.function_name(name="list_uploads")
@app.route(route="uploads", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def list_uploads(req: func.HttpRequest) -> func.HttpResponse:
    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return func.HttpResponse("azure-storage-blob not installed.", status_code=500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return func.HttpResponse("Missing AzureWebJobsStorage in app settings.", status_code=500)

    limit = int(req.params.get("limit", "50"))
    container_name = "logs"

    blob_service = BlobServiceClient.from_connection_string(conn_str)
    container_client = blob_service.get_container_client(container_name)

    # Include metadata so we can show original filenames
    blobs = container_client.list_blobs(include=["metadata"])

    items = []
    for b in blobs:
        items.append({
            "blob": b.name,
            "size": getattr(b, "size", None),
            "last_modified": b.last_modified.isoformat() if getattr(b, "last_modified", None) else None,
            "original_filename": (b.metadata or {}).get("original_filename"),
            "uploaded_at": (b.metadata or {}).get("uploaded_at"),
        })
        if len(items) >= limit:
            break

    return func.HttpResponse(
        json.dumps({"count": len(items), "items": items}),
        mimetype="application/json",
        status_code=200,
    )




@app.function_name(name="analyze_upload")
@app.route(route="analyze", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def analyze_upload(req: func.HttpRequest) -> func.HttpResponse:
    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return func.HttpResponse("azure-storage-blob not installed.", status_code=500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return func.HttpResponse("Missing AzureWebJobsStorage in app settings.", status_code=500)

    upload_id = req.params.get("upload_id")
    if not upload_id:
        return func.HttpResponse("Missing query param: upload_id", status_code=400)

    logs_container = "logs"
    results_container = "results"

    input_blob = upload_id if upload_id.endswith(".csv") else f"{upload_id}.csv"
    scored_blob = f"scored/{upload_id}.csv"
    summary_blob = f"summary/{upload_id}.json"

    blob_service = BlobServiceClient.from_connection_string(conn_str)
    logs_client = blob_service.get_container_client(logs_container)
    results_client = blob_service.get_container_client(results_container)

    # Create results container if missing
    try:
        results_client.create_container()
    except Exception:
        pass

    # Download the uploaded CSV
    in_blob_client = logs_client.get_blob_client(input_blob)
    props = in_blob_client.get_blob_properties()
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

    # Upload scored CSV
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
        overwrite=True
    )

    return func.HttpResponse(
        json.dumps(summary),
        mimetype="application/json",
        status_code=200,
    )




@app.function_name(name="get_results")
@app.route(route="results", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_results(req: func.HttpRequest) -> func.HttpResponse:
    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        return func.HttpResponse("azure-storage-blob not installed.", status_code=500)

    conn_str = os.environ.get("AzureWebJobsStorage")
    if not conn_str:
        return func.HttpResponse("Missing AzureWebJobsStorage in app settings.", status_code=500)

    upload_id = req.params.get("upload_id")
    if not upload_id:
        return func.HttpResponse("Missing query param: upload_id", status_code=400)

    limit = int(req.params.get("limit", "200"))

    results_container = "results"
    scored_blob = f"scored/{upload_id}.csv"
    summary_blob = f"summary/{upload_id}.json"

    blob_service = BlobServiceClient.from_connection_string(conn_str)
    results_client = blob_service.get_container_client(results_container)

    summary_bytes = results_client.get_blob_client(summary_blob).download_blob().readall()
    scored_bytes = results_client.get_blob_client(scored_blob).download_blob().readall()

    summary = json.loads(summary_bytes.decode("utf-8"))
    text = scored_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    rows = []
    for i, row in enumerate(reader):
        if i >= limit:
            break
        rows.append(row)

    return func.HttpResponse(
        json.dumps({"summary": summary, "rows_returned": len(rows), "rows": rows}),
        mimetype="application/json",
        status_code=200,
    )
