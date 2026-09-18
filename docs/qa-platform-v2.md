# QA platform v2: short-lived runners and private reports

Status: implementation in progress. The earlier single-VM experiment is complete and its VM and project were destroyed. The separate v2 workflow and report-storage Terraform files are being built beside it; live deployment and end-to-end verification are tracked separately.

## Keep v1 and v2 separate

The completed experiment remains reproducible from its existing workflow and run links. Build v2 beside it:

| Layer | Completed v1 | Proposed v2 |
| --- | --- | --- |
| Central reusable workflow | `.github/workflows/playwright.yml` | `.github/workflows/playwright-v2.yml` |
| Each team caller workflow | `.github/workflows/playwright.yml` | `.github/workflows/qa-platform-v2.yml` |
| Organization runner group and label | `qa-playwright` | `qa-platform-v2` |
| Runner machine | One persistent VM, now destroyed | One-job VMs named for the run, maximum two active |
| Google Cloud project | `testingwithekki-qa-ci-lab`, deleted | Existing `testingwithekki` project; destroy only v2 resources after the lab |
| Report storage | GitHub Actions artifact, seven days | GitHub Actions artifact plus private Cloud Storage archive |

The v1 workflows stay disabled. Start the v2 caller workflows with `workflow_dispatch` only; enable trusted `main` pushes after the end-to-end demo works. The new runner group allows only the three team repositories and jobs directly defined by `playwright-v2.yml`. The source repository does not need runner access. Keep v2's workflow reference and the group's selected-workflow reference in sync. During development they can target `main`; before calling the setup stable, pin a reviewed revision and update both references together.

No v2 workflow or runner group should be created merely to publish this plan. The next change will add separate workflow files, and the cloud resources will follow after the design and cost checks.

## Goal

Keep three team-owned Playwright repositories and one central CI workflow. Give each CI job a clean runner, keep reports after that runner disappears, and show queueing, concurrency, failure recovery, cleanup, and cost with verifiable run links. Use synthetic TodoMVC data for the public demonstration.

## Responsibilities

| Component | Owns |
| --- | --- |
| Team repositories | Tests, lockfiles, non-secret environment configuration, and caller workflows. |
| `ci-platform` | Versioned reusable workflow, runner policy, provisioning code, report upload, and documentation. |
| GitHub Actions | Job queue, run status, logs, short-lived report artifacts, and team workflow access. |
| Google Cloud controller | Validated job events, capacity limit, VM creation, and orphan cleanup. |
| One-job Compute Engine VMs | Running exactly one Playwright job, then terminating. |
| Three private Cloud Storage buckets | Longer-lived reports and traces, with each team restricted to its own bucket. |

Cloud Storage is Google's object-storage counterpart to Amazon S3. The runner VM is execution capacity, not report storage.

## Run lifecycle

```text
team workflow queued
  -> GitHub sends workflow_job event
  -> controller verifies webhook signature and allowed repository/workflow
  -> controller reserves one of at most two runner slots
  -> controller creates a VM with a unique job label and short run limit
  -> VM starts a one-job GitHub runner and receives the queued job
  -> Playwright job checks out its team repo, runs npm ci and tests
  -> job uploads GitHub artifact and private Cloud Storage report
  -> job completes; controller deletes VM and releases slot
  -> scheduled reconciler deletes any orphan VM left by an interruption
```

The job container uses a versioned Playwright image. A new VM downloads the image on first use; a future prebuilt VM image can shorten startup. The team tests use one Playwright worker per job for the first trial. A third simultaneous job stays queued when both runner slots are occupied. Runner names and labels include the run ID so a job cannot accidentally land on another team's newly created machine.

## Configuration and identity

- Team-specific non-secret values use repository or environment variables. Test credentials use team-scoped GitHub secrets, passed by explicit name to the reusable workflow. No `.env` or Google service-account key is committed to a repository.
- The controller uses a GitHub App installation with only the organization runner and Actions permissions required for its work. Its private key and the webhook HMAC secret live in Google Secret Manager.
- The GitHub webhook receiver verifies `X-Hub-Signature-256` before creating resources, then validates the organization, repository ID, workflow identity, event action, and runner labels. Delivery IDs and run IDs make retries idempotent.
- CI jobs use GitHub OIDC and Google Workload Identity Federation for write access to report storage. Trust is restricted by numeric organization and repository IDs, `main`, and the central reusable workflow. The runner VM service account does not need project-wide permissions.
- The public TodoMVC demo uses synthetic data. For a future application under test, each run creates uniquely named fixtures and removes them in cleanup; removing a VM never substitutes for application-data cleanup.

