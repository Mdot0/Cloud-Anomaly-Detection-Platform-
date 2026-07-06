resource "azurerm_application_insights" "cloudguard_insights" {
  name                = "${local.app_name}-insights"
  resource_group_name = azurerm_resource_group.cloudguard_group.name
  location            = "Central US"
  application_type    = "web"

}
output "connection_string" {
  value     = azurerm_application_insights.cloudguard_insights.connection_string
  sensitive = true
}

output "app_id" {
  value = azurerm_application_insights.cloudguard_insights.app_id
}