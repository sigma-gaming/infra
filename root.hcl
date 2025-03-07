locals {
  path_relative_to_repo_root = path_relative_to_include()
  path_parts                 = split("/", local.path_relative_to_repo_root)
  environment                = local.path_parts[1]
  project_path_parts         = slice(local.path_parts, 1, length(local.path_parts))
  project_path               = join("/", local.project_path_parts)
}

generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  backend "gcs" {
    bucket         = "sigma-terraform-state-production"
    prefix         = "${local.project_path}"
    credentials    = "${get_repo_root()}/backend/state-gcs-key.json"
  }
}
EOF
}