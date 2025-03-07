import {
  to = cloudflare_zone.cluster_zone
  id = "CF_ID_REMOVED"
}

resource "cloudflare_zone" "cluster_zone" {
  account_id = var.cloudflare_account_id

  zone = var.cluster_domain
  plan = "free"
}

resource "cloudflare_zone_settings_override" "cluster_settings_override" {
  zone_id = cloudflare_zone.cluster_zone.id

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    ssl                      = "full"
  }
}

resource "cloudflare_record" "cluster_dns_record" {
  zone_id = cloudflare_zone.cluster_zone.id
  name    = "${var.cluster_name}.${var.cluster_domain}"
  type    = "A"
  content = var.cluster_target_ip
  ttl     = 1
  proxied = false

  allow_overwrite = true
}

resource "cloudflare_record" "cluster_dns_record_webhooks" {
  zone_id = cloudflare_zone.cluster_zone.id
  name    = "${var.cluster_name}-webhooks.${var.cluster_domain}"
  type    = "A"
  content = var.cluster_target_ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

import {
  to = cloudflare_zone.application_zone["letsauth.app"]
  id = "CF_ID_REMOVED"
}

import {
  to = cloudflare_zone.application_zone["sigmacloud.app"]
  id = "CF_ID_REMOVED"
}

import {
  to = cloudflare_zone.application_zone["sigm.to"]
  id = "CF_ID_REMOVED"
}

import {
  to = cloudflare_zone.application_zone["sigma1.games"]
  id = "CF_ID_REMOVED"
}

resource "cloudflare_zone" "application_zone" {
  for_each = toset(var.application_domains)

  account_id = var.cloudflare_account_id
  zone       = each.key
  plan       = lookup(var.application_plan_map, each.key, "free")
}

resource "cloudflare_zone_settings_override" "application_settings_override" {
  for_each = cloudflare_zone.application_zone

  zone_id = each.value.id

  settings {
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    ssl                      = "strict"
    security_level           = lookup(var.application_security_level_map, each.key, "medium")
  }
}

resource "cloudflare_record" "application_dns_record" {
  for_each = {
    for item in flatten([
      for i, zone in cloudflare_zone.application_zone : [
        for ip in var.application_target_ips : {
          zone_id   = zone.id
          zone_name = zone.zone
          zone_index = i
          ip        = ip
        }
      ]
    ]) : "${item.ip}-${item.zone_index}" => item
  }

  zone_id = each.value.zone_id
  name    = each.value.zone_name
  type    = "A"
  content = each.value.ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

resource "cloudflare_record" "application_dns_record_wildcard" {
  for_each = {
    for item in flatten([
      for i, zone in cloudflare_zone.application_zone : [
        for ip in var.application_target_ips : {
          zone_id   = zone.id
          zone_name = zone.zone
          zone_index = i
          ip        = ip
        }
      ]
    ]) : "${item.ip}-${item.zone_index}" => item
  }

  zone_id = each.value.zone_id
  name    = "*.${each.value.zone_name}"
  type    = "A"
  content = each.value.ip
  ttl     = 1
  proxied = true

  allow_overwrite = true
}

data "infisical_secrets" "bypass_tokens" {
  env_slug     = var.infisical_environment
  workspace_id = var.infisical_project_id
  folder_path  = "/bypass-tokens"
}

resource "cloudflare_ruleset" "application_ruleset" {
  for_each = cloudflare_zone.application_zone

  zone_id     = each.value.id
  name        = "bypass-waf"
  description = "Bypass WAF"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    enabled     = true
    description = "Bypass WAF"
    action      = "skip"
    expression  = "(any(http.request.headers[\"x-bypass-waf\"][*] eq \"${data.infisical_secrets.bypass_tokens.secrets["WAF"].value}\"))"

    action_parameters {
      phases   = ["http_ratelimit", "http_request_firewall_managed", "http_request_sbfm"]
      products = ["uaBlock", "bic", "securityLevel"]
    }

    logging {
      enabled = true
    }
  }
}

data "curl2" "manage_application_ech" {
  for_each = cloudflare_zone.application_zone

  http_method = "PATCH"
  uri         = "https://api.cloudflare.com/client/v4/zones/${each.value.id}/settings/ech"

  json = jsonencode({
    value = var.application_enable_ech
  })

  auth_type    = "Bearer"
  bearer_token = var.cloudflare_api_token

  lifecycle {
    postcondition {
      condition     = self.response.status_code == 200
      error_message = "Failed to update ECH settings"
    }
  }
}
