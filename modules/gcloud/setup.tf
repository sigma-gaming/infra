terraform {
  backend "gcs" {
    prefix = "gcloud"
  }

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.35.1"
    }

    google = {
      source  = "hashicorp/google"
      version = "6.16.0"
    }
  }
}

# Configure providers

provider "google" {
  project = var.gcloud_project
  region  = var.gcloud_default_region
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.kubernetes_config_context
}
