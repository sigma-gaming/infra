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
  source = "${get_repo_root()}/modules/cf"
}

locals {
  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

inputs = merge(
  local.common.inputs,
  {
    cluster_name      = "main"
    cluster_domain    = "sigma-k8s.app"
    cluster_target_ip = dependency.do.outputs.cluster_ip

    application_domains    = ["letsauth.app", "sigma1.games", "sigmacloud.app", "sigm.to"]
    application_target_ips = dependency.do.outputs.production_application_ips
    application_enable_ech = "off"

    infisical_environment = "prod"
  }
)