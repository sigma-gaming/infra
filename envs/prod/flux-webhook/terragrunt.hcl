include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

include "k8s-provider" {
  path = "../../../shared/k8s-provider.hcl"
}

terraform {
  source = "../../../modules/flux-webhook"
}

dependencies {
  paths = ["../flux"]
}

locals {
  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

inputs = merge(
  local.common.inputs,
  {
    github_repository = "k8s"
    cluster_domain    = "sigma-k8s.app"
    cluster_name      = "main"
  }
)