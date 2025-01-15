terraform {
  backend "gcs" {
    prefix = "flux"
  }

  required_providers {
    github = {
      source  = "integrations/github"
      version = "6.4.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.35.1"
    }

    flux = {
      source  = "fluxcd/flux"
      version = "1.4.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
  }
}

provider "github" {
  owner = var.github_organization
  token = var.github_token
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.kubernetes_config_context
}

provider "flux" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
  git = {
    url = "https://github.com/${var.github_organization}/${var.github_repository}"
    http = {
      username = "terraform"
      password = var.github_token
    }
  }
}
