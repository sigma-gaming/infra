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

variable "application_enable_ech" {
  description = "Enable ECH for application zones"
  type        = bool
  default     = false
}

variable "application_target_ip" {
  description = "Target IP address"
  type        = string
  default     = ""
}
