resource "azurerm_resource_group" "cloudguard_group" {
  name     = "${local.app_name}-group"
  location = "Central US"
}

resource "azurerm_static_web_app" "cloudguard_swa" {
  name                = "${local.app_name}-swa"
  location            = "Central US"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
}  