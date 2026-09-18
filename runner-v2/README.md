# One disposable runner: first live demonstration

This first slice deliberately provisions one VM by hand. The public bootstrap script contains no registration token. The VM's dedicated service account can read only the short-lived GitHub registration token from one Secret Manager secret. The VM has outbound internet access and a dedicated subnet with no ingress firewall rule. It shuts down after its one ephemeral runner job; Compute Engine deletes it after 45 minutes even if startup or the job hangs. Delete a stopped VM promptly after the run rather than waiting for the time limit.

## Before boot

1. Apply `../infra-v2` and configure the three team repository variables in `../infra-v2/README.md`.
2. In GitHub, open **Organization settings → Actions → Runners → New runner**. Generate a short-lived organization runner registration token. Never publish or commit it. Add it as a new version of the `qa-v2-runner-registration` Secret Manager secret. The token is valid for about one hour, so boot the VM immediately.
3. Confirm the `qa-platform-v2` runner group permits only `team-create`, `team-filter`, and `team-persistence`, and only `ci-platform/.github/workflows/playwright-v2.yml@refs/heads/main`.

Run from the `ci-platform` repository root in PowerShell:

```powershell
$runnerName = "qa-v2-manual-$(Get-Date -Format 'yyMMddHHmmss')"
gcloud compute instances create $runnerName `
  --project=testingwithekki `
  --zone=us-central1-a `
  --machine-type=e2-standard-2 `
  --image-family=debian-12 `
  --image-project=debian-cloud `
  --boot-disk-size=30GB `
  --boot-disk-type=pd-balanced `
  --subnet=qa-v2-runner-us-central1 `
  --service-account=qa-v2-runner@testingwithekki.iam.gserviceaccount.com `
  --scopes=cloud-platform `
  --metadata-from-file=startup-script=runner-v2/bootstrap.sh `
  --max-run-duration=45m `
  --instance-termination-action=DELETE `
  --labels=purpose=qa-platform-v2,life=disposable
```

Monitor startup using `gcloud compute instances get-serial-port-output $runnerName --zone=us-central1-a --project=testingwithekki`, and verify the runner appears in `qa-platform-v2`. Dispatch `QA platform v2` in one team repository. Record the GitHub job result and both report locations. Do not include the registration token, OAuth codes, raw logs, or test data in public screenshots.

After the ephemeral job finishes, delete any stopped VM with `gcloud compute instances delete $runnerName --zone=us-central1-a --project=testingwithekki --quiet`. Confirm the GitHub runner deregistered, the VM is absent, and the GitHub artifact and Cloud Storage files remain. This manual path is the acceptance baseline for the later `workflow_job` webhook controller, two-slot capacity limit, and orphan reconciler.
