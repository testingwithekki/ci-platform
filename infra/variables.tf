variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "zone" {
  description = "Compute Engine zone, for example us-central1-a"
  type        = string
}

variable "machine_type" {
  description = "Runner VM size"
  type        = string
  default     = "e2-standard-2"
}
