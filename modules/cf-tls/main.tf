resource "tls_private_key" "application_tls_key" {
  for_each  = toset(var.application_domains)
  algorithm = "RSA"
}

resource "tls_cert_request" "application_tls_request" {
  for_each        = toset(var.application_domains)
  private_key_pem = tls_private_key.application_tls_key[each.key].private_key_pem

  subject {
    common_name  = ""
    organization = var.application_organization_map[each.key]
  }
}

resource "cloudflare_origin_ca_certificate" "application_cert" {
  for_each = toset(var.application_domains)

  csr                  = tls_cert_request.application_tls_request[each.key].cert_request_pem
  hostnames            = [each.key, "*.${each.key}"]
  requested_validity   = 5475
  request_type         = "origin-rsa"
  min_days_for_renewal = 365
}

resource "kubernetes_namespace" "application_tls_namespace" {
  metadata {
    name = "cloudflare-tls"
  }
}

resource "kubernetes_secret" "application_tls_secret" {
  for_each = toset(var.application_domains)

  metadata {
    name      = "${each.key}-cloudflare-tls"
    namespace = kubernetes_namespace.application_tls_namespace.metadata[0].name
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = cloudflare_origin_ca_certificate.application_cert[each.key].certificate
    "tls.key" = tls_private_key.application_tls_key[each.key].private_key_pem
  }
}
