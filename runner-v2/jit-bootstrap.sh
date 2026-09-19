#!/usr/bin/env bash
set -euo pipefail

# Public bootstrap for controller-created JIT runners. No GitHub credential is
# embedded in this file or in instance metadata.
exec > >(tee -a /var/log/qa-v2-jit-runner.log) 2>&1
trap 'shutdown -h now' EXIT

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl docker.io jq
systemctl enable --now docker

if ! id -u runner >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash runner
fi
usermod -aG docker runner
install -d -o runner -g runner /opt/actions-runner

runner_version='2.337.0'
runner_sha256='70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613'
runner_archive="actions-runner-linux-x64-${runner_version}.tar.gz"
curl --fail --location --retry 3 --output "/tmp/${runner_archive}" \
  "https://github.com/actions/runner/releases/download/v${runner_version}/${runner_archive}"
printf '%s  %s\n' "$runner_sha256" "/tmp/${runner_archive}" | sha256sum --check --status
tar -xzf "/tmp/${runner_archive}" -C /opt/actions-runner
rm -f "/tmp/${runner_archive}"
chown -R runner:runner /opt/actions-runner

metadata='http://metadata.google.internal/computeMetadata/v1'
metadata_header='Metadata-Flavor: Google'
vm_name="$(curl --fail --silent --header "$metadata_header" "${metadata}/instance/name")"
jit_secret_id="$(curl --fail --silent --header "$metadata_header" "${metadata}/instance/attributes/jit-secret-id")"
access_token="$(curl --fail --silent --header "$metadata_header" \
  "${metadata}/instance/service-accounts/default/token" | jq -r '.access_token')"
secret_response="$(curl --fail --silent --show-error --header "Authorization: Bearer ${access_token}" \
  "https://secretmanager.googleapis.com/v1/projects/testingwithekki/secrets/${jit_secret_id}/versions/latest:access")"
unset access_token jit_secret_id
encoded_jit_config="$(printf '%s' "$secret_response" | jq -r '.payload.data' | base64 --decode)"
unset secret_response
test -n "$encoded_jit_config"

echo "JIT runner ${vm_name} is starting."
cd /opt/actions-runner
runuser -u runner -- ./run.sh --jitconfig "$encoded_jit_config"
unset encoded_jit_config
echo "JIT runner ${vm_name} finished; shutting down."
