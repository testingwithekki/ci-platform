# QA platform v2 operator runbook

## Find one run

Start with the GitHub run ID. Search structured Cloud Run logs for `runId` or
the workflow job ID, inspect the `qaRunnerJobs` Firestore document, then check
the matching VM name and `team/run-id/attempt/` report path.

## Job remains queued

1. Check that the job requests `self-hosted`, `linux`, `x64`, and
   `qa-platform-v2`.
2. Check the runner-group repository and workflow restrictions.
3. Check Firestore capacity and pending jobs.
4. Check the Cloud Tasks queue for retrying tasks.
5. Search controller logs for `Runner provisioning failed`.

## Capacity is stuck

1. Compare Firestore active capacity with running `qa-v2-*` VMs.
2. Invoke the authenticated reconciliation job through Cloud Scheduler.
3. Inspect stale job documents and cleanup errors.
4. Do not edit the capacity document before recording the mismatched resources.

## Runner VM failed during startup

1. Read `qa-v2-runner` entries in Cloud Logging.
2. Check whether the pinned bootstrap commit exists.
3. Verify the JIT secret exists and the runner service account can read it.
4. Check outbound access to GitHub, Debian packages, and the container registry.
5. Cloud Tasks should retry the job after the failed task returns a non-2xx status.

## Completion did not clean resources

1. Search the completion task by GitHub delivery ID.
2. Confirm the event includes `workflow_job.runner_id`.
3. Compare that runner ID with the Firestore lease.
4. Check Compute Engine and Secret Manager delete permissions.
5. Let the task retry; cleanup operations are idempotent.
6. The scheduled reconciler and 45-minute VM limit are final safeguards.

## Security response

For a suspected webhook or App-key compromise:

1. disable the GitHub App webhook;
2. rotate the webhook secret and App private key;
3. disable the prior Secret Manager versions;
4. deploy a new Cloud Run revision so warm instances reload secrets;
5. inspect webhook deliveries, Cloud Tasks, Firestore, runner registrations,
   Compute Engine audit logs, and report-bucket writes;
6. restore the webhook only after the review.
