terraform {
  backend "gcs" {
    prefix = "cf"
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.50.0"
    }

    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
    }

    http = {
      source  = "hashicorp/http"
      version = "3.4.5"
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
