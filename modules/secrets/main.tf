resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = var.external_secrets_namespace
  }
}

# resource "kubernetes_secret" "etcd_tls_secret" {
#   count = var.create_etcd_tls_secret ? 1 : 0
#   metadata {
#     name      = "etcd-tls"
#     namespace = kubernetes_namespace.etcd_tls_secret[0].metadata[0].name
#   }

#   type = "kubernetes.io/tls"

#   data = {
#     "tls.crt" = base64decode(talos_machine_secrets.machine_secrets.machine_secrets.certs.etcd.cert)
#     "tls.key" = base64decode(talos_machine_secrets.machine_secrets.machine_secrets.certs.etcd.key)
#   }
# }

resource "kubernetes_secret" "digitalocean" {
  metadata {
    name      = "digitalocean"
    namespace = "kube-system"
  }

  data = {
    "access-token" = var.do_token
  }
}

resource "kubernetes_secret" "infisical_production_service_token" {
  metadata {
    name      = "infisical-production-service-token"
    namespace = var.external_secrets_namespace
  }

  data = {
    "infisicalToken" = var.infisical_production_service_token
  }
}