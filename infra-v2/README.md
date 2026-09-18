# Private report storage and GitHub OIDC

This is the storage and identity slice of QA platform v2. Runner provisioning is a separate slice. The three buckets are private and each team job can create objects only in its own bucket. No Google service account key is needed in GitHub.

1. Use the existing `testingwithekki` Google Cloud project, which is already linked to the billing account. Check existing resources and set a project-scoped budget alert before running jobs.
2. Install Terraform and authenticate to Google Cloud with Application Default Credentials.
3. Copy `terraform.tfvars.example` to `terraform.tfvars` and set the real project ID. Check the numeric GitHub IDs against the organization and repos before use.
4. Run `terraform init`, `terraform plan -out=lab.tfplan`, and `terraform apply lab.tfplan`.
5. Set `QA_V2_PROJECT_ID` and `QA_V2_WIF_PROVIDER` in each team repository. Set `QA_V2_REPORT_BUCKET` to the corresponding bucket output.
6. After the demo, empty only the three lab report buckets and run `terraform destroy`. The buckets have `force_destroy = false` to guard against accidental report deletion. Keep the pre-existing `testingwithekki` project and any unrelated resources.

Keep Terraform state private. It records resource metadata. The provider admits only the three numeric GitHub repository IDs, the organization ID, the main branch, and the central reusable workflow. Each caller also needs GitHub `id-token: write`.
