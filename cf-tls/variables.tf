variable "stand" {
  type        = string
  description = "Stand prefix for remote state bucket"
  default     = ""

  validation {
    condition     = length(var.stand) > 0
    error_message = "Stand prefix is required"
  }
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  default     = ""
}

variable "application_domains" {
  description = "Application domains"
  type        = list(string)
  default     = []
}

variable "application_organization_map" {
  description = "Organizations"
  type        = map(string)

  validation {
    condition     = length(var.application_organization_map) == length(var.application_domains) && alltrue([for domain in var.application_domains : contains(keys(var.application_organization_map), domain)])
    error_message = "The organization map must match the application domains"
  }
}
