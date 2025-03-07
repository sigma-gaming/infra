data "github_repository" "flux_repository" {
  name = "${var.github_organization}/${var.github_repository}"
}

resource "flux_bootstrap_git" "flux_bootstrap" {
  depends_on = [data.github_repository.flux_repository]

  path                 = "clusters/${var.cluster_name}"
  components_extra     = ["image-reflector-controller", "image-automation-controller"]
  delete_git_manifests = false
}
