variable "project_id" {
  description = "Dedicated, already-created Google Cloud project ID."
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