## Report storage

Each run uploads `playwright-report/` and `test-results/` to GitHub Actions, including on test failure. The longer-lived copy is in a separate private Cloud Storage bucket for each team under:

```text
gs://{team-bucket}/{team}/{github_run_id}/{github_run_attempt}/playwright-report/
gs://{team-bucket}/{team}/{github_run_id}/{github_run_attempt}/test-results/
```

Each bucket uses uniform bucket-level access, public-access prevention, and a lifecycle deletion rule. Start with 30-day Cloud Storage retention and seven-day GitHub artifact retention. A future portal can index run metadata and provide authenticated downloads. It does not need to be part of the first end-to-end demonstration.

The controller deletes a VM only after the GitHub job reaches a terminal state. Normal completion includes an artifact-upload result. If the VM fails before upload, the run is marked failed and the controller retains enough remote logs to diagnose startup or runner failure. A scheduled reconciler removes the VM after a maximum age even if the completion webhook is missing. Report archives and traces must be reviewed for credentials or personal data before granting access.

## Capacity and cost controls

- Existing `testingwithekki` Google Cloud project linked to the billing account that holds the credits. The account has reached its project quota, so the v2 lab must track and remove only its own resources. Verify actual credit application in Billing reports after a small first run; the credit list alone does not establish which charges will be offset.
- Maximum two simultaneously running test VMs, initially one. Each VM is `e2-standard-2` unless a benchmark justifies another size.
- VM `max_run_duration` with deletion as the action, plus a separate reconciler for failed controller or GitHub events. No continuously running test VM.
- Project-scoped budget alerts, quota limits where useful, and daily cost checks during the demonstration. An alerts-only budget is a warning, not a cap on Compute Engine spend.
- Private bucket lifecycle rule and Cloud Run minimum instances of zero for the controller. Record gross cost, credits applied, and net cost separately.

## Acceptance demonstration

1. A trusted push in any of the three public team repositories causes a fresh VM and one successful run. The VM is absent afterward; the GitHub and Cloud Storage reports remain accessible to authorized users.
2. A deliberate test failure produces a failure report and trace. The VM still disappears and a following job succeeds.
3. Three jobs submitted together use at most two test VMs. Record queue time, VM startup time, test time, total time, and cost per run.
4. Replayed webhook delivery creates no duplicate VM. A simulated interrupted VM is removed by the reconciler.
5. No registration token, GitHub App key, webhook secret, test credential, or personal test data appears in public code, logs, or artifacts.
6. All v2 Cloud resources can be destroyed from tracked infrastructure code without deleting the pre-existing project. Keep reports only for the configured retention period.

## Build sequence

1. Add the separate v2 workflow files with manual triggers, a versioned contract, explicit team configuration, and the existing GitHub artifact upload. Keep the v1 files untouched.
2. Add private buckets, lifecycle, Workload Identity Federation, and scoped report writers in the existing `testingwithekki` project. Validate upload and download with one team on a temporary one-job runner.
3. Implement the verified webhook receiver and idempotent VM lifecycle with a one-runner capacity limit.
4. Add the orphan reconciler, second capacity slot, and three-team concurrency experiment.
5. Publish a sanitized architecture diagram, timings, gross cost, credit application, failure evidence, and teardown record. Disable v2 workflows and destroy the v2 project after the demonstration unless a follow-up experiment needs them.

## Build-in-public chapters

1. **Part 1 — One VM, three teams:** the existing experiment, including queueing and disposal.
2. **Part 2 — Designing the platform:** the v1/v2 boundary, CI contract, threat model, private report storage, and cost controls. This document is the working outline.
3. **Part 3 — One disposable job:** new v2 workflow, one short-lived runner, report uploaded to GitHub and Cloud Storage, VM deleted.
4. **Part 4 — Shared capacity without a shared host:** two runner slots, three simultaneous team runs, metrics, failure injection, and orphan cleanup.

Each chapter should show public-safe screenshots and real run links. Never publish webhook signatures, registration tokens, GitHub App private keys, personal test data, billing identifiers, or raw Terraform state.

## References

- [GitHub self-hosted runner autoscaling and ephemeral runners](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)
- [GitHub `workflow_job` webhook](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job)
- [Validate GitHub webhook signatures](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Google Cloud Workload Identity Federation for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Cloud Storage uniform bucket-level access](https://docs.cloud.google.com/storage/docs/using-uniform-bucket-level-access)
- [Cloud Storage object lifecycle management](https://docs.cloud.google.com/storage/docs/lifecycle)
