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

  async staleJobs(beforeDate) {
    const snapshot = await this.jobs.where('status', 'in', ['provisioning', 'running']).where('leaseAt', '<', beforeDate).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
