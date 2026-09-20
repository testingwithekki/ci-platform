# Publication acceptance test

Record the date, Git revision, controller image digest, bootstrap commit, run
IDs, timings, screenshots, gross cost, credits, and net cost.

## Automated gates

```bash
cd controller
npm ci
npm test
cd ../infra-v2
terraform fmt -check -recursive
terraform validate
```

## Live scenarios

| Scenario | Expected evidence |
|---|---|
| Signed queued webhook | HTTP 202 and one Cloud Task |
| Duplicate delivery | HTTP 202 with `duplicate: true`; no second VM |
| Invalid signature | HTTP 401 and no task |
| Invalid repository or branch | HTTP 202 ignored and no task |
| Three simultaneous jobs | Two active VMs and one pending Firestore job |
| Passing job | Green run, GitHub artifact, private GCS report |
| Deliberate failure | Red run with report, screenshot, error context, and trace |
| Cancellation | Capacity released and runner resources cleaned |
| Completion retry | Repeated task succeeds without capacity underflow |
| Lost webhook simulation | Reconciler repairs stale state |
| Normal cleanup | VM and JIT secret absent after completion |
| Runner diagnostics | Bootstrap and runner diagnostic record in Cloud Logging |

## Publication gate

Publish only after automated gates pass and the live evidence proves signature
verification, concurrency, durable reports, normal cleanup, and external runner
diagnostics. Clearly label preserved resources or manual demonstration switches
as lab-only behavior.
