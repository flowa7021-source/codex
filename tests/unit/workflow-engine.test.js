// ─── Unit Tests: WorkflowEngine ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WorkflowEngine } from '../../app/modules/workflow-engine.js';

// ─── Sequential steps ─────────────────────────────────────────────────────────

describe('WorkflowEngine – sequential steps (dependency order)', () => {
  it('step2 runs after step1 when step2 depends on step1', async () => {
    const engine = new WorkflowEngine();
    const order = [];

    engine.addStep({
      id: 'step1',
      name: 'Step 1',
      fn: () => { order.push('step1'); return 'result1'; },
    });
    engine.addStep({
      id: 'step2',
      name: 'Step 2',
      depends: ['step1'],
      fn: () => { order.push('step2'); return 'result2'; },
    });

    const result = await engine.run();

    assert.deepEqual(order, ['step1', 'step2']);
    assert.equal(result.success, true);
  });

  it('results from earlier steps are available to later steps via context', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({
      id: 'producer',
      name: 'Producer',
      fn: () => 42,
    });
    engine.addStep({
      id: 'consumer',
      name: 'Consumer',
      depends: ['producer'],
      fn: (ctx) => ctx.results['producer'] * 2,
    });

    const result = await engine.run();

    assert.equal(result.context.results['producer'], 42);
    assert.equal(result.context.results['consumer'], 84);
    assert.equal(result.success, true);
  });

  it('three chained steps run in dependency order', async () => {
    const engine = new WorkflowEngine();
    const order = [];

    engine.addStep({ id: 'a', name: 'A', fn: () => { order.push('a'); } });
    engine.addStep({ id: 'b', name: 'B', depends: ['a'], fn: () => { order.push('b'); } });
    engine.addStep({ id: 'c', name: 'C', depends: ['b'], fn: () => { order.push('c'); } });

    await engine.run();
    assert.deepEqual(order, ['a', 'b', 'c']);
  });
});

// ─── Parallel steps ───────────────────────────────────────────────────────────

describe('WorkflowEngine – parallel steps', () => {
  it('two independent steps both complete successfully', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({ id: 'left', name: 'Left', fn: () => 'L' });
    engine.addStep({ id: 'right', name: 'Right', fn: () => 'R' });

    const result = await engine.run();

    assert.equal(result.success, true);
    assert.equal(result.context.results['left'], 'L');
    assert.equal(result.context.results['right'], 'R');
    assert.equal(result.stepStatuses['left'], 'completed');
    assert.equal(result.stepStatuses['right'], 'completed');
  });

  it('parallel steps share the same context object', async () => {
    const engine = new WorkflowEngine();
    const ctxRefs = [];

    engine.addStep({ id: 'p1', name: 'P1', fn: (ctx) => { ctxRefs.push(ctx); } });
    engine.addStep({ id: 'p2', name: 'P2', fn: (ctx) => { ctxRefs.push(ctx); } });

    await engine.run();

    assert.equal(ctxRefs.length, 2);
    assert.strictEqual(ctxRefs[0], ctxRefs[1]);
  });
});

// ─── Condition skip ───────────────────────────────────────────────────────────

describe('WorkflowEngine – condition skip', () => {
  it('step is skipped when condition returns false', async () => {
    const engine = new WorkflowEngine();
    let ran = false;

    engine.addStep({
      id: 'conditional',
      name: 'Conditional',
      condition: () => false,
      fn: () => { ran = true; },
    });

    const result = await engine.run();

    assert.equal(ran, false);
    assert.equal(result.stepStatuses['conditional'], 'skipped');
    assert.equal(result.success, true);
  });

  it('step runs when condition returns true', async () => {
    const engine = new WorkflowEngine();
    let ran = false;

    engine.addStep({
      id: 's',
      name: 'S',
      condition: () => true,
      fn: () => { ran = true; },
    });

    await engine.run();
    assert.equal(ran, true);
  });

  it('condition receives the workflow context', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({ id: 'base', name: 'Base', fn: () => 'hello' });
    engine.addStep({
      id: 'guarded',
      name: 'Guarded',
      depends: ['base'],
      condition: (ctx) => ctx.results['base'] === 'hello',
      fn: () => 'world',
    });

    const result = await engine.run();
    assert.equal(result.stepStatuses['guarded'], 'completed');
    assert.equal(result.context.results['guarded'], 'world');
  });

  it('downstream step is skipped when its dependency is skipped', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({
      id: 'parent',
      name: 'Parent',
      condition: () => false,
      fn: () => {},
    });
    engine.addStep({
      id: 'child',
      name: 'Child',
      depends: ['parent'],
      fn: () => {},
    });

    const result = await engine.run();
    assert.equal(result.stepStatuses['parent'], 'skipped');
    assert.equal(result.stepStatuses['child'], 'skipped');
  });
});

