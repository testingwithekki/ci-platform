import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { createHandler } from '../src/app.js';

test('exposes readiness and rejects an unsigned webhook', async (context) => {
  const handler = createHandler({
    config: {},
    controller: {},
    webhookSecret: 'secret',
    logger: { error() {} }
  });
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  context.after(() => server.close());
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const ready = await fetch(`${base}/readyz`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { ok: true });

  const webhook = await fetch(`${base}/github`, { method: 'POST', body: '{}' });
  assert.equal(webhook.status, 401);
});

test('queues a signed webhook and processes only authenticated tasks', async (context) => {
  const queued = [];
  const processed = [];
  const config = {
    organization: 'testingwithekki',
    organizationId: 330211622,
    repositoryIds: new Set([1373784160]),
    allowedBranch: 'main',
    requiredLabel: 'qa-platform-v2',
    appInstallationId: 88
  };
  const handler = createHandler({
    config,
    controller: {
      async queued(job) { processed.push(['queued', job.id]); },
      async completed(job) { processed.push(['completed', job.id]); }
    },
    dispatcher: {
      async enqueue(event, deliveryId) { queued.push({ event, deliveryId }); return true; }
    },
    webhookSecret: 'secret',
    verifyTask: async (authorization) => authorization === 'Bearer valid',
    logger: { info() {}, error() {} }
  });
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  context.after(() => server.close());
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const payload = Buffer.from(JSON.stringify({
    action: 'queued',
    organization: { id: 330211622, login: 'testingwithekki' },
    repository: { id: 1373784160, full_name: 'testingwithekki/team-create', owner: { id: 330211622 } },
    installation: { id: 88 },
    workflow_job: { id: 123, run_id: 456, head_branch: 'main', labels: ['self-hosted', 'qa-platform-v2'], created_at: '2026-09-20T00:00:00Z' }
  }));
  const signature = `sha256=${crypto.createHmac('sha256', 'secret').update(payload).digest('hex')}`;
  const webhook = await fetch(`${base}/github`, {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature, 'x-github-event': 'workflow_job', 'x-github-delivery': 'delivery-1' },
    body: payload
  });
  assert.equal(webhook.status, 202);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].deliveryId, 'delivery-1');
  assert.deepEqual(processed, []);

  const unauthorized = await fetch(`${base}/tasks`, { method: 'POST', body: JSON.stringify(queued[0].event) });
  assert.equal(unauthorized.status, 401);
  const task = await fetch(`${base}/tasks`, {
    method: 'POST',
    headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
    body: JSON.stringify(queued[0].event)
  });
  assert.equal(task.status, 200);
  assert.deepEqual(processed, [['queued', '123']]);
});
