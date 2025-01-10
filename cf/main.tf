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

resource "random_id" "trigger" {
  byte_length = 8
}

data "curl2" "manage_application_ech" {
  for_each = data.http.application_zones

  uri = "https://api.cloudflare.com/client/v4/zones/${jsondecode(each.value.response_body)["result"][0]["id"]}/settings/ech"

  http_method = "PATCH"

  json = jsonencode({
    value = var.application_enable_ech ? "on" : "off"
  })

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token

  depends_on = [random_id.trigger]

  lifecycle {
    postcondition {
      condition     = self.response.status_code == 200
      error_message = "Failed to update ECH settings"
    }
  }
}
