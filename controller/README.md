# QA platform v2 controller

This Cloud Run service turns trusted GitHub `workflow_job` events into one-job
Compute Engine runners. GitHub remains the job queue. Firestore stores a small
controller state machine and caps active VMs at two.

`GET /readyz` is the public readiness probe. GitHub sends signed events to
`POST /github`; unsigned requests receive `401`.

## Lifecycle

1. GitHub sends a signed `workflow_job.queued` event to `/github`.
2. The controller checks the organization ID, repository ID, branch, labels,
   installation ID, and HMAC signature.
3. The webhook creates an authenticated Cloud Task whose name is derived from
   the GitHub delivery ID. Duplicate deliveries do not create duplicate work.
4. The task endpoint records the job and reserves one of two slots in Firestore.
5. A narrowly scoped GitHub App installation token requests an organization JIT
   runner configuration for runner group `qa-platform-v2`.
6. The JIT configuration is stored in a unique Secret Manager secret. Only the
   disposable runner service account can read it.
7. The controller creates an `e2-standard-2` VM. Its commit-pinned bootstrap reads that
   one secret, starts the pinned runner with `--jitconfig`, and runs one job.
8. GitHub sends `workflow_job.completed`. A task releases the slot,
   deletes any remaining VM and JIT secret, then starts the oldest pending job.
9. Cloud Scheduler calls `/reconcile` with Google OIDC every five minutes to
   recover leases older than 55 minutes.

Cloud Tasks retries transient provisioning and cleanup failures. Compute Engine
also deletes each VM after 45 minutes. The runner shuts itself
down after its one job. These independent cleanup paths make leaked capacity
less likely.

For a supervised demonstration, set `PRESERVE_RUNNERS=true`. Completed VMs then
stop and remain visible, and their one-use JIT secret containers remain for
inspection. Return this setting to `false` before treating the lab as an
unattended platform.

## GitHub App permissions

Install the app only on the three team repositories. Give it:

- Repository permission: **Actions: read** (receive `workflow_job` events)
- Organization permission: **Self-hosted runners: read and write** (generate
  JIT configuration)
- Subscribe to the **Workflow job** event

The private key and webhook secret belong in Secret Manager. Never commit them
or place them in VM metadata.

The `/tasks` and `/reconcile` routes require Google OIDC tokens from their
dedicated service accounts. Runner bootstrap and diagnostic logs are written to
Cloud Logging under `qa-v2-runner`.

## Local checks

```bash
npm ci
npm test
docker build -t qa-platform-v2-controller .
```

Terraform in `../infra-v2` creates the runtime identities, Firestore database,
controller secrets, Cloud Run service, and scheduled reconciler. App secrets
must receive values after the GitHub App is created.
