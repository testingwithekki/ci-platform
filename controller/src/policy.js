export function classifyWorkflowJob(payload, config) {
  const job = payload?.workflow_job;
  const labels = new Set(job?.labels ?? []);
  const valid =
    payload?.organization?.id === config.organizationId &&
    payload?.organization?.login?.toLowerCase() === config.organization.toLowerCase() &&
    config.repositoryIds.has(payload?.repository?.id) &&
    payload?.repository?.owner?.id === config.organizationId &&
    job?.head_branch === config.allowedBranch &&
    labels.has('self-hosted') &&
    labels.has(config.requiredLabel) &&
    Number.isSafeInteger(job?.id) &&
    payload?.installation?.id === config.appInstallationId;

  if (!valid) return { accepted: false, reason: 'event outside runner policy' };
  if (!['queued', 'completed'].includes(payload.action)) {
    return { accepted: false, reason: 'workflow_job action ignored' };
  }

  return {
    accepted: true,
    action: payload.action,
    job: {
      id: String(job.id),
      runId: String(job.run_id),
      repositoryId: payload.repository.id,
      repository: payload.repository.full_name,
      installationId: payload.installation.id,
      runnerId: Number.isSafeInteger(job.runner_id) ? String(job.runner_id) : null,
      queuedAt: job.created_at ?? new Date().toISOString()
    }
  };
}
