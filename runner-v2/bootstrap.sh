#!/usr/bin/env bash
set -euo pipefail

# This file is public. The short-lived registration token stays in Secret Manager.
exec > >(tee -a /var/log/qa-v2-runner-startup.log) 2>&1
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
vm_name="$(curl --fail --silent --header 'Metadata-Flavor: Google' "${metadata}/instance/name")"
access_token="$(curl --fail --silent --header 'Metadata-Flavor: Google' \
  "${metadata}/instance/service-accounts/default/token" | jq -r '.access_token')"
secret_response="$(curl --fail --silent --show-error --header "Authorization: Bearer ${access_token}" \
  'https://secretmanager.googleapis.com/v1/projects/testingwithekki/secrets/qa-v2-runner-registration/versions/latest:access')"
unset access_token
registration_token="$(printf '%s' "$secret_response" | jq -r '.payload.data' | base64 --decode)"
unset secret_response
test -n "$registration_token"

cd /opt/actions-runner
runuser -u runner -- ./config.sh \
  --unattended \
  --url https://github.com/testingwithekki \
  --token "$registration_token" \
  --runnergroup qa-platform-v2 \
  --labels qa-platform-v2 \
  --name "$vm_name" \
  --work _work \
  --ephemeral \
  --disableupdate
unset registration_token

echo "One-job runner ${vm_name} is online."
runuser -u runner -- ./run.sh
echo "One-job runner ${vm_name} finished; shutting down."
