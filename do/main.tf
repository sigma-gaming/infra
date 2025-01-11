## Upload a custom image to DigitalOcean
# resource "digitalocean_custom_image" "talos_custom_image" {
#   name         = "talos-linux-${var.talos_version}"
#   url          = local.final_image_url
#   distribution = "Unknown"
#   regions      = ["${var.do_region}"]
# }

## Cheese the creation of an SSH key
resource "tls_private_key" "fake_ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "digitalocean_ssh_key" "fake_ssh_key" {
  name       = "${var.cluster_name}-fake-ssh-key"
  public_key = tls_private_key.fake_ssh_key.public_key_openssh
}

resource "digitalocean_tag" "talos_application_workers_tag" {
  name = "${var.cluster_name}-application-worker"
}

resource "digitalocean_tag" "talos_production_tag" {
  name = "${var.cluster_name}-production"
}

resource "digitalocean_tag" "talos_service_workers_tag" {
  name = "${var.cluster_name}-service-worker"
}

## Create all instances
resource "digitalocean_droplet" "talos_control_plane" {
  image    = var.talos_image_id
  name     = "${var.cluster_name}-control-plane-${count.index}"
  region   = var.do_region
  size     = var.do_plan_control_plane
  count    = var.num_control_plane
  ssh_keys = [digitalocean_ssh_key.fake_ssh_key.id]
}

resource "digitalocean_droplet" "talos_application_workers_production" {
  image    = var.talos_image_id
  name     = "${var.cluster_name}-application-worker-${count.index}"
  region   = var.do_region
  size     = var.do_plan_application_worker_production
  count    = var.num_application_workers_production
  ssh_keys = [digitalocean_ssh_key.fake_ssh_key.id]
  tags     = [digitalocean_tag.talos_application_workers_tag.id, digitalocean_tag.talos_production_tag.id]
}

resource "digitalocean_droplet" "talos_service_workers" {
  image    = var.talos_image_id
  name     = "${var.cluster_name}-service-worker-${count.index}"
  region   = var.do_region
  size     = var.do_plan_service_worker
  count    = var.num_service_workers
  ssh_keys = [digitalocean_ssh_key.fake_ssh_key.id]
  tags     = [digitalocean_tag.talos_service_workers_tag.id]
}

## Create a LB for control plane
resource "digitalocean_loadbalancer" "talos_lb" {
  name   = "${var.cluster_name}-k8s"
  region = var.do_region

  forwarding_rule {
    entry_port     = 6443
    entry_protocol = "tcp"

    target_port     = 6443
    target_protocol = "tcp"
  }

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 80
    target_protocol = "http"
  }

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"

    target_port     = 443
    target_protocol = "https"
    tls_passthrough = true
  }

  healthcheck {
    port     = 50000
    protocol = "tcp"
  }

  droplet_ids = digitalocean_droplet.talos_control_plane[*].id
}

## Bootstrap talos

resource "talos_machine_secrets" "machine_secrets" {}

data "talos_client_configuration" "talosconfig" {
  cluster_name         = var.cluster_name
  client_configuration = talos_machine_secrets.machine_secrets.client_configuration
  endpoints            = digitalocean_droplet.talos_control_plane[*].ipv4_address
}

data "talos_machine_configuration" "machineconfig_cp" {
  cluster_name     = var.cluster_name
  cluster_endpoint = "https://${digitalocean_loadbalancer.talos_lb.ip}:6443"
  machine_type     = "controlplane"
  machine_secrets  = talos_machine_secrets.machine_secrets.machine_secrets
  depends_on       = [digitalocean_loadbalancer.talos_lb]

  config_patches = [
    yamlencode({
      "cluster" : {
        "network" : {
          "cni" : {
            "name" : "flannel",
            "flannel" : {
              "extraArgs" : [
                "--iface=eth1"
              ]
            }
          }
        }
        "etcd" : {
          "extraArgs" : {
            "listen-metrics-urls" : "https://0.0.0.0:2379"
          }
        }
        "controllerManager" : {
          "extraArgs" : {
            "bind-address" : "0.0.0.0"
          }
        }
        "scheduler" : {
          "extraArgs" : {
            "bind-address" : "0.0.0.0"
          }
        }
      }
    })
  ]
}

resource "talos_machine_configuration_apply" "cp_config_apply" {
  client_configuration        = talos_machine_secrets.machine_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.machineconfig_cp.machine_configuration
  count                       = length(digitalocean_droplet.talos_control_plane)
  node                        = digitalocean_droplet.talos_control_plane[count.index].ipv4_address
}

data "talos_machine_configuration" "machineconfig_worker" {
  cluster_name     = var.cluster_name
  cluster_endpoint = "https://${digitalocean_loadbalancer.talos_lb.ip}:6443"
  machine_type     = "worker"
  machine_secrets  = talos_machine_secrets.machine_secrets.machine_secrets
  depends_on       = [digitalocean_loadbalancer.talos_lb]
}

resource "talos_machine_configuration_apply" "application_worker_production_config_apply" {
  client_configuration        = talos_machine_secrets.machine_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.machineconfig_worker.machine_configuration
  count                       = length(digitalocean_droplet.talos_application_workers_production)
  node                        = digitalocean_droplet.talos_application_workers_production[count.index].ipv4_address

  config_patches = [
    yamlencode({
      "machine" : {
        "nodeLabels" : {
          "role" : "application",
          "environment" : "production"
        }
      }
    })
  ]
}

resource "talos_machine_configuration_apply" "service_worker_config_apply" {
  client_configuration        = talos_machine_secrets.machine_secrets.client_configuration
  machine_configuration_input = data.talos_machine_configuration.machineconfig_worker.machine_configuration
  count                       = length(digitalocean_droplet.talos_service_workers)
  node                        = digitalocean_droplet.talos_service_workers[count.index].ipv4_address

  config_patches = [
    yamlencode({
      "machine" : {
        "nodeLabels" : {
          "role" : "service"
        }
      }
    })
  ]
}

resource "talos_machine_bootstrap" "bootstrap" {
  client_configuration = talos_machine_secrets.machine_secrets.client_configuration
  node                 = digitalocean_droplet.talos_control_plane[0].ipv4_address
}

resource "talos_cluster_kubeconfig" "kubeconfig" {
  client_configuration = talos_machine_secrets.machine_secrets.client_configuration
  node                 = digitalocean_droplet.talos_control_plane[0].ipv4_address
}

resource "kubernetes_secret" "etcd_tls_secret" {
  count = var.create_etcd_tls_secret ? 1 : 0
  metadata {
    name      = "etcd-tls"
    namespace = var.etcd_tls_secret_namespace
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = base64decode(talos_machine_secrets.machine_secrets.machine_secrets.certs.etcd.cert)
    "tls.key" = base64decode(talos_machine_secrets.machine_secrets.machine_secrets.certs.etcd.key)
  }
}
