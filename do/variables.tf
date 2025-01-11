variable "cluster_name" {
  description = "Name of cluster"
  type        = string
  default     = "talos-do"
}

variable "num_control_plane" {
  description = "Number of control plane nodes to create"
  type        = number
  default     = 1
}

variable "num_service_workers" {
  description = "Number of service worker nodes to create"
  type        = number
  default     = 1
}

variable "num_application_workers_production" {
  description = "Number of application worker nodes to create for production workloads"
  type        = number
  default     = 1
}

variable "talos_version" {
  description = "Talos version to deploy"
  type        = string
  default     = "v1.9.1"
}

variable "talos_image_url" {
  description = "Custom URL for Talos image. If not set, default URL will be used based on talos_version"
  type        = string
  default     = ""
}

variable "talos_image_id" {
  description = "DigitalOcean image ID for Talos"
  type        = string
  default     = ""
}

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  default     = ""
}

variable "do_region" {
  description = "DO region to use"
  type        = string
  default     = "ams3"
}

variable "do_plan_control_plane" {
  description = "DO plan to use for control plane nodes"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "do_plan_worker" {
  description = "DO plan to use for worker nodes"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "create_etcd_tls_secret" {
  description = "Whether to create the etcd TLS secret"
  type        = bool
  default     = false
}

variable "etcd_tls_secret_namespace" {
  description = "Namespace to create the etcd TLS secret in"
  type        = string
  default     = "kube-system"
}

locals {
  num_workers       = var.num_service_workers + var.num_application_workers_production
  default_image_url = "https://github.com/siderolabs/talos/releases/download/${var.talos_version}/digital-ocean-amd64.raw.gz"
  final_image_url   = coalesce(var.talos_image_url, local.default_image_url)
}
