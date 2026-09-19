locals {
  repository_id_csv = join(",", values(var.github_repository_ids))
}

resource "google_project_service" "controller" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "firestore.googleapis.com",
    "run.googleapis.com",
    "cloudscheduler.googleapis.com"
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "controller" {
  project       = var.project_id
  location      = var.region
  repository_id = "qa-platform-v2"
  description   = "Disposable QA runner controller images"
  format        = "DOCKER"

  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 3
    }
  }
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.controller]
}

resource "google_firestore_database" "controller" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  deletion_policy                   = "ABANDON"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"

  depends_on = [google_project_service.controller]
}

resource "google_firestore_index" "pending_jobs" {
  project    = var.project_id
  database   = google_firestore_database.controller.name
  collection = "qaRunnerJobs"
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "queuedAt"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "stale_jobs" {
  project    = var.project_id
  database   = google_firestore_database.controller.name
  collection = "qaRunnerJobs"
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "leaseAt"
    order      = "ASCENDING"
  }
}

resource "google_service_account" "controller" {
  project      = var.project_id
  account_id   = "qa-v2-controller"
  display_name = "QA v2 runner controller"
}

resource "google_service_account" "reconciler" {
  project      = var.project_id
  account_id   = "qa-v2-reconciler"
  display_name = "QA v2 scheduled reconciler"
}

resource "google_secret_manager_secret" "github_app_private_key" {
  project   = var.project_id
  secret_id = "qa-v2-github-app-private-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret" "github_webhook_secret" {
  project   = var.project_id
  secret_id = "qa-v2-github-webhook-secret"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_project_iam_custom_role" "controller" {
  project     = var.project_id
  role_id     = "qaV2RunnerController"
  title       = "QA v2 runner controller"
  description = "Creates disposable runner VMs and per-job JIT secrets."
  permissions = [
    "compute.disks.create",
    "compute.images.useReadOnly",
    "compute.instances.create",
    "compute.instances.delete",
    "compute.instances.get",
    "compute.instances.list",
    "compute.instances.setLabels",
    "compute.instances.setMetadata",
    "compute.instances.setServiceAccount",
    "compute.machineTypes.get",
    "compute.subnetworks.use",
    "compute.subnetworks.useExternalIp",
    "secretmanager.secrets.create",
    "secretmanager.secrets.delete",
    "secretmanager.secrets.get",
    "secretmanager.secrets.getIamPolicy",
    "secretmanager.secrets.setIamPolicy",
    "secretmanager.versions.add"
  ]
}

resource "google_project_iam_member" "controller_runtime" {
  project = var.project_id
  role    = google_project_iam_custom_role.controller.name
  member  = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_project_iam_member" "controller_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_service_account_iam_member" "controller_uses_runner_identity" {
  service_account_id = google_service_account.runner.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_secret_manager_secret_iam_member" "controller_app_key_reader" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.github_app_private_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_secret_manager_secret_iam_member" "controller_webhook_reader" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.github_webhook_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_cloud_run_v2_service" "controller" {
  count    = var.deploy_controller ? 1 : 0
  project  = var.project_id
  name     = "qa-v2-runner-controller"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false
  template {
    service_account                  = google_service_account.controller.email
    timeout                          = "60s"
    max_instance_request_concurrency = 10
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image = var.controller_image
      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true
      }
      dynamic "env" {
        for_each = {
          GOOGLE_CLOUD_PROJECT       = var.project_id
          RUNNER_REGION              = var.region
          RUNNER_ZONE                = "${var.region}-a"
          GITHUB_ORGANIZATION        = "testingwithekki"
          GITHUB_ORGANIZATION_ID     = var.github_owner_id
          GITHUB_REPOSITORY_IDS      = local.repository_id_csv
          GITHUB_RUNNER_GROUP_ID     = tostring(var.github_runner_group_id)
          GITHUB_APP_ID              = var.github_app_id
          RUNNER_SERVICE_ACCOUNT     = google_service_account.runner.email
          RUNNER_SUBNETWORK          = google_compute_subnetwork.runner.self_link
          MAX_RUNNERS                = "2"
          RUNNER_LABEL               = "qa-platform-v2"
          RECONCILE_AUDIENCE         = "https://qa-v2-runner-controller.internal"
          RECONCILER_SERVICE_ACCOUNT = google_service_account.reconciler.email
        }
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  lifecycle {
    precondition {
      condition     = !var.deploy_controller || (var.controller_image != null && var.github_app_id != null)
      error_message = "controller_image and github_app_id are required when deploy_controller is true."
    }
  }

  depends_on = [google_project_service.controller]
}

resource "google_cloud_run_v2_service_iam_member" "public_webhook" {
  count    = var.deploy_controller ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.controller[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_scheduler_job" "reconcile" {
  count            = var.deploy_controller ? 1 : 0
  project          = var.project_id
  region           = var.region
  name             = "qa-v2-runner-reconcile"
  description      = "Recover stale runner leases and drain pending QA jobs."
  schedule         = "*/5 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "60s"
  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.controller[0].uri}/reconcile"
    oidc_token {
      service_account_email = google_service_account.reconciler.email
      audience              = "https://qa-v2-runner-controller.internal"
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "reconciler" {
  count    = var.deploy_controller ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.controller[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.reconciler.email}"
}
