locals {
  app_name = "cloudguard"
}

resource "azurerm_service_plan" "cloudguard_plan" {
  name                = "${local.app_name}-plan"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
  location            = "Central US"
  os_type             = "Linux"
  sku_name            = "FC1"
}   