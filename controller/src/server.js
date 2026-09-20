import http from 'node:http';
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { createHandler } from './app.js';
import { CloudResources } from './cloud.js';
import { loadConfig } from './config.js';
import { RunnerController } from './controller.js';
import { TaskDispatcher } from './dispatcher.js';
import { GitHubClient } from './github.js';
import { logger } from './logger.js';
import { RunnerState } from './state.js';

const config = loadConfig();
const cloud = new CloudResources(config);
const state = new RunnerState(new Firestore({ projectId: config.projectId }), config);
const github = new GitHubClient({
  organization: config.organization,
  appId: config.appId,
  apiVersion: config.githubApiVersion,
  privateKeyProvider: () => cloud.readSecret(config.appPrivateKeySecret)
});
const controller = new RunnerController({ config, state, github, cloud, logger });
const dispatcher = new TaskDispatcher(config);
const webhookSecret = await cloud.readSecret(config.webhookSecretName);
const oidc = new OAuth2Client();
const verifyCaller = (email, audience) => async (authorization) => {
  if (!audience || !email || !authorization?.startsWith('Bearer ')) return false;
  try {
    const ticket = await oidc.verifyIdToken({ idToken: authorization.slice(7), audience });
    return ticket.getPayload()?.email === email;
  } catch {
    return false;
  }
};

const server = http.createServer(createHandler({
  config,
  controller,
  dispatcher,
  webhookSecret,
  verifyReconciler: verifyCaller(config.reconcilerServiceAccount, config.reconcileAudience),
  verifyTask: verifyCaller(config.taskInvokerServiceAccount, config.taskAudience),
  logger
}));
server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
