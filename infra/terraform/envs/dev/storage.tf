resource "azurerm_storage_account" "sa" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  allow_nested_items_to_be_public = false
}

resource "azurerm_storage_container" "logs" {
  name                  = "logs"
  storage_account_name  = azurerm_storage_account.sa.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "results" {
  name                  = "results"
  storage_account_name  = azurerm_storage_account.sa.name
  container_access_type = "private"
}

# "Folders" under results are blob prefixes.
# These placeholder blobs make the prefixes visible.
resource "azurerm_storage_blob" "results_scored_keep" {
  name                   = "scored/.keep"
  storage_account_name   = azurerm_storage_account.sa.name
  storage_container_name = azurerm_storage_container.results.name
  type                   = "Block"
  source_content         = "keep"
}

resource "azurerm_storage_blob" "results_summary_keep" {
  name                   = "summary/.keep"
  storage_account_name   = azurerm_storage_account.sa.name
  storage_container_name = azurerm_storage_container.results.name
  type                   = "Block"
  source_content         = "keep"
}
