terraform {
  required_version = "=1.15.7"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "=4.80.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "=2.7.1"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.subscription_id_students
  tenant_id       = var.tenant_id_students
}   