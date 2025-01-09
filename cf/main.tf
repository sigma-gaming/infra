data "http" "zones" {
  for_each = toset(var.application_domains)

  url = "https://api.cloudflare.com/client/v4/zones?name=${each.key}"

  request_headers = {
    "Authorization" = "Bearer ${var.cloudflare_api_token}"
  }
}

resource "cloudflare_zone_settings_override" "common_settings_override" {
  for_each = data.http.zones

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

# data "curl_request" "manage_ech" {
#   for_each = data.http.zones

#   uri = "https://api.cloudflare.com/client/v4/zones/${jsondecode(each.value.response_body)["result"][0]["id"]}/settings/ech"

#   http_method = "PATCH"

#   data = jsonencode({
#     value = var.application_enable_ech ? "on" : "off"
#   })

#   headers = {
#     "Authorization" = "Bearer ${var.cloudflare_api_token}"
#     "Content-Type"  = "application/json"
#   }

#   depends_on = [random_id.trigger]
# }

data "curl2" "manage_ech" {
  for_each = data.http.zones

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

# resource "restapi_object" "manage_ech" {
#   for_each      = data.http.zones
#   provider      = restapi
#   path          = "/zones/${jsondecode(data.http.zones[each.key].response_body)["result"][0]["id"]}/settings/"
#   object_id     = "ech"
#   data          = jsonencode({ value = var.application_enable_ech ? "on" : "off" })
#   create_method = "PATCH"
#   update_method = "PATCH"
#   debug         = true
# }
