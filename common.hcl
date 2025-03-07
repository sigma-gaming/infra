inputs = {
  github_organization     = "sigma-gaming"
  gcloud_project          = "sigma-games"
  gcloud_default_region   = "europe-west4"
  gcloud_registry_region  = "europe-west4"
  infisical_project_id    = "67b7b10c-0339-426d-b45d-e129d187785c"
  cloudflare_account_id   = "CF_ID_REMOVED"
  cloudflare_api_token    = get_env("TF_VAR_cloudflare_api_token")
  do_token                = get_env("TF_VAR_do_token")
  github_token            = get_env("TF_VAR_github_token")
  infisical_client_id     = get_env("TF_VAR_infisical_client_id")
  infisical_client_secret = get_env("TF_VAR_infisical_client_secret")
}