import { createAppJwt } from './security.js';

export class GitHubClient {
  constructor({ organization, appId, apiVersion, privateKeyProvider, fetchImpl = fetch }) {
    this.organization = organization;
    this.appId = appId;
    this.apiVersion = apiVersion;
    this.privateKeyProvider = privateKeyProvider;
    this.fetch = fetchImpl;
  }

  async installationToken(installationId) {
    const jwt = createAppJwt(this.appId, await this.privateKeyProvider());
    const response = await this.fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: this.#headers(jwt)
    });
    return (await this.#json(response, 'create installation token')).token;
  }

  async createJitConfig({ installationId, runnerGroupId, runnerName, labels }) {
    const token = await this.installationToken(installationId);
    const response = await this.fetch(
      `https://api.github.com/orgs/${this.organization}/actions/runners/generate-jitconfig`,
      {
        method: 'POST',
        headers: { ...this.#headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: runnerName,
          runner_group_id: runnerGroupId,
          labels,
          work_folder: '_work'
        })
      }
    );
    return this.#json(response, 'create JIT runner configuration');
  }

  #headers(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': this.apiVersion,
      'User-Agent': 'testingwithekki-qa-platform-v2'
    };
  }

  async #json(response, operation) {
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`GitHub failed to ${operation}: ${response.status} ${detail}`);
    }
    return response.json();
  }
}
