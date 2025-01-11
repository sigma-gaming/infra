data "curl2" "cluster_zone" {
  http_method = "GET"
  uri         = "https://api.cloudflare.com/client/v4/zones?name=${var.cluster_domain}"

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token
}

resource "cloudflare_record" "cluster_dns_record" {
  zone_id = jsondecode(data.curl2.cluster_zone.response.body)["result"][0]["id"]
  name    = "${var.cluster_name}.${var.cluster_domain}"
  type    = "A"
  content = var.cluster_target_ip
  ttl     = 1
  proxied = false

  allow_overwrite = true
}

resource "cloudflare_record" "cluster_dns_record_webhooks" {
  zone_id = jsondecode(data.curl2.cluster_zone.response.body)["result"][0]["id"]
  name    = "${var.cluster_name}-webhooks.${var.cluster_domain}"
  type    = "A"
  content = var.cluster_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_zone_settings_override" "cluster_settings_override" {
  zone_id = jsondecode(data.curl2.cluster_zone.response.body)["result"][0]["id"]

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    ssl                      = "full"
  }
}

data "curl2" "application_zones" {
  for_each = toset(var.application_domains)

  http_method = "GET"
  uri         = "https://api.cloudflare.com/client/v4/zones?name=${each.key}"

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token
}

resource "cloudflare_record" "application_dns_record" {
  for_each = data.curl2.application_zones

  zone_id = jsondecode(each.value.response.body)["result"][0]["id"]
  name    = jsondecode(each.value.response.body)["result"][0]["name"]
  type    = "A"
  content = var.application_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_record" "application_dns_record_wildcard" {
  for_each = data.curl2.application_zones

  zone_id = jsondecode(each.value.response.body)["result"][0]["id"]
  name    = "*.${jsondecode(each.value.response.body)["result"][0]["name"]}"
  type    = "A"
  content = var.application_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_zone_settings_override" "application_settings_override" {
  for_each = data.curl2.application_zones

  zone_id = jsondecode(each.value.response.body)["result"][0]["id"]

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    ssl                      = "strict"
  }
}

resource "cloudflare_ruleset" "application_ruleset" {
  for_each = var.bypass_waf_token != "" ? data.curl2.application_zones : {}

  zone_id     = jsondecode(each.value.response.body)["result"][0]["id"]
  name        = "bypass-waf"
  description = "Bypass WAF"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    enabled     = true
    description = "Bypass WAF"
    action      = "skip"
    expression  = "(any(http.request.headers[\"x-bypass-waf\"][*] eq \"${var.bypass_waf_token}\"))"

    action_parameters {
      phases   = ["http_ratelimit", "http_request_firewall_managed", "http_request_sbfm"]
      products = ["uaBlock", "bic", "securityLevel"]
    }

    logging {
      enabled = true
    }
  }
}

data "curl2" "get_application_ech" {
  for_each = data.curl2.application_zones

  http_method = "GET"
  uri         = "https://api.cloudflare.com/client/v4/zones/${jsondecode(each.value.response.body)["result"][0]["id"]}/settings/ech"

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
  uri         = "https://api.cloudflare.com/client/v4/zones/${jsondecode(data.curl2.application_zones[each.key].response.body)["result"][0]["id"]}/settings/ech"

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
