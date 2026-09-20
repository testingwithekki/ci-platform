import { CloudTasksClient } from '@google-cloud/tasks';

function taskId(deliveryId) {
  return `github-${deliveryId}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 500);
}

export class TaskDispatcher {
  constructor(config, client = new CloudTasksClient()) {
    this.config = config;
    this.client = client;
  }

  async enqueue(event, deliveryId) {
    const parent = this.client.queuePath(this.config.projectId, this.config.taskLocation, this.config.taskQueue);
    const task = {
      name: this.client.taskPath(this.config.projectId, this.config.taskLocation, this.config.taskQueue, taskId(deliveryId)),
      httpRequest: {
        httpMethod: 'POST',
        url: this.config.taskTargetUrl,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(event)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: this.config.taskInvokerServiceAccount,
          audience: this.config.taskAudience
        }
      }
    };
    try {
      await this.client.createTask({ parent, task });
      return true;
    } catch (error) {
      if (error.code === 6) return false;
      throw error;
    }
  }
}
