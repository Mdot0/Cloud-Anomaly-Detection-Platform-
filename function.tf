# FC1 (main.tf) is a Flex Consumption plan, which requires azurerm_function_app_flex_consumption
# -- azurerm_linux_function_app is for classic Consumption/Premium/Dedicated plans and is not
# API-compatible with FC1. Flex Consumption has no zip_deploy_file equivalent; it deploys from
# the storage_container_endpoint below via the Functions deployment API, which is exactly what
# `func azure functionapp publish` in .github/workflows/deploy-backend.yml already does -- there
# is no Terraform-managed bootstrap package here, the app starts empty and CI deploys real code
# on the next push to backend/**.
resource "azurerm_function_app_flex_consumption" "upload" {
  name                = "${local.app_name}-upload"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
  location            = "Central US"
  service_plan_id     = azurerm_service_plan.cloudguard_plan.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.cloudguardblob.primary_blob_endpoint}${azurerm_storage_container.cloudguard_deployments.name}"
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.cloudguardblob.primary_access_key

  runtime_name    = "python"
  runtime_version = "3.11"

  site_config {}

  app_settings = {
    "AzureWebJobsStorage"                   = azurerm_storage_account.cloudguardblob.primary_connection_string
    "SERVICEBUS_CONNECTION"                 = azurerm_servicebus_queue_authorization_rule.bus_auth.primary_connection_string
    "ANALYZE_QUEUE_NAME"                    = azurerm_servicebus_queue.cloudguard_queue.name
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.cloudguard_insights.connection_string
    "CORS_ALLOWED_ORIGINS"                  = "https://${azurerm_static_web_app.cloudguard_swa.default_host_name}"
  }
}
