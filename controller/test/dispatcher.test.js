import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskDispatcher } from '../src/dispatcher.js';

class FakeTasks {
  constructor(error = null) { this.error = error; this.requests = []; }
  queuePath(project, location, queue) { return `${project}/${location}/${queue}`; }
  taskPath(project, location, queue, task) { return `${project}/${location}/${queue}/${task}`; }
  async createTask(request) { this.requests.push(request); if (this.error) throw this.error; }
}

const config = {
  projectId: 'project',
  taskLocation: 'us-central1',
  taskQueue: 'runner-events',
  taskTargetUrl: 'https://controller.example/tasks',
  taskInvokerServiceAccount: 'tasks@example.iam.gserviceaccount.com',
  taskAudience: 'https://controller.example/tasks'
};

test('creates an authenticated task with a delivery-id name', async () => {
  const client = new FakeTasks();
  const created = await new TaskDispatcher(config, client).enqueue({ action: 'queued', job: { id: '1' } }, 'abc-123');
  assert.equal(created, true);
  assert.equal(client.requests[0].task.name, 'project/us-central1/runner-events/github-abc-123');
  assert.equal(client.requests[0].task.httpRequest.oidcToken.serviceAccountEmail, config.taskInvokerServiceAccount);
  assert.deepEqual(JSON.parse(Buffer.from(client.requests[0].task.httpRequest.body, 'base64')), { action: 'queued', job: { id: '1' } });
});

test('treats an existing delivery task as an idempotent duplicate', async () => {
  const client = new FakeTasks(Object.assign(new Error('exists'), { code: 6 }));
  assert.equal(await new TaskDispatcher(config, client).enqueue({ action: 'queued', job: { id: '1' } }, 'same'), false);
});
