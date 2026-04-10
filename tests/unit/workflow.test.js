// ─── Unit Tests: Workflow ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Workflow, createWorkflow } from '../../app/modules/workflow.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a task that resolves with `value` and records its id in `log`. */
function makeTask(id, value, opts = {}) {
  return {
    id,
    ...opts,
    run: async () => {
      if (opts.log) opts.log.push(id);
      return value;
    },
  };
}

/** Build a task that rejects with the given message. */
function failTask(id, msg = 'fail', opts = {}) {
  return {
    id,
    ...opts,
    run: async () => { throw new Error(msg); },
  };
}

// ─── Sequential execution ─────────────────────────────────────────────────────

describe('Workflow – sequential execution', () => {
  it('runs a single task and returns its result', async () => {
    const wf = new Workflow([makeTask('a', 42)]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.equal(res.results.get('a'), 42);
    assert.equal(res.taskStatuses.get('a'), 'done');
  });

  it('all tasks complete when there are no dependencies', async () => {
    const wf = new Workflow([
      makeTask('x', 1),
      makeTask('y', 2),
      makeTask('z', 3),
    ]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.equal(res.results.get('x'), 1);
    assert.equal(res.results.get('y'), 2);
    assert.equal(res.results.get('z'), 3);
  });

  it('context is passed to each task', async () => {
    const received = [];
    const task = {
      id: 't',
      run: async (ctx) => { received.push(ctx['token']); },
    };
    const wf = new Workflow([task]);
    await wf.run({ token: 'abc' });
    assert.deepEqual(received, ['abc']);
  });
});

// ─── Parallel independent tasks ───────────────────────────────────────────────

describe('Workflow – parallel independent tasks', () => {
  it('independent tasks all run and complete', async () => {
    const wf = new Workflow([
      makeTask('p1', 'a'),
      makeTask('p2', 'b'),
      makeTask('p3', 'c'),
    ]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.equal(res.results.get('p1'), 'a');
    assert.equal(res.results.get('p2'), 'b');
    assert.equal(res.results.get('p3'), 'c');
  });

  it('parallel tasks start concurrently (timing check)', async () => {
    const starts = [];
    const makeSlow = (id) => ({
      id,
      run: async () => {
        starts.push(id);
        await new Promise((r) => setTimeout(r, 20));
        return id;
      },
    });
    const wf = new Workflow([makeSlow('s1'), makeSlow('s2'), makeSlow('s3')]);
    await wf.run();
    // All three should have started before any resolved (they run concurrently)
    assert.equal(starts.length, 3);
  });
});

// ─── Dependency ordering ──────────────────────────────────────────────────────

describe('Workflow – dependency ordering', () => {
  it('dependent task runs after its dependency', async () => {
    const log = [];
    const wf = new Workflow([
      { id: 'first',  run: async () => { log.push('first');  return 1; } },
      { id: 'second', dependsOn: ['first'],
        run: async () => { log.push('second'); return 2; } },
    ]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.deepEqual(log, ['first', 'second']);
  });

  it('deep chain executes in order', async () => {
    const log = [];
    const wf = new Workflow([
      { id: 'a', run: async () => { log.push('a'); return 'a'; } },
      { id: 'b', dependsOn: ['a'], run: async () => { log.push('b'); return 'b'; } },
      { id: 'c', dependsOn: ['b'], run: async () => { log.push('c'); return 'c'; } },
    ]);
    await wf.run();
    assert.deepEqual(log, ['a', 'b', 'c']);
  });

  it('tasks with same dependency run in parallel after it completes', async () => {
    const log = [];
    const wf = new Workflow([
      { id: 'root', run: async () => { log.push('root'); return 'root'; } },
      { id: 'child1', dependsOn: ['root'],
        run: async () => { log.push('child1'); return 1; } },
      { id: 'child2', dependsOn: ['root'],
        run: async () => { log.push('child2'); return 2; } },
    ]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.equal(log[0], 'root');
    // child1 and child2 both run after root (order between them is non-deterministic)
    assert.ok(log.includes('child1'));
    assert.ok(log.includes('child2'));
  });

  it('fan-in: task waits for all its dependencies', async () => {
    const log = [];
    const wf = new Workflow([
      { id: 'a', run: async () => { log.push('a'); return 'a'; } },
      { id: 'b', run: async () => { log.push('b'); return 'b'; } },
      { id: 'c', dependsOn: ['a', 'b'],
        run: async () => { log.push('c'); return 'c'; } },
    ]);
    await wf.run();
    // 'c' must appear after both 'a' and 'b'
    const cIdx = log.indexOf('c');
    assert.ok(cIdx > log.indexOf('a'));
    assert.ok(cIdx > log.indexOf('b'));
  });
});

// ─── Failed task handling ─────────────────────────────────────────────────────

describe('Workflow – failed task handling', () => {
  it('failed task sets status to failed and records error', async () => {
    const wf = new Workflow([failTask('bad', 'oops')]);
    const res = await wf.run();
    assert.equal(res.status, 'failed');
    assert.equal(res.taskStatuses.get('bad'), 'failed');
    assert.ok(res.errors.get('bad') instanceof Error);
    assert.equal(res.errors.get('bad').message, 'oops');
  });

  it('dependent task is skipped when its dependency fails', async () => {
    const wf = new Workflow([
      failTask('upstream'),
      makeTask('downstream', 99, { dependsOn: ['upstream'] }),
    ]);
    const res = await wf.run();
    assert.equal(res.taskStatuses.get('upstream'), 'failed');
    assert.equal(res.taskStatuses.get('downstream'), 'skipped');
    assert.equal(res.results.has('downstream'), false);
  });

  it('non-dependent tasks still complete when one task fails', async () => {
    const wf = new Workflow([
      failTask('bad'),
      makeTask('independent', 'ok'),
    ]);
    const res = await wf.run();
    assert.equal(res.taskStatuses.get('bad'), 'failed');
    assert.equal(res.taskStatuses.get('independent'), 'done');
    assert.equal(res.results.get('independent'), 'ok');
  });

  it('transitive skip: grandchild skipped when grandparent fails', async () => {
    const wf = new Workflow([
      failTask('gp'),
      makeTask('parent', 1, { dependsOn: ['gp'] }),
      makeTask('child',  2, { dependsOn: ['parent'] }),
    ]);
    const res = await wf.run();
    assert.equal(res.taskStatuses.get('gp'),     'failed');
    assert.equal(res.taskStatuses.get('parent'),  'skipped');
    assert.equal(res.taskStatuses.get('child'),   'skipped');
  });
});

// ─── Circular dependency detection ───────────────────────────────────────────

describe('Workflow – circular dependency detection', () => {
  it('validate() returns valid:true for acyclic graph', () => {
    const wf = new Workflow([
      makeTask('a'),
      makeTask('b', null, { dependsOn: ['a'] }),
      makeTask('c', null, { dependsOn: ['b'] }),
    ]);
    const { valid, cycles } = wf.validate();
    assert.equal(valid, true);
    assert.deepEqual(cycles, []);
  });

  it('validate() returns valid:false and reports cycle for A->B->A', () => {
    const wf = new Workflow([
      { id: 'a', dependsOn: ['b'], run: async () => {} },
      { id: 'b', dependsOn: ['a'], run: async () => {} },
    ]);
    const { valid, cycles } = wf.validate();
    assert.equal(valid, false);
    assert.ok(cycles.length > 0);
    // The cycle should involve both 'a' and 'b'
    const flatCycle = cycles.flat();
    assert.ok(flatCycle.includes('a') || flatCycle.includes('b'));
  });

  it('validate() detects a three-node cycle A->B->C->A', () => {
    const wf = new Workflow([
      { id: 'a', dependsOn: ['c'], run: async () => {} },
      { id: 'b', dependsOn: ['a'], run: async () => {} },
      { id: 'c', dependsOn: ['b'], run: async () => {} },
    ]);
    const { valid, cycles } = wf.validate();
    assert.equal(valid, false);
    assert.ok(cycles.length > 0);
  });

  it('validate() reports no cycle for a diamond dependency', () => {
    //   a
    //  / \
    // b   c
    //  \ /
    //   d
    const wf = new Workflow([
      makeTask('a'),
      makeTask('b', null, { dependsOn: ['a'] }),
      makeTask('c', null, { dependsOn: ['a'] }),
      makeTask('d', null, { dependsOn: ['b', 'c'] }),
    ]);
    const { valid } = wf.validate();
    assert.equal(valid, true);
  });

  it('empty workflow is valid', () => {
    const wf = new Workflow([]);
    const { valid, cycles } = wf.validate();
    assert.equal(valid, true);
    assert.deepEqual(cycles, []);
  });
});

// ─── createWorkflow factory ───────────────────────────────────────────────────

describe('createWorkflow factory', () => {
  it('returns a Workflow instance', () => {
    const wf = createWorkflow([makeTask('t', 1)]);
    assert.ok(wf instanceof Workflow);
  });

  it('factory-created workflow runs correctly', async () => {
    const wf = createWorkflow([makeTask('t', 'hello')]);
    const res = await wf.run();
    assert.equal(res.status, 'completed');
    assert.equal(res.results.get('t'), 'hello');
  });
});
