// ─── Unit Tests: ProcessManager ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProcessManager } from '../../app/modules/process-manager.js';

// ─── start / get / getAll ─────────────────────────────────────────────────────

describe('ProcessManager – start / get / getAll', () => {
  it('start returns a string id', () => {
    const pm = new ProcessManager();
    const id = pm.start('task', () => Promise.resolve());
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('get returns the process immediately after start', () => {
    const pm = new ProcessManager();
    const id = pm.start('my-task', () => new Promise(() => {}));
    const proc = pm.get(id);
    assert.ok(proc !== undefined);
    assert.equal(proc.id, id);
    assert.equal(proc.name, 'my-task');
    assert.equal(proc.status, 'running');
    assert.ok(typeof proc.startedAt === 'number');
  });

  it('get returns undefined for unknown id', () => {
    const pm = new ProcessManager();
    assert.equal(pm.get('no-such-id'), undefined);
  });

  it('get returns a snapshot (mutating it does not affect internal state)', () => {
    const pm = new ProcessManager();
    const id = pm.start('t', () => new Promise(() => {}));
    const snap = pm.get(id);
    snap.name = 'modified';
    assert.equal(pm.get(id).name, 't');
  });

  it('getAll returns all registered processes', async () => {
    const pm = new ProcessManager();
    const id1 = pm.start('t1', () => Promise.resolve('a'));
    const id2 = pm.start('t2', () => Promise.resolve('b'));
    const all = pm.getAll();
    const ids = all.map((p) => p.id);
    assert.ok(ids.includes(id1));
    assert.ok(ids.includes(id2));
  });

  it('getAll returns snapshots', async () => {
    const pm = new ProcessManager();
    pm.start('t', () => Promise.resolve());
    const all = pm.getAll();
    assert.equal(all.length, 1);
  });

  it('process transitions to completed after fn resolves', async () => {
    const pm = new ProcessManager();
    const id = pm.start('finisher', () => Promise.resolve(99));
    await pm.waitFor(id);
    const proc = pm.get(id);
    assert.equal(proc.status, 'completed');
    assert.equal(proc.result, 99);
    assert.ok(typeof proc.completedAt === 'number');
  });

  it('process transitions to failed after fn rejects', async () => {
    const pm = new ProcessManager();
    const id = pm.start('crasher', () => Promise.reject(new Error('oops')));
    await pm.waitFor(id);
    const proc = pm.get(id);
    assert.equal(proc.status, 'failed');
    assert.ok(proc.error instanceof Error);
    assert.equal(proc.error.message, 'oops');
  });

  it('metadata is stored on the process', () => {
    const pm = new ProcessManager();
    const id = pm.start('meta-task', () => Promise.resolve(), { env: 'test', priority: 1 });
    const proc = pm.get(id);
    assert.deepEqual(proc.metadata, { env: 'test', priority: 1 });
  });
});

// ─── getByStatus ──────────────────────────────────────────────────────────────

describe('ProcessManager – getByStatus', () => {
  it('returns only processes matching the given status', async () => {
    const pm = new ProcessManager();
    const id1 = pm.start('t1', () => Promise.resolve());
    const id2 = pm.start('t2', () => new Promise(() => {})); // stays running

    await pm.waitFor(id1);

    const running = pm.getByStatus('running');
    const completed = pm.getByStatus('completed');

    assert.ok(running.every((p) => p.status === 'running'));
    assert.ok(completed.every((p) => p.status === 'completed'));
    assert.ok(running.some((p) => p.id === id2));
    assert.ok(completed.some((p) => p.id === id1));
  });

  it('returns empty array when no processes match', () => {
    const pm = new ProcessManager();
    assert.deepEqual(pm.getByStatus('idle'), []);
  });
});

// ─── waitFor ─────────────────────────────────────────────────────────────────

describe('ProcessManager – waitFor', () => {
  it('resolves with the final process snapshot when completed', async () => {
    const pm = new ProcessManager();
    const id = pm.start('w', () => Promise.resolve('value'));
    const proc = await pm.waitFor(id);
    assert.equal(proc.status, 'completed');
    assert.equal(proc.result, 'value');
  });

  it('resolves immediately if process is already completed', async () => {
    const pm = new ProcessManager();
    const id = pm.start('quick', () => Promise.resolve(1));
    await pm.waitFor(id); // first wait completes it
    const proc = await pm.waitFor(id); // second should resolve immediately
    assert.equal(proc.status, 'completed');
  });

  it('resolves (with failed status) when process rejects', async () => {
    const pm = new ProcessManager();
    const id = pm.start('fail', () => Promise.reject(new Error('bad')));
    const proc = await pm.waitFor(id);
    assert.equal(proc.status, 'failed');
    assert.ok(proc.error instanceof Error);
  });

  it('rejects for unknown process id', async () => {
    const pm = new ProcessManager();
    await assert.rejects(() => pm.waitFor('ghost'), /Process not found/);
  });

  it('multiple waitFor calls on the same id all resolve', async () => {
    const pm = new ProcessManager();
    const id = pm.start('multi-wait', () => Promise.resolve('done'));
    const [a, b, c] = await Promise.all([
      pm.waitFor(id),
      pm.waitFor(id),
      pm.waitFor(id),
    ]);
    assert.equal(a.status, 'completed');
    assert.equal(b.status, 'completed');
    assert.equal(c.status, 'completed');
  });
});

// ─── stop ─────────────────────────────────────────────────────────────────────

describe('ProcessManager – stop', () => {
  it('stop returns true and marks process as stopped', () => {
    const pm = new ProcessManager();
    const id = pm.start('s', () => new Promise(() => {}));
    const ok = pm.stop(id);
    assert.equal(ok, true);
    assert.equal(pm.get(id).status, 'stopped');
  });

  it('stop returns false for unknown id', () => {
    const pm = new ProcessManager();
    assert.equal(pm.stop('nope'), false);
  });

  it('stop returns false for an already-completed process', async () => {
    const pm = new ProcessManager();
    const id = pm.start('done', () => Promise.resolve());
    await pm.waitFor(id);
    assert.equal(pm.stop(id), false);
  });

  it('stopped process has a completedAt timestamp', () => {
    const pm = new ProcessManager();
    const before = Date.now();
    const id = pm.start('s', () => new Promise(() => {}));
    pm.stop(id);
    const after = Date.now();
    const proc = pm.get(id);
    assert.ok(proc.completedAt >= before && proc.completedAt <= after);
  });

  it('waitFor resolves when process is stopped', async () => {
    const pm = new ProcessManager();
    const id = pm.start('will-stop', () => new Promise(() => {}));
    const waitPromise = pm.waitFor(id);
    pm.stop(id);
    const proc = await waitPromise;
    assert.equal(proc.status, 'stopped');
  });
});

// ─── cleanup ──────────────────────────────────────────────────────────────────

describe('ProcessManager – cleanup', () => {
  it('removes completed and failed processes', async () => {
    const pm = new ProcessManager();
    const id1 = pm.start('good', () => Promise.resolve());
    const id2 = pm.start('bad', () => Promise.reject(new Error('x')));
    const id3 = pm.start('running', () => new Promise(() => {}));

    await Promise.all([pm.waitFor(id1), pm.waitFor(id2)]);

    pm.cleanup();

    assert.equal(pm.get(id1), undefined);
    assert.equal(pm.get(id2), undefined);
    assert.ok(pm.get(id3) !== undefined);
  });

  it('does not remove running or stopped processes', async () => {
    const pm = new ProcessManager();
    const idRun = pm.start('run', () => new Promise(() => {}));
    const idStopped = pm.start('stop', () => new Promise(() => {}));
    pm.stop(idStopped);

    pm.cleanup();

    assert.ok(pm.get(idRun) !== undefined);
    assert.ok(pm.get(idStopped) !== undefined);
  });

  it('cleanup on empty manager is a no-op', () => {
    const pm = new ProcessManager();
    assert.doesNotThrow(() => pm.cleanup());
  });
});

// ─── runningCount ─────────────────────────────────────────────────────────────

describe('ProcessManager – runningCount', () => {
  it('starts at 0', () => {
    const pm = new ProcessManager();
    assert.equal(pm.runningCount, 0);
  });

  it('increments when a process is started', () => {
    const pm = new ProcessManager();
    pm.start('t1', () => new Promise(() => {}));
    pm.start('t2', () => new Promise(() => {}));
    assert.equal(pm.runningCount, 2);
  });

  it('decrements when a process completes', async () => {
    const pm = new ProcessManager();
    const id = pm.start('t', () => Promise.resolve());
    await pm.waitFor(id);
    assert.equal(pm.runningCount, 0);
  });

  it('decrements when a process is stopped', () => {
    const pm = new ProcessManager();
    const id = pm.start('t', () => new Promise(() => {}));
    assert.equal(pm.runningCount, 1);
    pm.stop(id);
    assert.equal(pm.runningCount, 0);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('ProcessManager – subscribe', () => {
  it('callback is invoked on status change', async () => {
    const pm = new ProcessManager();
    const events = [];

    const id = pm.start('tracked', () => Promise.resolve('r'));
    pm.subscribe(id, (proc) => events.push(proc.status));

    await pm.waitFor(id);

    assert.ok(events.includes('completed'));
  });

  it('unsubscribe stops future notifications', async () => {
    const pm = new ProcessManager();
    const events = [];
    let resolveTask;

    const id = pm.start('t', () => new Promise((resolve) => { resolveTask = resolve; }));
    const unsub = pm.subscribe(id, (proc) => events.push(proc.status));

    unsub();
    resolveTask();
    await pm.waitFor(id);

    assert.equal(events.length, 0);
  });

  it('multiple subscribers all receive notifications', async () => {
    const pm = new ProcessManager();
    const a = [];
    const b = [];

    const id = pm.start('shared', () => Promise.resolve());
    pm.subscribe(id, (p) => a.push(p.status));
    pm.subscribe(id, (p) => b.push(p.status));

    await pm.waitFor(id);

    assert.ok(a.includes('completed'));
    assert.ok(b.includes('completed'));
  });

  it('subscribe on stop triggers callback', () => {
    const pm = new ProcessManager();
    const events = [];

    const id = pm.start('stoppable', () => new Promise(() => {}));
    pm.subscribe(id, (p) => events.push(p.status));
    pm.stop(id);

    assert.ok(events.includes('stopped'));
  });
});
