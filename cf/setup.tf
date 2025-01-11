terraform {
  backend "gcs" {
    prefix = "cf"
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.50.0"
    }

    curl2 = {
      source  = "mehulgohil/curl2"
      version = "1.6.1"
    }

    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
