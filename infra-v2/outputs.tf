output "wif_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Use as QA_V2_WIF_PROVIDER in the three team repositories."
}

output "report_buckets" {
  value       = { for team, bucket in google_storage_bucket.report : team => bucket.name }
  description = "Set each team's QA_V2_REPORT_BUCKET to its own bucket."
}

output "runner_service_account" {
  value       = google_service_account.runner.email
  description = "Attach this narrow service account to the disposable runner VM."
}

output "runner_subnetwork" {
  value       = google_compute_subnetwork.runner.self_link
  description = "Use this subnet for outbound-only runner VMs. It has no ingress firewall rules."
}

output "runner_registration_secret" {
  value       = google_secret_manager_secret.registration.id
  description = "Add a short-lived GitHub registration token as a secret version immediately before boot."
}
