# Google Cloud runner VM

This Terraform configuration creates a small Ubuntu Compute Engine VM, a dedicated VPC, an IAP-only SSH firewall rule, and a service account with no project roles. The VM has an external IP for outbound access to GitHub and the Playwright image registry. No application port is opened to the internet.

## Prerequisites

- A Google Cloud project with billing and the Compute Engine, IAM, and IAP APIs enabled
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

On the VM, install Docker using [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Create a dedicated non-root runner account, grant it Docker access, then follow GitHub's organization **New runner** page to download and configure the current Linux x64 runner. Add label `qa-playwright` during registration. Configure it as a service so it starts with the VM. Only administrators should control the runner account; Docker access is privileged.

## Cost control

Create a Google Cloud billing budget and alerts before `terraform apply`. Alerts do not automatically stop spending. Stop the VM between practice sessions:

```sh
gcloud compute instances stop qa-ci-runner --project=YOUR_GCP_PROJECT --zone=YOUR_ZONE
```

The VM compute charge stops while it is stopped, but the boot disk and possibly other retained resources continue to cost money. Delete the lab when finished:

```sh
terraform destroy -var="project_id=YOUR_GCP_PROJECT" -var="zone=YOUR_ZONE"
```

Inspect the plan before applying or destroying. The VM is a learning baseline for trusted repositories, not a production isolation design.
