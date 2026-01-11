output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "function_app_name" {
  value = azurerm_linux_function_app.func.name
}

output "function_default_hostname" {
  value = azurerm_linux_function_app.func.default_hostname
}

output "function_api_base" {
  value = "https://${azurerm_linux_function_app.func.default_hostname}/api"
}

output "storage_account_name" {
  value = azurerm_storage_account.sa.name
}

output "servicebus_namespace_name" {
  value = azurerm_servicebus_namespace.sb.name
}

output "servicebus_queue_name" {
  value = azurerm_servicebus_queue.analyze.name
}

output "static_web_app_name" {
  value = var.create_static_web_app ? azurerm_static_web_app.swa[0].name : null
}
