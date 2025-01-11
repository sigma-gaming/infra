
output "talosconfig" {
  value     = data.talos_client_configuration.talosconfig.talos_config
  sensitive = true
}

output "kubeconfig" {
  value     = talos_cluster_kubeconfig.kubeconfig.kubeconfig_raw
  sensitive = true
}

output "cluster_ip" {
  value = digitalocean_loadbalancer.talos_lb.ip
}

output "control_plane_ips" {
  value = digitalocean_droplet.talos_control_plane[*].ipv4_address
}

output "production_application_ips" {
  value = digitalocean_droplet.talos_application_workers_production[*].ipv4_address
}
