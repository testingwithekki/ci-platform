export class RunnerController {
  constructor({ config, state, github, cloud, logger = console }) {
    this.config = config;
    this.state = state;
    this.github = github;
    this.cloud = cloud;
    this.logger = logger;
  }

  async queued(job) {
    await this.state.enqueue(job);
    await this.drain();
  }

  async completed(job) {
    const resources = await this.state.complete(job.id);
    if (resources && !this.config.preserveRunners) await this.cloud.cleanup(resources);
    await this.drain();
  }

  async drain() {
    for (;;) {
      const job = await this.state.reserveNext();
      if (!job) return;
      try {
        await this.#provision(job);
      } catch (error) {
        this.logger.error('Runner provisioning failed', { jobId: job.id, error: String(error) });
        await this.cloud.cleanup(job);
        await this.state.retry(job.id, error);
        return;
      }
    }
  }

  async reconcile(now = new Date()) {
    const before = new Date(now.getTime() - this.config.staleAfterMinutes * 60_000);
    for (const job of await this.state.staleJobs(before)) {
      if (this.config.preserveRunners) {
        await this.state.complete(job.id);
      } else {
        await this.cloud.cleanup(job);
        await this.state.retry(job.id, 'stale runner lease recovered by reconciler');
      }
    }
    await this.drain();
  }

  async #provision(job) {
    const vmName = `qa-v2-${job.id}`.slice(0, 63);
    const jit = await this.github.createJitConfig({
      installationId: job.installationId,
      runnerGroupId: this.config.runnerGroupId,
      runnerName: vmName,
      labels: [this.config.requiredLabel]
    });
    const jitSecretId = await this.cloud.createJitSecret(job.id, jit.encoded_jit_config);
    const resources = { vmName, jitSecretId, runnerId: String(jit.runner.id) };
    try {
      await this.cloud.createRunnerVm({ jobId: job.id, vmName, jitSecretId });
      await this.state.markRunning(job.id, resources);
    } catch (error) {
      await this.cloud.cleanup(resources);
      throw error;
    }
  }
}
