resource "azurerm_service_plan" "plan" {
  name                = "${var.function_app_name}-plan"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  os_type  = "Linux"
  sku_name = var.function_plan_sku # "FC1" (Flex) or "Y1" (Consumption)
}

resource "azurerm_linux_function_app" "func" {
  name                = var.function_app_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  service_plan_id = azurerm_service_plan.plan.id

  storage_account_name       = azurerm_storage_account.sa.name
  storage_account_access_key = azurerm_storage_account.sa.primary_access_key

  site_config {
    application_stack {
      python_version = "3.11"
    }

    # CORS can also be defined here; we set it via app setting too.
  }

  app_settings = {
    # Required by Azure Functions runtime:
    "FUNCTIONS_WORKER_RUNTIME" = "python"
    "AzureWebJobsStorage"      = azurerm_storage_account.sa.primary_connection_string

    # Your app expects these (from your repo):
    "SERVICEBUS_CONNECTION"    = azurerm_servicebus_namespace_authorization_rule.app.primary_connection_string
    "ANALYZE_QUEUE_NAME"       = azurerm_servicebus_queue.analyze.name
    "CORS_ALLOWED_ORIGINS"     = var.cors_allowed_origins
  }
}
