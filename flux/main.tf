resource "github_repository" "flux_repository" {
  name               = var.github_repository
  description        = "FluxCD repository"
  visibility         = "private"
  auto_init          = true
  archive_on_destroy = true
}

resource "flux_bootstrap_git" "flux_bootstrap" {
  depends_on = [github_repository.flux_repository]

  path                 = "clusters/${var.cluster_name}"
  components_extra     = ["image-reflector-controller", "image-automation-controller"]
  delete_git_manifests = false
}

resource "random_id" "flux_webhook_token" {
  byte_length = 20
}

resource "kubernetes_secret" "flux_webhook_token_secret" {
  metadata {
    name      = "webhook-token"
    namespace = "flux-system"
  }

  type = "Opaque"

  data = {
    "token" = random_id.flux_webhook_token.hex
  }
}

resource "kubernetes_manifest" "flux_webhook_receiver" {
  manifest = {
    apiVersion = "notification.toolkit.fluxcd.io/v1"
    kind       = "Receiver"

    metadata = {
      name      = "flux-system"
      namespace = "flux-system"
    }

    spec = {
      type = "github"
      events = [
        "ping",
        "push"
      ]
      secretRef = {
        name = kubernetes_secret.flux_webhook_token_secret.metadata[0].name
      }
      resources = [
        {
          kind = "GitRepository"
          name = "flux-system"
        }
      ]
    }
  }
}

resource "github_repository_webhook" "flux_webhook" {
  depends_on = [kubernetes_manifest.flux_webhook_receiver]

  repository = var.github_repository
  events     = ["push"]

  configuration {
    url          = "https://${var.cluster_name}-webhooks.${var.cluster_domain}/flux/hook/${sha256(join("", [random_id.flux_webhook_token.hex, "flux-system", "flux-system"]))}"
    content_type = "form"
    secret       = random_id.flux_webhook_token.hex
  }
}
