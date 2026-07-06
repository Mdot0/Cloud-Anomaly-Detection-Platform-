# One-time bootstrap package only, so the Function App isn't empty right after `terraform
# apply`. Deliberately zips bootstrap/ (a static placeholder), never backend/ — real code is
# deployed on every push by .github/workflows/deploy-backend.yml. If this zipped the live
# backend/ source instead, an unrelated `terraform apply` later could re-deploy stale code over
# whatever GitHub Actions had already shipped.
data "archive_file" "function_bootstrap" {
  type        = "zip"
  source_dir  = "${path.module}/bootstrap"
  output_path = "${path.module}/.terraform-bootstrap/function-bootstrap.zip"
}

resource "azurerm_linux_function_app" "upload" {
  name                = "${local.app_name}-upload"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
  location            = "Central US"
  service_plan_id     = azurerm_service_plan.cloudguard_plan.id

  storage_account_access_key = azurerm_storage_account.cloudguardblob.primary_access_key
  storage_account_name       = azurerm_storage_account.cloudguardblob.name

  zip_deploy_file = data.archive_file.function_bootstrap.output_path

  site_config {
    application_stack {
      python_version = "3.11"
    }
  }
  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"              = "python"
    "AzureWebJobsStorage"                   = azurerm_storage_account.cloudguardblob.primary_connection_string
    "SERVICEBUS_CONNECTION"                 = azurerm_servicebus_queue_authorization_rule.bus_auth.primary_connection_string
    "ANALYZE_QUEUE_NAME"                    = azurerm_servicebus_queue.cloudguard_queue.name
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.cloudguard_insights.connection_string
    "CORS_ALLOWED_ORIGINS"                  = "https://${azurerm_static_web_app.cloudguard_swa.default_host_name}"
  }
}
