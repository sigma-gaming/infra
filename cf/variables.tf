variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  default     = ""
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  default     = ""
}

variable "cluster_domain" {
  description = "Cluster domain"
  type        = string
  default     = "example.com"
}

variable "cluster_name" {
  description = "Cluster name"
  type        = string
  default     = "main"
}

variable "cluster_target_ip" {
  description = "Cluster target IP address"
  type        = string
  default     = ""
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

variable "application_target_ip" {
  description = "Target IP address"
  type        = string
  default     = ""
}

variable "bypass_waf_token" {
  description = "Bypass WAF token"
  type        = string
  default     = ""
}
