terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "6.4.0"
    }
    flux = {
      source  = "fluxcd/flux"
      version = "1.4.0"
    }
  }
}

provider "github" {
  owner = var.github_organization
  token = var.github_token
}

provider "flux" {
  kubernetes = {
    host                   = var.k8s_host
    client_certificate     = base64decode(var.k8s_client_certificate)
    client_key             = base64decode(var.k8s_client_key)
    cluster_ca_certificate = base64decode(var.k8s_cluster_ca_certificate)
  }
  git = {
    url = "https://github.com/${var.github_organization}/${var.github_repository}"
    http = {
      username = "terraform"
      password = var.github_token
    }
  }
}
