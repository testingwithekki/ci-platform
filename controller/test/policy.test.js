import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWorkflowJob } from '../src/policy.js';

const config = {
  organization: 'testingwithekki',
  organizationId: 330211622,
  repositoryIds: new Set([1373784160]),
  allowedBranch: 'main',
  requiredLabel: 'qa-platform-v2',
  appInstallationId: 88
};

function payload(overrides = {}) {
  return {
    action: 'queued',
    organization: { id: 330211622, login: 'testingwithekki' },
    repository: { id: 1373784160, full_name: 'testingwithekki/team-create', owner: { id: 330211622 } },
    installation: { id: 88 },
    workflow_job: {
      id: 123,
      run_id: 456,
      head_branch: 'main',
      labels: ['self-hosted', 'linux', 'x64', 'qa-platform-v2'],
      created_at: '2026-09-20T00:00:00Z'
    },
    ...overrides
  };
}

test('accepts the exact trusted runner job', () => {
  const result = classifyWorkflowJob(payload(), config);
  assert.equal(result.accepted, true);
  assert.equal(result.job.id, '123');
  assert.equal(result.job.runnerId, null);
});

test('captures the assigned runner on completion', () => {
  const value = payload();
  value.action = 'completed';
  value.workflow_job.runner_id = 789;
  assert.equal(classifyWorkflowJob(value, config).job.runnerId, '789');
});

test('rejects another repository even with matching labels', () => {
  const value = payload();
  value.repository.id = 999;
  assert.equal(classifyWorkflowJob(value, config).accepted, false);
});

test('rejects another GitHub App installation', () => {
  const value = payload();
  value.installation.id = 99;
  assert.equal(classifyWorkflowJob(value, config).accepted, false);
});

test('rejects pull request branches', () => {
  const value = payload();
  value.workflow_job.head_branch = 'feature/untrusted';
  assert.equal(classifyWorkflowJob(value, config).accepted, false);
});

test('ignores workflow jobs without the platform label', () => {
  const value = payload();
  value.workflow_job.labels = ['self-hosted'];
  assert.equal(classifyWorkflowJob(value, config).accepted, false);
});
