resource "azurerm_servicebus_namespace" "sb" {
  name                = var.servicebus_namespace_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  # Standard is required for many queue features. Basic is limited.
  sku = "Standard"
}

resource "azurerm_servicebus_queue" "analyze" {
  name         = var.analyze_queue_name
  namespace_id = azurerm_servicebus_namespace.sb.id

  enable_partitioning = true
}

# Authorization rule that gives your Function App access to the namespace
resource "azurerm_servicebus_namespace_authorization_rule" "app" {
  name         = "cloudguard-app"
  namespace_id = azurerm_servicebus_namespace.sb.id

  listen = true
  send   = true
  manage = false
}