// ─── Failed step ──────────────────────────────────────────────────────────────

describe('WorkflowEngine – failed step marks workflow as failed', () => {
  it('workflow.success is false when a step throws', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({
      id: 'bad',
      name: 'Bad',
      fn: () => { throw new Error('boom'); },
    });

    const result = await engine.run();
    assert.equal(result.success, false);
    assert.equal(result.stepStatuses['bad'], 'failed');
    assert.ok(result.context.errors['bad'] instanceof Error);
    assert.equal(result.context.errors['bad'].message, 'boom');
  });

  it('other independent steps still run after a sibling fails', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({ id: 'bad', name: 'Bad', fn: () => { throw new Error('fail'); } });
    engine.addStep({ id: 'good', name: 'Good', fn: () => 'ok' });

    const result = await engine.run();
    assert.equal(result.stepStatuses['bad'], 'failed');
    assert.equal(result.stepStatuses['good'], 'completed');
    assert.equal(result.success, false);
  });

  it('dependent step is skipped when its dependency fails', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({ id: 'parent', name: 'Parent', fn: () => { throw new Error('nope'); } });
    engine.addStep({ id: 'child', name: 'Child', depends: ['parent'], fn: () => {} });

    const result = await engine.run();
    assert.equal(result.stepStatuses['parent'], 'failed');
    assert.equal(result.stepStatuses['child'], 'skipped');
  });
});

// ─── Results in context ───────────────────────────────────────────────────────

describe('WorkflowEngine – results available in context', () => {
  it('step result is stored in ctx.results[id]', async () => {
    const engine = new WorkflowEngine();
    engine.addStep({ id: 'calc', name: 'Calc', fn: () => 7 * 6 });

    const result = await engine.run();
    assert.equal(result.context.results['calc'], 42);
  });

  it('async step result is awaited and stored', async () => {
    const engine = new WorkflowEngine();
    engine.addStep({
      id: 'async',
      name: 'Async',
      fn: async () => {
        await Promise.resolve();
        return 'async-value';
      },
    });

    const result = await engine.run();
    assert.equal(result.context.results['async'], 'async-value');
  });

  it('initialMetadata is accessible in context.metadata', async () => {
    const engine = new WorkflowEngine();
    let seen;

    engine.addStep({
      id: 's',
      name: 'S',
      fn: (ctx) => { seen = ctx.metadata['env']; },
    });

    await engine.run({ env: 'test' });
    assert.equal(seen, 'test');
  });
});

// ─── Timeout ──────────────────────────────────────────────────────────────────

describe('WorkflowEngine – timeout causes failure', () => {
  it('step that exceeds its timeout is marked failed', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({
      id: 'slow',
      name: 'Slow',
      timeout: 20,
      fn: () => new Promise((resolve) => setTimeout(resolve, 200)),
    });

    const result = await engine.run();
    assert.equal(result.success, false);
    assert.equal(result.stepStatuses['slow'], 'failed');
    assert.ok(result.context.errors['slow'].message.includes('timed out'));
  });

  it('fast step completes before timeout', async () => {
    const engine = new WorkflowEngine();

    engine.addStep({
      id: 'fast',
      name: 'Fast',
      timeout: 500,
      fn: () => 'done',
    });

    const result = await engine.run();
    assert.equal(result.success, true);
    assert.equal(result.stepStatuses['fast'], 'completed');
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('WorkflowEngine – reset', () => {
  it('clears all steps so subsequent run returns success with no statuses', async () => {
    const engine = new WorkflowEngine();
    engine.addStep({ id: 's', name: 'S', fn: () => {} });
    engine.reset();

    const result = await engine.run();
    assert.equal(result.success, true);
    assert.deepEqual(result.stepStatuses, {});
  });
});

// ─── WorkflowResult shape ─────────────────────────────────────────────────────

describe('WorkflowEngine – WorkflowResult shape', () => {
  it('result has success, context, stepStatuses, and duration fields', async () => {
    const engine = new WorkflowEngine();
    engine.addStep({ id: 'x', name: 'X', fn: () => {} });

    const before = Date.now();
    const result = await engine.run();
    const after = Date.now();

    assert.equal(typeof result.success, 'boolean');
    assert.ok(result.context !== null && typeof result.context === 'object');
    assert.ok(typeof result.stepStatuses === 'object');
    assert.ok(result.duration >= 0 && result.duration <= after - before + 10);
  });
});
