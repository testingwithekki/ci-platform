variable "project_id" {
  description = "Existing Google Cloud project ID used for this lab."
  type        = string
}

variable "region" {
  description = "Location for the three report buckets."
  type        = string
  default     = "us-central1"
}

variable "github_owner_id" {
  description = "Numeric GitHub organization ID; resists organization-name reuse."
  type        = string
}

variable "github_repository_ids" {
  description = "Numeric repository IDs keyed by team name."
  type        = map(string)
  validation {
    condition     = length(var.github_repository_ids) == 3 && alltrue([for name in ["create", "filter", "persistence"] : contains(keys(var.github_repository_ids), name)])
    error_message = "Provide exactly create, filter, and persistence repository IDs."
  }
}

variable "deploy_controller" {
  description = "Create the Cloud Run controller after its container image and GitHub App are ready."
  type        = bool
  default     = false
}

variable "controller_image" {
  description = "Immutable Artifact Registry image digest for the controller."
  type        = string
  default     = null
}

variable "github_app_id" {
  description = "Public numeric ID of the installed QA runner GitHub App."
  type        = string
  default     = null
}

variable "github_runner_group_id" {
  description = "Numeric ID of the restricted qa-platform-v2 runner group."
  type        = number
  default     = 4
}

variable "preserve_runners" {
  description = "Keep completed demo VMs and JIT secrets for manual inspection. Disable for unattended use."
  type        = bool
  default     = false
}

variable "github_app_installation_id" {
  description = "Numeric installation ID for the GitHub App installed on the three team repositories."
  type        = number
  default     = null
}

variable "runner_bootstrap_ref" {
  description = "Full Git commit SHA used to download the immutable runner bootstrap."
  type        = string
  default     = null

  validation {
    condition     = var.runner_bootstrap_ref == null || can(regex("^[0-9a-f]{40}$", var.runner_bootstrap_ref))
    error_message = "runner_bootstrap_ref must be a full lowercase 40-character Git commit SHA."
  }
}
