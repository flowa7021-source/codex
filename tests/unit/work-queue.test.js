// ─── Unit Tests: WorkQueue ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WorkQueue } from '../../app/modules/work-queue.js';

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('new WorkQueue()', () => {
  it('creates an instance with default concurrency of 1', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    assert.ok(queue instanceof WorkQueue);
    assert.equal(queue.concurrency, 1);
  });

  it('respects a custom concurrency setting', () => {
    const queue = new WorkQueue({ processor: async () => {}, concurrency: 4 });
    assert.equal(queue.concurrency, 4);
  });
});

// ─── enqueue() ────────────────────────────────────────────────────────────────

describe('enqueue()', () => {
  it('returns a Job with pending status and correct data', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    const job = queue.enqueue({ page: 1 });

    assert.equal(job.status, 'pending');
    assert.deepEqual(job.data, { page: 1 });
    assert.equal(job.attempts, 0);
    assert.ok(typeof job.id === 'string');
    assert.ok(typeof job.createdAt === 'number');
  });

  it('uses a provided id', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    const job = queue.enqueue('hello', 'my-custom-id');
    assert.equal(job.id, 'my-custom-id');
  });

  it('generates unique ids when none are provided', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    const j1 = queue.enqueue('a');
    const j2 = queue.enqueue('b');
    assert.notEqual(j1.id, j2.id);
  });
});

// ─── getJobs() ────────────────────────────────────────────────────────────────

describe('getJobs()', () => {
  it('returns all enqueued jobs', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    queue.enqueue('x');
    queue.enqueue('y');
    queue.enqueue('z');
    assert.equal(queue.getJobs().length, 3);
  });

  it('returns an empty array when no jobs have been enqueued', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    assert.deepEqual(queue.getJobs(), []);
  });
});

// ─── getJob() ─────────────────────────────────────────────────────────────────

describe('getJob()', () => {
  it('returns the job matching the given id', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    const job = queue.enqueue('data', 'abc');
    assert.equal(queue.getJob('abc'), job);
  });

  it('returns undefined for an unknown id', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    assert.equal(queue.getJob('no-such-id'), undefined);
  });
});

// ─── getByStatus() ────────────────────────────────────────────────────────────

describe('getByStatus()', () => {
  it('filters jobs by status', () => {
    const queue = new WorkQueue({ processor: async () => {} });
    queue.enqueue('a', 'j1');
    queue.enqueue('b', 'j2');
    queue.enqueue('c', 'j3');

    assert.equal(queue.getByStatus('pending').length, 3);
    assert.equal(queue.getByStatus('running').length, 0);
    assert.equal(queue.getByStatus('done').length, 0);
    assert.equal(queue.getByStatus('failed').length, 0);
  });
});

// ─── start() + processor ─────────────────────────────────────────────────────

