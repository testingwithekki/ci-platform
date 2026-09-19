import assert from 'node:assert/strict';
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
