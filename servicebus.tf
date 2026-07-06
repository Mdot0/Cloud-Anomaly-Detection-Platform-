resource "azurerm_servicebus_namespace" "cloudguard_servicebus" {
  name                = "${local.app_name}-servicebus"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
  location            = "Central US"
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "cloudguard_queue" {
  name         = "${local.app_name}-queue"
  namespace_id = azurerm_servicebus_namespace.cloudguard_servicebus.id
}

resource "azurerm_servicebus_queue_authorization_rule" "bus_auth" {
  name     = "${local.app_name}-auth"
  queue_id = azurerm_servicebus_queue.cloudguard_queue.id

  listen = true
  send   = true
  manage = false
}