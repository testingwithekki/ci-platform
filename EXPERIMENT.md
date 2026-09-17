# CI experiment log

The story to demonstrate is how three QA teams share one runner, and what becomes a bottleneck. Keep the test suites small so the measurements describe the CI design rather than application complexity.

## Run 1: baseline

Start the VM and confirm the organization runner is **online**. Run each team workflow once. Record the GitHub Actions run link, job start and end times, and outcome.

| Team | Run link | Queue time | Run time | Result |
| --- | --- | ---: | ---: | --- |
| Checkout | | | | |
| Search | | | | |
| Profile | | | | |

GitHub Actions exposes job `created_at`, `started_at`, and `completed_at` timestamps in the jobs API. Compute `queue time = started_at - created_at` and `run time = completed_at - started_at`. For a small sample, the run page timestamps are enough to demonstrate the behavior.

## Run 2: contention

Trigger checkout and search close together while the single runner is idle. Record which job starts and which waits. Repeat with all three teams. The run order is controlled by GitHub's scheduler; do not claim strict first-in-first-out fairness from this demo.

| Number of concurrent requests | Longest queue time | Total elapsed time | Notes |
| ---: | ---: | ---: | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Run 3: failure recovery

Trigger checkout with **Demonstrate failure** enabled. Verify the failed run retains an HTML report, screenshot, and trace. Then run profile and verify the runner accepts another job. Record links to both runs.

## Cost and decision

Record the VM machine type, region, running hours, boot disk size, network charges, and total billed cost from Google Cloud Billing. Include the period measured. A budget alert is a warning, not a hard spending limit.

Conclude with evidence: whether queue time is acceptable for this workload, when a second runner would help, and why disposable runners would be the next security improvement. Avoid claiming that the persistent VM is isolated between untrusted teams.
