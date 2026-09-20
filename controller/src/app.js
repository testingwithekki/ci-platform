import { classifyWorkflowJob } from './policy.js';
import { verifyWebhookSignature } from './security.js';

function reply(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readBody(request, maxBytes = 1_000_000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createHandler({ config, controller, dispatcher, webhookSecret, verifyReconciler = async () => false, verifyTask = async () => false, logger = console }) {
  return async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/readyz') return reply(response, 200, { ok: true });

      if (request.method === 'POST' && request.url === '/reconcile') {
        if (!(await verifyReconciler(request.headers.authorization))) return reply(response, 401, { error: 'unauthorized' });
        await controller.reconcile();
        return reply(response, 202, { accepted: true });
      }

      if (request.method === 'POST' && request.url === '/tasks') {
        if (!(await verifyTask(request.headers.authorization))) return reply(response, 401, { error: 'unauthorized' });
        const event = JSON.parse((await readBody(request)).toString('utf8'));
        if (!['queued', 'completed'].includes(event?.action) || !event?.job?.id) {
          return reply(response, 400, { error: 'invalid task' });
        }
        await controller[event.action](event.job);
        return reply(response, 200, { processed: true, jobId: event.job.id });
      }

      if (request.method !== 'POST' || request.url !== '/github') return reply(response, 404, { error: 'not found' });
      const rawBody = await readBody(request);
      if (!verifyWebhookSignature(rawBody, request.headers['x-hub-signature-256'], webhookSecret)) {
        return reply(response, 401, { error: 'invalid signature' });
      }
      const event = request.headers['x-github-event'];
      if (event === 'ping') return reply(response, 200, { pong: true });
      if (event !== 'workflow_job') return reply(response, 202, { ignored: true });

      const decision = classifyWorkflowJob(JSON.parse(rawBody.toString('utf8')), config);
      if (!decision.accepted) return reply(response, 202, { ignored: true, reason: decision.reason });
      const deliveryId = request.headers['x-github-delivery'];
      if (typeof deliveryId !== 'string' || !deliveryId) return reply(response, 400, { error: 'missing delivery id' });
      const created = await dispatcher.enqueue({ action: decision.action, job: decision.job }, deliveryId);
      logger.info('GitHub event accepted', { deliveryId, action: decision.action, jobId: decision.job.id, duplicate: !created });
      return reply(response, 202, { accepted: true, duplicate: !created, jobId: decision.job.id });
    } catch (error) {
      logger.error('Request failed', { error: String(error) });
      return reply(response, 500, { error: 'internal error' });
    }
  };
}
