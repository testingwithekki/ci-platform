resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_compute_network" "runner" {
  name                    = "qa-v2-runner"
  project                 = var.project_id
  auto_create_subnetworks = false

  depends_on = [google_project_service.compute]
}

resource "google_compute_subnetwork" "runner" {
  name                     = "qa-v2-runner-us-central1"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.runner.id
  ip_cidr_range            = "10.62.0.0/24"
  private_ip_google_access = true
}

resource "google_service_account" "runner" {
  project      = var.project_id
  account_id   = "qa-v2-runner"
  display_name = "QA v2 disposable runner"

  depends_on = [google_project_service.iam]
}

resource "google_secret_manager_secret" "registration" {
  project   = var.project_id
  secret_id = "qa-v2-runner-registration"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_iam_member" "runner_registration_reader" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.registration.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runner.email}"
}
