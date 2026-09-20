import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

function environment(overrides = {}) {
  return {
    GOOGLE_CLOUD_PROJECT: 'project',
    GITHUB_ORGANIZATION_ID: '1',
    GITHUB_REPOSITORY_IDS: '2,3,4',
    GITHUB_RUNNER_GROUP_ID: '5',
    GITHUB_APP_ID: '6',
    GITHUB_APP_INSTALLATION_ID: '88',
    RUNNER_SERVICE_ACCOUNT: 'runner@example.com',
    RUNNER_SUBNETWORK: 'subnet',
    RUNNER_BOOTSTRAP_REF: 'a'.repeat(40),
    TASK_TARGET_URL: 'https://controller.example/tasks',
    TASK_AUDIENCE: 'https://controller.example/tasks',
    TASK_INVOKER_SERVICE_ACCOUNT: 'tasks@example.com',
    ...overrides
  };
}

test('requires a full immutable commit for the runner bootstrap', () => {
  assert.equal(loadConfig(environment()).runnerBootstrapRef, 'a'.repeat(40));
  assert.throws(() => loadConfig(environment({ RUNNER_BOOTSTRAP_REF: 'main' })), /full lowercase Git commit SHA/);
});
