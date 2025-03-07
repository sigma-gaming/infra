terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.35.1"
    }
    github = {
      source  = "integrations/github"
      version = "6.4.0"
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
