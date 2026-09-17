# CI platform

This repository owns the shared Playwright workflow and the Google Cloud VM definition. Team repositories call `.github/workflows/playwright.yml`; they do not duplicate the test execution steps. The three small suites exercise [Playwright's TodoMVC demo](https://demo.playwright.dev/todomvc/).

The runner must be registered at the **organization** level and carry the label `qa-playwright`. For the first milestone, run one runner on one VM. Each GitHub Actions runner processes one job at a time, so simultaneous team runs visibly queue.

The workflow is limited to `contents: read`, runs in a pinned Playwright container image, has a timeout, and uploads the report even when tests fail. The team repositories are public for this portfolio project. Their self-hosted workflows run only for trusted pushes to `main` or manual dispatch, with no pull-request trigger. Limit write access and protect `main`; permit only the three team repositories to use the runner group. Containerization makes browser dependencies repeatable, but it does not make a persistent runner safe for untrusted code.

Provisioning instructions are in [`infra/README.md`](infra/README.md).

The [experiment log](EXPERIMENT.md) contains the live run links, queue measurements, failure artifact evidence, and teardown record.

The lab VM and Google Cloud project were disposed on 2026-09-17. The three team workflows are disabled until a new trusted organization runner is provisioned; past Actions runs remain visible.
