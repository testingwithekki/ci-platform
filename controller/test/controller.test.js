import assert from 'node:assert/strict';
import test from 'node:test';
import { RunnerController } from '../src/controller.js';

class FakeState {
  constructor(max = 2) { this.max = max; this.pending = []; this.active = new Map(); this.running = []; }
  async enqueue(job) { if (this.pending.some((item) => item.id === job.id) || this.active.has(job.id)) return false; this.pending.push(job); return true; }
  async reserveNext() { if (this.active.size >= this.max || this.pending.length === 0) return null; const job = this.pending.shift(); this.active.set(job.id, job); return job; }
  async markRunning(id, resources) { Object.assign(this.active.get(id), resources); this.running.push(id); }
  async complete(id) { const job = this.active.get(id); this.active.delete(id); return job; }
  async retry(id) { const job = this.active.get(id); this.active.delete(id); this.pending.unshift(job); }
  async staleJobs() { return []; }
}

test('starts two jobs and holds the third until capacity is released', async () => {
  const state = new FakeState(2);
  const created = [];
  const cloud = {
    async createJitSecret(id) { return `secret-${id}`; },
    async createRunnerVm(value) { created.push(value.jobId); },
    async cleanup() {}
  };
  const github = { async createJitConfig() { return { encoded_jit_config: 'encoded', runner: { id: 1 } }; } };
  const config = { maxRunners: 2, runnerGroupId: 4, requiredLabel: 'qa-platform-v2', staleAfterMinutes: 55 };
  const controller = new RunnerController({ config, state, cloud, github, logger: { error() {} } });

  for (const id of ['1', '2', '3']) await controller.queued({ id, installationId: 88 });
  assert.deepEqual(created, ['1', '2']);
  assert.equal(state.pending.length, 1);

  await controller.completed({ id: '1' });
  assert.deepEqual(created, ['1', '2', '3']);
  assert.equal(state.active.size, 2);
});

test('preservation mode releases capacity without deleting completed runner evidence', async () => {
  const state = new FakeState(2);
  let cleanupCalls = 0;
  const cloud = {
    async createJitSecret(id) { return `secret-${id}`; },
    async createRunnerVm() {},
    async cleanup() { cleanupCalls += 1; }
  };
  const github = { async createJitConfig() { return { encoded_jit_config: 'encoded', runner: { id: 1 } }; } };
  const config = { runnerGroupId: 4, requiredLabel: 'qa-platform-v2', staleAfterMinutes: 55, preserveRunners: true };
  const controller = new RunnerController({ config, state, cloud, github, logger: { error() {} } });

  await controller.queued({ id: '1', installationId: 88 });
  await controller.completed({ id: '1' });
  assert.equal(cleanupCalls, 0);
  assert.equal(state.active.size, 0);
});
