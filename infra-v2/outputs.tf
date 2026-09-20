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

output "controller_image_repository" {
  value       = google_artifact_registry_repository.controller.name
  description = "Artifact Registry repository for immutable controller images."
}

output "github_app_secret_names" {
  value = {
    private_key = google_secret_manager_secret.github_app_private_key.secret_id
    webhook     = google_secret_manager_secret.github_webhook_secret.secret_id
  }
  description = "Empty secret containers; add values only after creating the GitHub App."
}

output "controller_url" {
  value       = var.deploy_controller ? google_cloud_run_v2_service.controller[0].uri : null
  description = "Webhook base URL after deploy_controller is enabled."
}

output "operations_metrics" {
  value = {
    controller_errors = google_logging_metric.controller_errors.name
    runner_failures   = google_logging_metric.runner_failures.name
  }
  description = "Log-based metrics used by the QA platform runbook."
}
