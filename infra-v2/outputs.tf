output "wif_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Use as QA_V2_WIF_PROVIDER in the three team repositories."
}

output "report_buckets" {
  value       = { for team, bucket in google_storage_bucket.report : team => bucket.name }
  description = "Set each team's QA_V2_REPORT_BUCKET to its own bucket."
}
