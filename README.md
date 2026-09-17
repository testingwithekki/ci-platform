# CI platform

This repository owns the shared Playwright workflow and the Google Cloud VM definition. Team repositories call `.github/workflows/playwright.yml`; they do not duplicate the test execution steps.

The runner must be registered at the **organization** level and carry the label `qa-playwright`. For the first milestone, run one runner on one VM. Each GitHub Actions runner processes one job at a time, so simultaneous team runs visibly queue.

The workflow is limited to `contents: read`, runs in a pinned Playwright container image, has a timeout, and uploads the report even when tests fail. Keep team repositories private and limit who can modify workflows. Containerization makes browser dependencies repeatable, but it does not make a persistent runner safe for untrusted code.

Provisioning instructions are in [`infra/README.md`](infra/README.md).
