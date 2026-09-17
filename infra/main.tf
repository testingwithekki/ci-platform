provider "google" {
  project = var.project_id
}

locals {
  region = join("-", slice(split("-", var.zone), 0, length(split("-", var.zone)) - 1))
}

resource "google_compute_network" "qa_ci" {
  name                    = "qa-ci-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "qa_ci" {
  name          = "qa-ci-subnet"
  ip_cidr_range = "10.42.0.0/24"
  region        = local.region
  network       = google_compute_network.qa_ci.id
}

resource "google_compute_firewall" "iap_ssh" {
  name          = "qa-ci-allow-iap-ssh"
  network       = google_compute_network.qa_ci.name
  direction     = "INGRESS"
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["qa-ci-runner"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_service_account" "runner" {
  account_id   = "qa-ci-runner"
  display_name = "QA CI runner (no project roles)"
}

resource "google_compute_instance" "runner" {
  name         = "qa-ci-runner"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["qa-ci-runner"]

  scheduling {
    max_run_duration {
      seconds = 21600
    }
    instance_termination_action = "STOP"
  }

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 30
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.qa_ci.id

    access_config {}
  }

  service_account {
    email  = google_service_account.runner.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }
}
