variable "subscription_id_students" {
  sensitive   = true
  type        = string
  description = "The subscription ID for the students' Azure environment"
}

variable "tenant_id_students" {
  sensitive   = true
  type        = string
  description = "The tenant ID for the students' Azure environment"
}