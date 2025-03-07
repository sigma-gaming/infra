include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path = find_in_parent_folders("env.hcl")
}

terraform {
  source = "${get_repo_root()}/modules/do"
}

locals {
  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))
}

inputs = merge(
  local.common.inputs,
  {
    cluster_name   = "main"
    talos_image_id = "179820935"
    do_region      = "ams3"

    num_application_workers_production = 1
    num_service_workers                = 1
  }
)