# CI platform

This repository owns two shared Playwright CI experiments. Team repositories
call reusable workflows instead of duplicating test execution. The three small
suites exercise [Playwright's TodoMVC demo](https://demo.playwright.dev/todomvc/).

The runner must be registered at the **organization** level and carry the label `qa-playwright`. For the first milestone, run one runner on one VM. Each GitHub Actions runner processes one job at a time, so simultaneous team runs visibly queue.

The workflow is limited to `contents: read`, runs in a pinned Playwright container image, has a timeout, and uploads the report even when tests fail. The team repositories are public for this portfolio project. Their self-hosted workflows run only for trusted pushes to `main` or manual dispatch, with no pull-request trigger. Limit write access and protect `main`; permit only the three team repositories to use the runner group. Containerization makes browser dependencies repeatable, but it does not make a persistent runner safe for untrusted code.

Provisioning instructions are in [`infra/README.md`](infra/README.md).

The [experiment log](EXPERIMENT.md) contains the live run links, queue measurements, failure artifact evidence, and teardown record.

The [QA platform v2 design](docs/qa-platform-v2.md) is deployed in the existing
`testingwithekki` project. It uses signed GitHub App webhooks, authenticated
Cloud Tasks, Firestore capacity control, JIT one-job Compute Engine runners,
GitHub OIDC, and private team report buckets. The platform accepts at most two
jobs concurrently and normally deletes runner VMs and JIT secrets after a job.

Publication evidence and operational documentation:

- [Threat model](docs/threat-model.md)
- [Controller state machine](docs/state-machine.md)
- [Operator runbook](docs/runbook.md)
- [Acceptance test](docs/acceptance-test.md)

The v1 lab VM and its project were disposed on 2026-09-17. Its organization
runner record remains offline at the owner's request. V2 reuses a separate,
existing project and its caller workflows remain manual for this public lab.
