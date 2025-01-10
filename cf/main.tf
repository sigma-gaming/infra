data "http" "application_zones" {
  for_each = toset(var.application_domains)

  url = "https://api.cloudflare.com/client/v4/zones?name=${each.key}"

  request_headers = {
    "Authorization" = "Bearer ${var.cloudflare_api_token}"
  }
}

resource "cloudflare_record" "application_dns_record" {
  for_each = data.http.application_zones

  zone_id = jsondecode(each.value.response_body)["result"][0]["id"]
  name    = jsondecode(each.value.response_body)["result"][0]["name"]
  type    = "A"
  content = var.application_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_record" "application_dns_record_wildcard" {
  for_each = data.http.application_zones

  zone_id = jsondecode(each.value.response_body)["result"][0]["id"]
  name    = "*.${jsondecode(each.value.response_body)["result"][0]["name"]}"
  type    = "A"
  content = var.application_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_zone_settings_override" "application_settings_override" {
  for_each = data.http.application_zones

  zone_id = jsondecode(each.value.response_body)["result"][0]["id"]

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    ssl                      = "strict"
  }
}

data "curl2" "get_application_ech" {
  for_each = data.http.application_zones

  http_method = "GET"
  uri         = "https://api.cloudflare.com/client/v4/zones/${jsondecode(each.value.response_body)["result"][0]["id"]}/settings/ech"

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token
}

locals {
  domains_to_update = {
    for key, value in data.curl2.get_application_ech :
    key => jsondecode(value.response.body)["result"]["value"]
    if jsondecode(value.response.body)["result"]["value"] != var.application_enable_ech
  }
}

resource "random_id" "trigger" {
  byte_length = 8

  keepers = {
    timestamp = timestamp()
  }
}

data "curl2" "manage_application_ech" {
  for_each = local.domains_to_update

  http_method = "PATCH"
  uri         = "https://api.cloudflare.com/client/v4/zones/${jsondecode(data.http.application_zones[each.key].response_body)["result"][0]["id"]}/settings/ech"

  json = jsonencode({
    value = var.application_enable_ech
  })

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token

  headers = {
    # Force the request to be executed after apply
    "X-Random" = random_id.trigger.b64_std
  }

  lifecycle {
    postcondition {
      condition     = self.response.status_code == 200
      error_message = "Failed to update ECH settings"
    }
  }
}
