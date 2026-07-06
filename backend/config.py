from __future__ import annotations

import os

from pydantic import BaseModel


class Settings(BaseModel):
    """App settings, loaded once per invocation from the Function App's environment."""

    storage_connection: str = ""
    servicebus_connection: str = ""
    analyze_queue_name: str = ""
    appinsights_connection_string: str = ""
    cors_allowed_origins_raw: str = ""

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            storage_connection=os.environ.get("AzureWebJobsStorage", ""),
            servicebus_connection=os.environ.get("SERVICEBUS_CONNECTION", ""),
            analyze_queue_name=os.environ.get("ANALYZE_QUEUE_NAME", ""),
            appinsights_connection_string=os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING", ""),
            cors_allowed_origins_raw=os.environ.get("CORS_ALLOWED_ORIGINS", ""),
        )

    @property
    def allowed_origins(self) -> set[str]:
        """
        Comma-separated list in Azure App Settings:
          CORS_ALLOWED_ORIGINS = "http://localhost:5173,https://yourapp.azurestaticapps.net"
        """
        origins = {o.strip() for o in self.cors_allowed_origins_raw.split(",") if o.strip()}
        # always allow local dev
        origins.add("http://localhost:5173")
        origins.add("http://127.0.0.1:5173")
        return origins
