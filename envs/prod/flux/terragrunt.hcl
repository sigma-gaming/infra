include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "../../../modules/flux"
}

dependency "do" {
  config_path = "../do"
}

locals {
  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

inputs = merge(
  local.common.inputs,
  {
    github_repository          = "k8s"
    cluster_domain             = "sigma-k8s.app"
    cluster_name               = "main"
    k8s_host                   = dependency.do.outputs.k8s_host
    k8s_cluster_ca_certificate = dependency.do.outputs.k8s_cluster_ca_certificate
    k8s_client_certificate     = dependency.do.outputs.k8s_client_certificate
    k8s_client_key             = dependency.do.outputs.k8s_client_key
  }
)