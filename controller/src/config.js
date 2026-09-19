function required(name, env) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function csvIntegers(value, name) {
  const values = value.split(',').map((item) => Number(item.trim()));
  if (values.some((item) => !Number.isSafeInteger(item))) {
    throw new Error(`${name} must be a comma-separated list of integers`);
  }
  return new Set(values);
}

export function loadConfig(env = process.env) {
  const maxRunners = Number(env.MAX_RUNNERS ?? '2');
  if (!Number.isInteger(maxRunners) || maxRunners < 1 || maxRunners > 10) {
    throw new Error('MAX_RUNNERS must be an integer from 1 to 10');
  }

  return {
    projectId: required('GOOGLE_CLOUD_PROJECT', env),
    region: env.RUNNER_REGION ?? 'us-central1',
    zone: env.RUNNER_ZONE ?? 'us-central1-a',
    organization: env.GITHUB_ORGANIZATION ?? 'testingwithekki',
    organizationId: Number(required('GITHUB_ORGANIZATION_ID', env)),
    repositoryIds: csvIntegers(required('GITHUB_REPOSITORY_IDS', env), 'GITHUB_REPOSITORY_IDS'),
    runnerGroupId: Number(required('GITHUB_RUNNER_GROUP_ID', env)),
    appId: required('GITHUB_APP_ID', env),
    appPrivateKeySecret: env.GITHUB_APP_PRIVATE_KEY_SECRET ?? 'qa-v2-github-app-private-key',
    webhookSecretName: env.GITHUB_WEBHOOK_SECRET_NAME ?? 'qa-v2-github-webhook-secret',
    runnerServiceAccount: required('RUNNER_SERVICE_ACCOUNT', env),
    subnetwork: required('RUNNER_SUBNETWORK', env),
    machineType: env.RUNNER_MACHINE_TYPE ?? 'e2-standard-2',
    maxRunners,
    requiredLabel: env.RUNNER_LABEL ?? 'qa-platform-v2',
    allowedBranch: env.ALLOWED_BRANCH ?? 'main',
    staleAfterMinutes: Number(env.STALE_AFTER_MINUTES ?? '55'),
    reconcileAudience: env.RECONCILE_AUDIENCE,
    reconcilerServiceAccount: env.RECONCILER_SERVICE_ACCOUNT,
    githubApiVersion: env.GITHUB_API_VERSION ?? '2026-03-10'
  };
}
