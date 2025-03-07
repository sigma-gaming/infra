variable "kubernetes_config_context" {
  type        = string
  description = "Kubernetes config context"
  default     = ""
}

variable "external_secrets_namespace" {
  description = "Namespace for external secrets managed in terraform"
  type        = string
  default     = "external-secrets"
}

variable "infisical_production_service_token" {
  description = "Infisical production service token"
  type        = string
  default     = ""
}

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  default     = ""
}
