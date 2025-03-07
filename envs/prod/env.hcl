generate "env" {
  path      = "env.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
locals {
  environment = "prod"
}
EOF
}