import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleAuth } from 'google-auth-library';

export class CloudResources {
  constructor(config, { secrets = new SecretManagerServiceClient(), auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }) } = {}) {
    this.config = config;
    this.secrets = secrets;
    this.auth = auth;
  }

  async readSecret(secretId) {
    const [version] = await this.secrets.accessSecretVersion({
      name: `projects/${this.config.projectId}/secrets/${secretId}/versions/latest`
    });
    return version.payload.data.toString('utf8');
  }

  async createJitSecret(jobId, encodedConfig) {
    const secretId = `qa-v2-jit-${jobId}`;
    const parent = `projects/${this.config.projectId}`;
    const [secret] = await this.secrets.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} }, labels: { component: 'qa-runner-jit' } }
    });
    await this.secrets.addSecretVersion({ parent: secret.name, payload: { data: Buffer.from(encodedConfig) } });
    await this.secrets.setIamPolicy({
      resource: secret.name,
      policy: {
        bindings: [{ role: 'roles/secretmanager.secretAccessor', members: [`serviceAccount:${this.config.runnerServiceAccount}`] }]
      }
    });
    return secretId;
  }

  async createRunnerVm({ jobId, vmName, jitSecretId }) {
    const c = this.config;
    const startup = `#!/bin/bash\nset -euo pipefail\ncurl -fsSL https://raw.githubusercontent.com/testingwithekki/ci-platform/main/runner-v2/jit-bootstrap.sh -o /tmp/jit-bootstrap.sh\nchmod 700 /tmp/jit-bootstrap.sh\nexec /tmp/jit-bootstrap.sh\n`;
    const body = {
      name: vmName,
      machineType: `zones/${c.zone}/machineTypes/${c.machineType}`,
      labels: { component: 'qa-v2-runner', job: jobId },
      disks: [{ boot: true, autoDelete: true, initializeParams: { sourceImage: 'projects/debian-cloud/global/images/family/debian-12', diskSizeGb: '20', diskType: `zones/${c.zone}/diskTypes/pd-balanced` } }],
      networkInterfaces: [{ subnetwork: c.subnetwork, accessConfigs: [{ name: 'External NAT', type: 'ONE_TO_ONE_NAT' }] }],
      serviceAccounts: [{ email: c.runnerServiceAccount, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }],
      metadata: { items: [{ key: 'startup-script', value: startup }, { key: 'jit-secret-id', value: jitSecretId }] },
      scheduling: { maxRunDuration: { seconds: '2700' }, instanceTerminationAction: 'DELETE', provisioningModel: 'STANDARD' },
      shieldedInstanceConfig: { enableSecureBoot: true, enableVtpm: true, enableIntegrityMonitoring: true },
      deletionProtection: false
    };
    await this.#request('POST', `https://compute.googleapis.com/compute/v1/projects/${c.projectId}/zones/${c.zone}/instances`, body);
  }

  async cleanup({ vmName, jitSecretId }) {
    const tasks = [];
    if (vmName) tasks.push(this.#request('DELETE', `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/zones/${this.config.zone}/instances/${vmName}`, undefined, [404]));
    if (jitSecretId) tasks.push(this.secrets.deleteSecret({ name: `projects/${this.config.projectId}/secrets/${jitSecretId}` }).catch((error) => {
      if (error.code !== 5) throw error;
    }));
    const results = await Promise.allSettled(tasks);
    const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Runner cleanup did not fully complete');
  }

  async #request(method, url, data, ignoredStatuses = []) {
    try {
      const client = await this.auth.getClient();
      return await client.request({ method, url, data });
    } catch (error) {
      if (ignoredStatuses.includes(error.response?.status)) return null;
      throw error;
    }
  }
}
