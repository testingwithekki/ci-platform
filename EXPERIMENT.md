# CI experiment log

The story to demonstrate is how three QA teams share one runner, and what becomes a bottleneck. Keep the test suites small so the measurements describe the CI design rather than application complexity.

## Run 1: baseline

Start the VM and confirm the organization runner is **online**. Run each team workflow once. Record the GitHub Actions run link, job start and end times, and outcome.

| Team | Run link | Queue time | Run time | Result |
| --- | --- | ---: | ---: | --- |
| Create | | | | |
| Filter | | | | |
| Persistence | | | | |

GitHub Actions exposes job `created_at`, `started_at`, and `completed_at` timestamps in the jobs API. Compute `queue time = started_at - created_at` and `run time = completed_at - started_at`. For a small sample, the run page timestamps are enough to demonstrate the behavior.

## Run 2: contention

Trigger create and filter close together while the single runner is idle. Record which job starts and which waits. Repeat with all three teams. The run order is controlled by GitHub's scheduler; do not claim strict first-in-first-out fairness from this demo.

| Number of concurrent requests | Longest queue time | Total elapsed time | Notes |
| ---: | ---: | ---: | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Run 3: failure recovery

Trigger create with **Demonstrate failure** enabled. Verify the failed run retains an HTML report, screenshot, and trace. Then run persistence and verify the runner accepts another job. Record links to both runs.

## Cost and decision

Record the VM machine type, region, running hours, boot disk size, network charges, and total billed cost from Google Cloud Billing. Include the period measured. A budget alert is a warning, not a hard spending limit.

Conclude with evidence: whether queue time is acceptable for this workload, when a second runner would help, and the security limit of a shared persistent runner. Avoid claiming that the persistent VM is isolated between untrusted teams.

## Disposal evidence

After all three teams have run and the reports are saved, record the time and evidence for each step:

| Step | Evidence |
| --- | --- |
| Organization runner removed from GitHub | |
| Terraform destroy completed; VM, disk, VPC, and service account absent | |
| Billing disabled for `testingwithekki-qa-ci-lab` | |
| Dedicated project shut down (30-day recovery period) | |

No downloadable Google API key is created for the lab. Keep the public GitHub repositories as the portfolio; dispose only of the lab runner, its GitHub runner group, and the dedicated Google Cloud project.
