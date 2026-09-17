# Shared runner experiment

On 2026-09-17, three public QA team repositories ran small Playwright TodoMVC suites through one organization runner. The purpose was to measure CI queueing, artifact retention, recovery after a test failure, and teardown. All times below are UTC.

## Setup

- Repositories: [team-create](https://github.com/testingwithekki/team-create), [team-filter](https://github.com/testingwithekki/team-filter), and [team-persistence](https://github.com/testingwithekki/team-persistence).
- One organization runner named `qa-ci-runner` in restricted group `qa-playwright`. The group allowed only those three repositories and the central workflow in this repository.
- Google Cloud VM: `e2-standard-2`, Ubuntu 24.04, 30 GB `pd-balanced` boot disk, `us-central1-a`. Terraform created a dedicated VPC, subnet, IAP-only SSH firewall, and service account with no project roles. The VM had a six-hour automatic stop.
- The reusable workflow ran in `mcr.microsoft.com/playwright:v1.63.0-noble`, uploaded Playwright artifacts even on failure, and retained them for seven days. Team workflows accepted trusted `main` pushes and manual dispatch, with no pull-request trigger.

## Baseline and queueing

GitHub's job timestamps are the source for these measurements: queue time is `started_at - created_at`; run time is `completed_at - started_at`. The initial run included a container image pull. The three-run trial was dispatched while the runner was idle, within one second of each other.

| Trial | Team and run | Created | Started | Completed | Queue | Run | Result |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Initial | [Create](https://github.com/testingwithekki/team-create/actions/runs/35218691613) | 12:00:25 | 12:00:26 | 12:01:14 | 1 s | 48 s | Passed |
| Three teams | [Create](https://github.com/testingwithekki/team-create/actions/runs/35218798141) | 12:01:30 | 12:01:31 | 12:01:45 | 1 s | 14 s | Passed |
| Three teams | [Filter](https://github.com/testingwithekki/team-filter/actions/runs/35218798671) | 12:01:30 | 12:01:46 | 12:02:00 | 16 s | 14 s | Passed |
| Three teams | [Persistence](https://github.com/testingwithekki/team-persistence/actions/runs/35218799237) | 12:01:31 | 12:02:01 | 12:02:15 | 30 s | 14 s | Passed |

All four jobs reported `runner_name: qa-ci-runner` and `runner_group_name: qa-playwright`. The three-team trial took 45 seconds from the first job's creation to the last job's completion. It demonstrates that one runner serializes jobs; it does not prove a guaranteed first-in-first-out scheduling policy. For these tiny suites, a 30-second worst queue was tolerable. A second runner would become useful if concurrent requests or suite duration increased enough that this wait exceeded the team's target.

## Failure and recovery

The [intentional Create failure](https://github.com/testingwithekki/team-create/actions/runs/35218918257) finished with one failed and two passed tests. GitHub retained the HTML report, a failure screenshot, and `trace.zip` in the run artifact. The following [Persistence run](https://github.com/testingwithekki/team-persistence/actions/runs/35218981950) passed on the same runner in 14 seconds. A test failure did not leave the runner unable to accept the next job.

The runner was persistent and shared across repositories. Restricting repository access and using a container reduced exposure, but this design should only accept trusted code from the three teams. Containers do not guarantee isolation from a malicious job on a shared self-hosted runner.

## Cost

The Google Cloud billing account had available Google Developer Program credits whose listed usage scope includes Google Cloud Platform. A monthly IDR 100,000 budget alerted at 50%, 90%, and 100%; it was not a hard cap. On 2026-09-18, the budget page showed **Rp161.33** of project spend, with "No credits used". The project-filtered report showed about Rp55 for Compute Engine and Rp106 for Networking on 2026-09-17. These are the amounts visible at that check, not a final invoice; later usage and credit entries may still appear. The billing report is private to the billing account.

## Disposal

The lab was designed to be disposable. Record completion only after checking each service:

| Step | Evidence |
| --- | --- |
| Runner service stopped | Stopped on the VM after the recovery run |
| Team workflows disabled | GitHub's workflow API returned `disabled_manually` for all three repositories after VM disposal. Past run pages remain visible. |
| Organization runner retained offline | GitHub's runner list showed `qa-ci-runner` as **Offline** on 2026-09-18. Retained at the owner's request; its VM and disk no longer exist. [GitHub automatically removes standard runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/remove-runners) after more than 14 days without a connection. |
| Terraform destroy completed; VM, boot disk, VPC, subnet, firewall, and service account absent | At about 12:07 UTC, Terraform reported `0 added, 0 changed, 5 destroyed`; `terraform state list` returned no resources. The VM's attached boot disk was deleted with the instance. |
| Billing disabled for `testingwithekki-qa-ci-lab` | `gcloud billing projects unlink` returned `billingEnabled: false` and an empty billing account name. |
| Dedicated project shut down | `gcloud projects delete` succeeded; `gcloud projects describe` returned `lifecycleState: DELETE_REQUESTED` at about 12:09 UTC. Google Cloud permits recovery for a limited period. |
| Lab budget alert retained | The IDR 100,000 alert remains scoped to project `23565600027` at the owner's request. The separate account-wide budget was untouched. |

No downloadable Google API key was created. The four public GitHub repositories remain as the portfolio. The restricted `qa-playwright` runner group remains; GitHub will eventually remove the offline runner registration. All three team workflows are disabled, so they will not queue new jobs until intentionally re-enabled. A future run needs a newly provisioned VM and runner registration.
