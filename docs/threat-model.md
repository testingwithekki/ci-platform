# QA platform v2 threat model

## Scope

The platform runs trusted `main` branch Playwright jobs from `team-create`,
`team-filter`, and `team-persistence`. It does not run code from forks or pull
request branches. The public repositories are a demonstration; a production
installation should use the same controls with private repositories where
appropriate.

## Trust boundaries

- GitHub signs `workflow_job` events. Cloud Run verifies the HMAC against the
  raw request body before parsing it.
- The controller checks numeric organization and repository IDs, the GitHub App
  installation, branch, and required runner labels.
- GitHub runner-group policy restricts use to the three repositories and the
  reviewed reusable workflow on `main`.
- Cloud Tasks calls the internal task endpoint with an OIDC token from a
  dedicated service account. The public webhook cannot call controller methods
  directly.
- Each VM receives a one-use JIT runner configuration through a per-job Secret
  Manager secret. No GitHub credential is stored in the image or metadata.
- GitHub OIDC and Google Workload Identity Federation give each team
  object-creator access only to its report bucket.

## Protected assets

- GitHub App private key and webhook secret
- JIT runner configurations
- Google Cloud IAM identities
- test reports, screenshots, traces, and test data
- controller capacity and job state
- runner VM and network access

## Main threats and controls

| Threat | Control |
|---|---|
| Forged webhook | HMAC verification on raw bytes |
| Replay or duplicate delivery | Cloud Task name uses GitHub delivery ID; Firestore enqueue is idempotent |
| Untrusted repository or branch | Numeric allowlist, owner check, `main` check, runner-group restrictions |
| Runner receives a second job | JIT configuration creates a one-job runner |
| Runner reads controller secrets | Separate service accounts and per-secret IAM |
| Team writes another team's reports | Repository-ID WIF condition and bucket-specific object-creator role |
| Mutable bootstrap is replaced | Bootstrap URL is pinned to a reviewed 40-character Git commit |
| Leaked runner capacity | Completion cleanup, task retries, scheduled reconciliation, 45-minute VM limit |
| Lost diagnostic evidence | GitHub job log, artifacts, GCS report archive, and runner diagnostics in Cloud Logging |
| Public ingress reaches task processing | OIDC verification for `/tasks` and `/reconcile` |

## Accepted lab risks

- Runner VMs use external IP addresses for outbound access. They have no inbound
  firewall rule. Private egress through Cloud NAT is a future cost and security
  comparison.
- The VM installs Docker and the runner during boot. A versioned golden image is
  the next latency and supply-chain improvement.
- The controller is a custom autoscaler. Larger installations should compare it
  with GitHub Actions Runner Controller or the Runner Scale Set Client.

## Security invariants

1. An unsigned or altered webhook never creates a task.
2. An unapproved repository, branch, installation, or label never creates a task.
3. A task without the expected OIDC identity never changes runner state.
4. Active capacity never exceeds `MAX_RUNNERS`.
5. A JIT configuration is readable only by the runner service account.
6. Normal mode deletes the VM and JIT secret after completion.
7. Public fork pull requests never execute on this runner group.
