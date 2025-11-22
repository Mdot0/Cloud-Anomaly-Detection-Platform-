import logging
import os
import uuid

import azure.functions as func
from azure.storage.blob import BlobServiceClient

# This is the new Functions v2 programming model
app = func.FunctionApp()

@app.function_name(name="upload_logs")
@app.route(route="upload-logs", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def upload_logs(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("upload_logs function triggered.")

    # Expecting a CSV file sent as multipart/form-data with key "file"
    try:
        # For local testing with tools like Postman, Insomnia, or curl
        file = req.files.get("file")

        if not file:
            return func.HttpResponse(
                "No file uploaded. Send as form-data with key 'file'.",
                status_code=400
            )

        # Get connection string from environment (local.settings.json / Azure config)
        conn_str = os.environ.get("STORAGE_CONNECTION_STRING")
        if not conn_str:
            return func.HttpResponse(
                "Missing STORAGE_CONNECTION_STRING in app settings.",
                status_code=500
            )

        blob_service = BlobServiceClient.from_connection_string(conn_str)
        container_client = blob_service.get_container_client("logs")

        # Generate a unique blob name (you can change this later)
        blob_name = f"{uuid.uuid4()}.csv"
        blob_client = container_client.get_blob_client(blob_name)

        # Upload the file contents
        blob_client.upload_blob(file.stream.read(), overwrite=True)

        return func.HttpResponse(
            f"Uploaded successfully as blob: {blob_name}",
            status_code=200
        )

    except Exception as e:
        logging.exception("Error in upload_logs")
        return func.HttpResponse(
            f"Error during upload: {str(e)}",
            status_code=500
        )
