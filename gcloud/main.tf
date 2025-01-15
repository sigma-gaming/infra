# 1. Create Artifact Registry repository
resource "google_artifact_registry_repository" "docker_registry" {
  location      = var.gcloud_registry_region
  repository_id = "docker"
  description   = "Docker container registry"
  format        = "DOCKER"
}

# 2. Create backup bucket with Coldline storage
resource "google_storage_bucket" "backups" {
  name          = var.gcloud_backups_bucket_name
  location      = var.gcloud_backups_bucket_region
  force_destroy = false
  storage_class = "COLDLINE"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

# 3. Create service account for Artifact Registry (read-only)
resource "google_service_account" "registry_puller" {
  account_id   = "registry-puller"
  display_name = "Service Account for pulling from Artifact Registry"
}

# Grant permissions to pull from Artifact Registry
resource "google_artifact_registry_repository_iam_member" "registry_reader" {
  location   = google_artifact_registry_repository.docker_registry.location
  repository = google_artifact_registry_repository.docker_registry.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.registry_puller.email}"
}

# 4. Create service account for backup bucket access
resource "google_service_account" "backup_account" {
  account_id   = var.gcloud_backups_account_name
  display_name = "Service Account for backup bucket access"
}

# Grant specific permissions to access backup bucket
resource "google_storage_bucket_iam_member" "backup_object_viewer" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.backup_account.email}"
}

resource "google_storage_bucket_iam_member" "backup_object_creator" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.backup_account.email}"
}

# 5. Create service account keys
resource "google_service_account_key" "registry_key" {
  service_account_id = google_service_account.registry_puller.name
}

resource "google_service_account_key" "backup_key" {
  service_account_id = google_service_account.backup_account.name
}

# Create protected namespaces
resource "kubernetes_namespace" "google_creds" {
  metadata {
    name = var.google_creds_namespace
  }
}

resource "kubernetes_namespace" "registry_creds" {
  metadata {
    name = var.registry_creds_namespace
  }

  lifecycle {
    prevent_destroy = true
  }
}

# 6. Create Kubernetes secret for backup access
resource "kubernetes_secret" "backup_credentials" {
  metadata {
    name      = var.gcloud_backups_credentials_secret_name
    namespace = kubernetes_namespace.google_creds.metadata[0].name
  }

  data = {
    key = base64decode(google_service_account_key.backup_key.private_key)
  }
}

# 7. Create Kubernetes secret and ServiceAccount for Artifact Registry access
resource "kubernetes_secret" "registry_credentials" {
  metadata {
    name      = "google-registry-creds"
    namespace = kubernetes_namespace.registry_creds.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "${var.gcloud_registry_region}-docker.pkg.dev" = {
          username = "_json_key"
          password = base64decode(google_service_account_key.registry_key.private_key)
          email    = google_service_account.registry_puller.email
          auth     = base64encode("_json_key:${base64decode(google_service_account_key.registry_key.private_key)}")
        }
      }
    })
  }
}

# Create ServiceAccount for pulling images
resource "kubernetes_service_account" "registry_puller" {
  metadata {
    name      = "google-registry-puller"
    namespace = kubernetes_namespace.registry_creds.metadata[0].name
  }

  image_pull_secret {
    name = kubernetes_secret.registry_credentials.metadata[0].name
  }
}
