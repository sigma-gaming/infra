variable "github_organization" {
  description = "GitHub organization"
  type        = string
  default     = ""
}

variable "github_token" {
  description = "GitHub token"
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "GitHub repository for FluxCD"
  type        = string
  default     = ""
}

variable "cluster_domain" {
  description = "Domain pointing to the kubernetes cluster"
  type        = string
  default     = ""
}

variable "cluster_name" {
  description = "Name of the kubernetes cluster"
  type        = string
  default     = ""
}
