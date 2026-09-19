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

export function createHandler({ config, controller, webhookSecret, verifyReconciler = async () => false, logger = console }) {
  return async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/healthz') return reply(response, 200, { ok: true });

      if (request.method === 'POST' && request.url === '/reconcile') {
        if (!(await verifyReconciler(request.headers.authorization))) return reply(response, 401, { error: 'unauthorized' });
        await controller.reconcile();
        return reply(response, 202, { accepted: true });
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
      if (decision.action === 'queued') await controller.queued(decision.job);
      else await controller.completed(decision.job);
      return reply(response, 202, { accepted: true, jobId: decision.job.id });
    } catch (error) {
      logger.error('Request failed', { error: String(error) });
      return reply(response, 500, { error: 'internal error' });
    }
  };
}
