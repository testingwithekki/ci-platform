import { FieldValue } from '@google-cloud/firestore';

const ACTIVE = new Set(['provisioning', 'running']);

export class RunnerState {
  constructor(db, { maxRunners, collection = 'qaRunnerJobs' }) {
    this.db = db;
    this.maxRunners = maxRunners;
    this.jobs = db.collection(collection);
    this.capacity = db.collection('qaRunnerControl').doc('capacity');
  }

  async enqueue(job) {
    return this.db.runTransaction(async (tx) => {
      const ref = this.jobs.doc(job.id);
      const existing = await tx.get(ref);
      if (existing.exists) return false;
      tx.create(ref, { ...job, status: 'pending', attempts: 0, createdAt: FieldValue.serverTimestamp() });
      return true;
    });
  }

  async reserveNext() {
    return this.db.runTransaction(async (tx) => {
      const capacitySnapshot = await tx.get(this.capacity);
      const active = capacitySnapshot.exists ? capacitySnapshot.get('active') ?? 0 : 0;
      if (active >= this.maxRunners) return null;

      const pending = await tx.get(this.jobs.where('status', '==', 'pending').orderBy('queuedAt').limit(1));
      if (pending.empty) return null;
      const doc = pending.docs[0];
      tx.set(this.capacity, { active: active + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(doc.ref, { status: 'provisioning', leaseAt: FieldValue.serverTimestamp() });
      return { id: doc.id, ...doc.data() };
    });
  }

  async markRunning(jobId, resources) {
    await this.jobs.doc(jobId).update({
      status: 'running',
      ...resources,
      startedAt: FieldValue.serverTimestamp()
    });
  }

  async retry(jobId, error) {
    await this.db.runTransaction(async (tx) => {
      const ref = this.jobs.doc(jobId);
      const [job, capacity] = await Promise.all([tx.get(ref), tx.get(this.capacity)]);
      if (!job.exists || !ACTIVE.has(job.get('status'))) return;
      const active = Math.max(0, (capacity.get('active') ?? 1) - 1);
      tx.set(this.capacity, { active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(ref, {
        status: 'pending',
        attempts: FieldValue.increment(1),
        lastError: String(error).slice(0, 1000),
        leaseAt: FieldValue.delete()
      });
    });
  }

  async complete(jobId) {
    return this.db.runTransaction(async (tx) => {
      const ref = this.jobs.doc(jobId);
      const [job, capacity] = await Promise.all([tx.get(ref), tx.get(this.capacity)]);
      if (!job.exists) return null;
      const data = job.data();
      if (data.status === 'completed') return data;
      if (ACTIVE.has(data.status)) {
        const active = Math.max(0, (capacity.get('active') ?? 1) - 1);
        tx.set(this.capacity, { active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      tx.update(ref, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
      return data;
    });
  }

  async completeExecution(jobId, runnerId) {
    if (!runnerId) return this.complete(jobId);
    const runnerSnapshot = await this.jobs.where('runnerId', '==', String(runnerId)).limit(1).get();
    if (runnerSnapshot.empty) return this.complete(jobId);
    const leaseRef = runnerSnapshot.docs[0].ref;
    const actualRef = this.jobs.doc(jobId);

    return this.db.runTransaction(async (tx) => {
      const refs = leaseRef.path === actualRef.path ? [leaseRef, this.capacity] : [leaseRef, actualRef, this.capacity];
      const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
      const lease = snapshots[0];
      const actual = leaseRef.path === actualRef.path ? lease : snapshots[1];
      const capacity = snapshots[snapshots.length - 1];
      if (!lease.exists) return null;

      const resources = lease.data();
      if (ACTIVE.has(resources.status)) {
        const active = Math.max(0, (capacity.get('active') ?? 1) - 1);
        tx.set(this.capacity, { active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      if (leaseRef.path === actualRef.path) {
        tx.update(leaseRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
      } else {
        tx.update(leaseRef, {
          status: 'pending',
          attempts: FieldValue.increment(1),
          lastError: `runner was assigned by GitHub to workflow job ${jobId}`,
          leaseAt: FieldValue.delete(),
          startedAt: FieldValue.delete(),
          runnerId: FieldValue.delete(),
          vmName: FieldValue.delete(),
          jitSecretId: FieldValue.delete()
        });
        if (actual.exists && actual.get('status') !== 'completed') {
          tx.update(actualRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
        }
      }
      return resources;
    });
  }

  async staleJobs(beforeDate) {
    const snapshot = await this.jobs.where('status', 'in', ['provisioning', 'running']).where('leaseAt', '<', beforeDate).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