describe('start() + processor', () => {
  it('processes a job and sets status to done', async () => {
    const processed = [];
    const queue = new WorkQueue({
      processor: async (job) => { processed.push(job.data); },
    });

    const job = queue.enqueue('task-data');
    queue.start();
    await queue.drain();

    assert.deepEqual(processed, ['task-data']);
    assert.equal(job.status, 'done');
    assert.ok(typeof job.startedAt === 'number');
    assert.ok(typeof job.completedAt === 'number');
  });

  it('processes multiple jobs in FIFO order', async () => {
    const order = [];
    const queue = new WorkQueue({
      processor: async (job) => { order.push(job.data); },
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.start();
    await queue.drain();

    assert.deepEqual(order, [1, 2, 3]);
  });

  it('calls onJobComplete callback when a job finishes', async () => {
    const completed = [];
    const queue = new WorkQueue({
      processor: async () => {},
      onJobComplete: (job) => completed.push(job.id),
    });

    const job = queue.enqueue('x', 'done-job');
    queue.start();
    await queue.drain();

    assert.deepEqual(completed, ['done-job']);
    assert.equal(job.status, 'done');
  });
});

// ─── Failed jobs ──────────────────────────────────────────────────────────────

describe('failed jobs', () => {
  it('marks a job as failed when processor throws', async () => {
    const queue = new WorkQueue({
      processor: async () => { throw new Error('processing error'); },
    });

    const job = queue.enqueue('bad-data');
    queue.start();
    await queue.drain();

    assert.equal(job.status, 'failed');
    assert.equal(job.error, 'processing error');
    assert.ok(typeof job.completedAt === 'number');
  });

  it('calls onJobFail callback when a job fails', async () => {
    const failed = [];
    const queue = new WorkQueue({
      processor: async () => { throw new Error('fail'); },
      onJobFail: (job) => failed.push(job.id),
    });

    queue.enqueue('x', 'fail-job');
    queue.start();
    await queue.drain();

    assert.deepEqual(failed, ['fail-job']);
  });

  it('retries a job up to maxAttempts times before failing', async () => {
    let callCount = 0;
    const queue = new WorkQueue({
      processor: async () => {
        callCount++;
        throw new Error('retry me');
      },
      maxAttempts: 3,
    });

    const job = queue.enqueue('retry-data');
    queue.start();
    await queue.drain();

    assert.equal(callCount, 3);
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 3);
  });
});

// ─── stop() ───────────────────────────────────────────────────────────────────

describe('stop()', () => {
  it('stops processing new jobs; pending jobs remain', async () => {
    const processed = [];
    let resolveFirst;
    const firstStarted = new Promise((res) => { resolveFirst = res; });

    const queue = new WorkQueue({
      processor: async (job) => {
        if (job.data === 1) {
          resolveFirst();
          // Hold the first job open until we verify pending state
          await new Promise((res) => setTimeout(res, 20));
        }
        processed.push(job.data);
      },
    });

    queue.enqueue(1, 'j1');
    queue.enqueue(2, 'j2');
    queue.start();

    // Wait until job 1 has started, then stop the queue
    await firstStarted;
    queue.stop();

    // Let job 1 finish
    await new Promise((res) => setTimeout(res, 30));

    // Job 1 should be done; job 2 should still be pending
    assert.equal(queue.getJob('j1').status, 'done');
    assert.equal(queue.getJob('j2').status, 'pending');
    assert.deepEqual(processed, [1]);
  });
});

// ─── drain() ─────────────────────────────────────────────────────────────────

describe('drain()', () => {
  it('resolves immediately when there are no jobs', async () => {
    const queue = new WorkQueue({ processor: async () => {} });
    await queue.drain();
    assert.ok(true);
  });

  it('resolves after all jobs complete', async () => {
    const results = [];
    const queue = new WorkQueue({
      processor: async (job) => { results.push(job.data); },
    });

    queue.enqueue('a');
    queue.enqueue('b');
    queue.start();

    await queue.drain();
    assert.deepEqual(results, ['a', 'b']);
    assert.equal(queue.getByStatus('pending').length, 0);
    assert.equal(queue.getByStatus('running').length, 0);
  });

  it('resolves after all jobs complete including failed ones', async () => {
    const queue = new WorkQueue({
      processor: async (job) => {
        if (job.data === 'bad') throw new Error('fail');
      },
    });

    queue.enqueue('good', 'j1');
    queue.enqueue('bad', 'j2');
    queue.enqueue('good2', 'j3');
    queue.start();

    await queue.drain();

    assert.equal(queue.getJob('j1').status, 'done');
    assert.equal(queue.getJob('j2').status, 'failed');
    assert.equal(queue.getJob('j3').status, 'done');
  });
});

// ─── clearCompleted() ────────────────────────────────────────────────────────

describe('clearCompleted()', () => {
  it('removes done and failed jobs, leaves pending', async () => {
    const queue = new WorkQueue({
      processor: async (job) => {
        if (job.data === 'fail') throw new Error('x');
      },
    });

    queue.enqueue('ok', 'j-done');
    queue.enqueue('fail', 'j-fail');
    queue.start();
    await queue.drain();

    // Add a new pending job after draining
    queue.enqueue('pending-job', 'j-pending');

    queue.clearCompleted();

    assert.equal(queue.getJob('j-done'), undefined);
    assert.equal(queue.getJob('j-fail'), undefined);
    assert.ok(queue.getJob('j-pending'));
    assert.equal(queue.getJobs().length, 1);
  });
});

// ─── concurrency ─────────────────────────────────────────────────────────────

describe('WorkQueue – concurrency', () => {
  it('runs up to concurrency jobs in parallel', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const resolvers = [];

    const queue = new WorkQueue({
      processor: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((res) => resolvers.push(res));
        concurrent--;
      },
      concurrency: 3,
    });

    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');
    queue.enqueue('d');
    queue.start();

    // Let the event loop process the first tick
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(concurrent, 3);

    // Resolve all pending processors
    while (resolvers.length > 0) {
      resolvers.shift()();
      await Promise.resolve();
      await Promise.resolve();
    }

    await queue.drain();
    assert.equal(maxConcurrent, 3);
  });
});
