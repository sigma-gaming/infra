variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
}

variable "cluster_domain" {
  description = "Cluster domain"
  type        = string
}

variable "cluster_name" {
  description = "Cluster name"
  type        = string
}

variable "cluster_target_ip" {
  description = "Cluster target IP address"
  type        = string
}

variable "application_domains" {
  description = "Application domains"
  type        = list(string)
  default     = []
}

variable "application_plan_map" {
  description = "Application plan map"
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for key in keys(var.application_plan_map) : contains(var.application_domains, key)])
    error_message = "The key must be a application domain"
  }
}

variable "application_security_level_map" {
  description = "Application security level map"
  type        = map(string) # medium, high, under_attack
  default     = {}

  validation {
    condition     = alltrue([for key in keys(var.application_security_level_map) : contains(var.application_domains, key)])
    error_message = "The key must be a application domain"
  }
}

variable "application_enable_ech" {
  description = "ECH value for application zones"
  type        = string
  default     = "off"
}

variable "application_target_ips" {
  description = "Target IP addresses"
  type        = list(string)
}

variable "infisical_environment" {
  description = "Infisical environment"
  type        = string
}

variable "infisical_client_id" {
  description = "Infisical client ID"
  type        = string
}

variable "infisical_client_secret" {
  description = "Infisical client secret"
  type        = string
}

variable "infisical_project_id" {
  description = "Infisical project ID"
  type        = string
}
