terraform {
  backend "azurerm" {
    resource_group_name  = "cloudguard-tfstate-rg"
    storage_account_name = "cloudguardtfstate"
    container_name       = "tfstate"
    key                  = "cloudguard.dev.tfstate"
  }
}