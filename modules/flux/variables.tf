variable "k8s_host" {
  description = "The host of the kubernetes cluster"
  type        = string
}

variable "k8s_client_certificate" {
  description = "The client certificate of the kubernetes cluster"
  type        = string
}

variable "k8s_client_key" {
  description = "The client key of the kubernetes cluster"
  type        = string
}

variable "k8s_cluster_ca_certificate" {
  description = "The cluster ca certificate of the kubernetes cluster"
  type        = string
}

variable "github_organization" {
  description = "GitHub organization"
  type        = string
}

variable "github_token" {
  description = "GitHub token"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository for FluxCD"
  type        = string
}

variable "cluster_name" {
  description = "Name of the kubernetes cluster"
  type        = string
}
