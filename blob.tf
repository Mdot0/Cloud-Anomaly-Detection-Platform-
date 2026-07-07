resource "azurerm_storage_account" "cloudguardblob" {
  name                     = "${local.app_name}blob"
  resource_group_name      = azurerm_resource_group.cloudguard_group.name
  location                 = "Central US"
  account_tier             = "Standard"
  account_kind             = "StorageV2"
  account_replication_type = "LRS"

  allow_nested_items_to_be_public = false
}

resource "azurerm_storage_container" "cloudguard_logs" {
  name                  = "${local.app_name}-logs"
  storage_account_id    = azurerm_storage_account.cloudguardblob.id
  container_access_type = "private"

}

resource "azurerm_storage_container" "cloudguard_results" {
  name                  = "${local.app_name}-results"
  storage_account_id    = azurerm_storage_account.cloudguardblob.id
  container_access_type = "private"
}

# Flex Consumption function apps deploy code to a dedicated storage container rather than via
# a zip_deploy_file attribute -- see function.tf.
resource "azurerm_storage_container" "cloudguard_deployments" {
  name                  = "${local.app_name}-deployments"
  storage_account_id    = azurerm_storage_account.cloudguardblob.id
  container_access_type = "private"
}