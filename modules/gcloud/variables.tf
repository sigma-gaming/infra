variable "gcloud_project" {
  description = "Google Cloud project to use"
  type        = string
  default     = ""
}

variable "gcloud_default_region" {
  description = "Default region to use for Google Cloud resources"
  type        = string
  default     = "europe-west4"
}

variable "gcloud_registry_region" {
  description = "Region to create registry in"
  type        = string
  default     = "europe-west4"
}

variable "gcloud_backups_bucket_name" {
  description = "Name of the backups bucket"
  type        = string
  default     = "backups"
}

variable "gcloud_backups_bucket_region" {
  description = "Region to create backups bucket in"
  type        = string
  default     = "europe-west4"
}

variable "gcloud_backups_account_name" {
  description = "Name of the backups account"
  type        = string
  default     = "backup-admin"
}

variable "gcloud_cleanup_account_name" {
  description = "Name of the cleanup account"
  type        = string
  default     = "cleanup-admin"
}

variable "kubernetes_config_context" {
  type        = string
  description = "Kubernetes config context"
  default     = ""
}

variable "google_creds_namespace" {
  description = "Namespace to create the rest of the google credentials in"
  type        = string
  default     = "google-creds"
}

variable "registry_creds_namespace" {
  description = "Namespace to create registry credentials in"
  type        = string
  default     = "registry-creds"
}

variable "gcloud_backups_credentials_secret_name" {
  description = "Name of the backups credentials secret"
  type        = string
  default     = "backups-creds"
}

variable "cleanup_creds_secret_name" {
  description = "Name of the cleanup credentials secret"
  type        = string
  default     = "cleanup-creds"
}
