variable "location" {
  type    = string
  default = "westus2"
}

variable "resource_group_name" {
  type    = string
  default = "cloud-guard-ai-rg"
}

variable "storage_account_name" {
  type    = string
  default = "guardstorage"
}

variable "function_app_name" {
  type    = string
  default = "cloudguard-backend-new"
}

variable "servicebus_namespace_name" {
  type    = string
  default = "analyze-jobs"
}

variable "analyze_queue_name" {
  type    = string
  default = "analyze-job"
}

variable "static_web_app_name" {
  type    = string
  default = "CloudguardApp"
}

# CORS allowed origins for your backend (comma-separated string)
# Example: "https://brave-glacier-0e362991e.6.azurestaticapps.net"
variable "cors_allowed_origins" {
  type    = string
  default = "*"
}

# Flex Consumption is newer.
# If "FC1" fails in your subscription/provider, set this to "Y1" (classic consumption).
variable "function_plan_sku" {
  type    = string
  default = "FC1"
}

# Set true if you want Terraform to create/manage your Static Web App resource.
variable "create_static_web_app" {
  type    = bool
  default = false
}

variable "subscription_id" {
  type      = string
  sensitive = true
}

