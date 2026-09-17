# Google Cloud runner VM

This Terraform configuration creates a small Ubuntu Compute Engine VM, a dedicated VPC, an IAP-only SSH firewall rule, and a service account with no project roles. The VM has an external IP for outbound access to GitHub and the Playwright image registry. No application port is opened to the internet. The VM automatically stops after six hours of running as a backstop; its disk still incurs charges until removed.

## Prerequisites

- A dedicated Google Cloud project with billing and the Compute Engine, IAM, and IAP APIs enabled. For this lab, use `testingwithekki-qa-ci-lab`; keep it separate from existing projects.
- Terraform and the Google Cloud CLI installed locally
- Google Cloud credentials for Terraform (`gcloud auth application-default login`)
- A GitHub organization where you can register an organization-level runner

## Provision

```sh
cd infra
terraform init
terraform apply -var="project_id=YOUR_GCP_PROJECT" -var="zone=YOUR_ZONE"
```

Choose the zone after checking its current VM and disk prices. The default machine type is `e2-standard-2` (2 vCPU, 8 GB RAM), intended for one Playwright worker. Benchmark before adding workers or runners.

Connect using IAP:

```sh
gcloud compute ssh qa-ci-runner --project=YOUR_GCP_PROJECT --zone=YOUR_ZONE --tunnel-through-iap
```

On the VM, install Docker using [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Create a dedicated non-root runner account, grant it Docker access, then follow GitHub's organization **New runner** page to download and configure the current Linux x64 runner. Select the `qa-playwright` runner group and add label `qa-playwright` during registration. Configure it as a service so it starts with the VM. Only administrators should control the runner account; Docker access is privileged. The VM uses an attached service account with no project roles; do not create a downloadable service-account key or copy personal Google credentials to the VM.

## Cost control

Create a budget scoped to this project and alerts before `terraform apply`. A Compute Engine budget alert does not stop VM charges. The six-hour automatic stop limits an unattended session, but stop the VM as soon as the experiment ends:

```sh
gcloud compute instances stop qa-ci-runner --project=YOUR_GCP_PROJECT --zone=YOUR_ZONE
```

The VM compute charge stops while it is stopped, but the boot disk and possibly other retained resources continue to cost money. After recording the successful CI runs and downloading public-safe evidence, remove the organization runner in GitHub, then delete the infrastructure:

```sh
terraform destroy -var="project_id=YOUR_GCP_PROJECT" -var="zone=YOUR_ZONE"
```

Inspect the plan before applying or destroying. Verify the VM, disk, VPC, and service account are gone. Disable billing for `testingwithekki-qa-ci-lab`, then shut down **that project only** in Google Cloud's project settings. Project shutdown enters a 30-day recovery period; the project ID cannot be reused after permanent deletion. No Google API key is required for this lab, so there is no key to revoke. Do not delete the existing `ekki-ai` project or the public GitHub repositories used for the portfolio.

The VM is a learning baseline for trusted repositories, not a production isolation design.
