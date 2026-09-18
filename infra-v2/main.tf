data "google_project" "lab" {
  project_id = var.project_id
}

resource "google_project_service" "iam" {
  project            = var.project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  project            = var.project_id
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sts" {
  project            = var.project_id
  service            = "sts.googleapis.com"
  disable_on_destroy = false
}

resource "google_storage_bucket" "report" {
  for_each                    = var.github_repository_ids
  name                        = "${var.project_id}-qa-${each.key}"
  project                     = var.project_id
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30
    }
  }

  depends_on = [google_project_service.storage]
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "qa-platform-github"
  display_name              = "QA platform GitHub jobs"
  depends_on                = [google_project_service.iam, google_project_service.sts]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"
  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
  }
  attribute_condition = <<-EOT
    assertion.repository_owner_id == "${var.github_owner_id}" &&
    assertion.repository_id in [${join(", ", [for id in values(var.github_repository_ids) : format("\"%s\"", id)])}] &&
    assertion.ref == "refs/heads/main" &&
    assertion.job_workflow_ref == "testingwithekki/ci-platform/.github/workflows/playwright-v2.yml@refs/heads/main"
  EOT
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_storage_bucket_iam_member" "report_writer" {
  for_each = var.github_repository_ids
  bucket   = google_storage_bucket.report[each.key].name
  role     = "roles/storage.objectCreator"
  member   = "principalSet://iam.googleapis.com/projects/${data.google_project.lab.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository_id/${each.value}"
}
