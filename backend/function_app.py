import logging
import os
import uuid

import azure.functions as func

app = func.FunctionApp()


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

        blob_name = f"{uuid.uuid4()}.csv"
        blob_client = container_client.get_blob_client(blob_name)

        # Upload file contents
        blob_client.upload_blob(file.stream.read(), overwrite=True)

        msg_lines = [
            "Uploaded successfully.",
            f"Storage account: {account_name}",
            f"Container: {container_name}",
            f"Blob: {blob_name}",
        ]
        return func.HttpResponse("\n".join(msg_lines), status_code=200, mimetype="text/plain")

    except Exception as e:
        logging.exception("Error in upload_logs")
        return func.HttpResponse(
            f"Error during upload: {str(e)}",
            status_code=500,
        )
