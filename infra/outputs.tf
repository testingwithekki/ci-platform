output "runner_name" {
  value = google_compute_instance.runner.name
}

output "runner_zone" {
  value = google_compute_instance.runner.zone
}

output "external_ip" {
  value = google_compute_instance.runner.network_interface[0].access_config[0].nat_ip
}
