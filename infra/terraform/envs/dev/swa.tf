resource "azurerm_static_web_app" "swa" {
  count               = var.create_static_web_app ? 1 : 0
  name                = var.static_web_app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location

  sku_tier = "Free"
  sku_size = "Free"
}
