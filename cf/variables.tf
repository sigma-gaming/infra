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
