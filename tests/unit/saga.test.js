// ─── Unit Tests: Saga ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Saga,
  createSaga,
} from '../../app/modules/saga.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A step that resolves successfully and appends its name to ctx.log. */
function makeStep(name, extraCtx = {}) {
  return {
    name,
    execute: async (ctx) => ({ ...ctx, ...extraCtx, log: [...(ctx.log ?? []), name] }),
    compensate: async (ctx) => ({ ...ctx, compensated: [...(ctx.compensated ?? []), name] }),
  };
}

/** A step whose execute always rejects. */
function makeFailingStep(name, message = 'step failed') {
  return {
    name,
    execute: async (_ctx) => { throw new Error(message); },
    compensate: async (ctx) => ({ ...ctx, compensated: [...(ctx.compensated ?? []), name] }),
  };
}

// ─── Saga ─────────────────────────────────────────────────────────────────────

describe('Saga', () => {
  it('stepCount returns the number of steps', () => {
    const saga = new Saga([makeStep('A'), makeStep('B'), makeStep('C')]);
    assert.equal(saga.stepCount, 3);
  });

  it('stepCount is 0 for an empty saga', () => {
    const saga = new Saga([]);
    assert.equal(saga.stepCount, 0);
  });

  it('execute() succeeds when all steps pass', async () => {
    const saga = new Saga([makeStep('A'), makeStep('B')]);
    const result = await saga.execute({ log: [] });
    assert.equal(result.success, true);
    assert.deepEqual(result.completedSteps, ['A', 'B']);
    assert.equal(result.failedStep, undefined);
    assert.equal(result.error, undefined);
  });

  it('execute() threads context through all steps', async () => {
    const steps = [
      {
        name: 'Double',
        execute: async (ctx) => ({ ...ctx, value: ctx.value * 2 }),
        compensate: async (ctx) => ctx,
      },
      {
        name: 'AddTen',
        execute: async (ctx) => ({ ...ctx, value: ctx.value + 10 }),
        compensate: async (ctx) => ctx,
      },
    ];
    const saga = new Saga(steps);
    const result = await saga.execute({ value: 5 });
    assert.equal(result.success, true);
    assert.equal(result.context.value, 20); // (5 * 2) + 10
  });

  it('execute() with no steps returns success immediately', async () => {
    const saga = new Saga([]);
    const result = await saga.execute({ data: 'initial' });
    assert.equal(result.success, true);
    assert.deepEqual(result.completedSteps, []);
    assert.deepEqual(result.context, { data: 'initial' });
  });

  it('execute() reports failedStep when a step throws', async () => {
    const saga = new Saga([makeStep('A'), makeFailingStep('B'), makeStep('C')]);
    const result = await saga.execute({ log: [] });
    assert.equal(result.success, false);
    assert.equal(result.failedStep, 'B');
  });

  it('execute() includes the error on failure', async () => {
    const saga = new Saga([makeFailingStep('Only', 'boom')]);
    const result = await saga.execute({});
    assert.equal(result.success, false);
    assert.ok(result.error instanceof Error);
    assert.equal(result.error.message, 'boom');
  });

  it('execute() runs compensations in reverse order on failure', async () => {
    const compensated = [];
    const steps = [
      {
        name: 'S1',
        execute: async (ctx) => ctx,
        compensate: async (ctx) => { compensated.push('S1'); return ctx; },
      },
      {
        name: 'S2',
        execute: async (ctx) => ctx,
        compensate: async (ctx) => { compensated.push('S2'); return ctx; },
      },
      {
        name: 'S3',
        execute: async (_ctx) => { throw new Error('fail at S3'); },
        compensate: async (ctx) => { compensated.push('S3'); return ctx; },
      },
    ];
    const saga = new Saga(steps);
    const result = await saga.execute({});
    assert.equal(result.success, false);
    // S3 never completed so it should not be compensated; S2 then S1
    assert.deepEqual(compensated, ['S2', 'S1']);
  });

  it('completedSteps only lists steps that actually completed before failure', async () => {
    const saga = new Saga([makeStep('A'), makeStep('B'), makeFailingStep('C')]);
    const result = await saga.execute({ log: [] });
    assert.deepEqual(result.completedSteps, ['A', 'B']);
  });

  it('execute() wraps non-Error throws into an Error', async () => {
    const saga = new Saga([
      {
        name: 'Bad',
        execute: async (_ctx) => { throw 'string error'; },
        compensate: async (ctx) => ctx,
      },
    ]);
    const result = await saga.execute({});
    assert.equal(result.success, false);
    assert.ok(result.error instanceof Error);
    assert.equal(result.error.message, 'string error');
  });

  it('execute() does not rethrow even if compensation also throws', async () => {
    const saga = new Saga([
      {
        name: 'GoodStep',
        execute: async (ctx) => ctx,
        compensate: async (_ctx) => { throw new Error('compensation failed'); },
      },
      {
        name: 'BadStep',
        execute: async (_ctx) => { throw new Error('step failed'); },
        compensate: async (ctx) => ctx,
      },
    ]);
    const result = await saga.execute({});
    // Should not throw — compensation errors are swallowed
    assert.equal(result.success, false);
    assert.equal(result.failedStep, 'BadStep');
  });

  it('first step failure triggers no compensations', async () => {
    const compensated = [];
    const saga = new Saga([
      {
        name: 'First',
        execute: async (_ctx) => { throw new Error('immediate fail'); },
        compensate: async (ctx) => { compensated.push('First'); return ctx; },
      },
    ]);
    await saga.execute({});
    assert.deepEqual(compensated, []);
  });

  it('execute() returns the compensated context after rollback', async () => {
    const steps = [
      {
        name: 'Reserve',
        execute: async (ctx) => ({ ...ctx, reserved: true }),
        compensate: async (ctx) => ({ ...ctx, reserved: false }),
      },
      {
        name: 'Charge',
        execute: async (_ctx) => { throw new Error('payment failed'); },
        compensate: async (ctx) => ({ ...ctx, charged: false }),
      },
    ];
    const saga = new Saga(steps);
    const result = await saga.execute({ reserved: false });
    assert.equal(result.success, false);
    assert.equal(result.context.reserved, false); // compensation ran
  });

  it('all steps completed are listed even for a single-step success', async () => {
    const saga = new Saga([makeStep('OnlyStep')]);
    const result = await saga.execute({ log: [] });
    assert.equal(result.success, true);
    assert.deepEqual(result.completedSteps, ['OnlyStep']);
  });
});

// ─── Factory Function ─────────────────────────────────────────────────────────

describe('createSaga()', () => {
  it('returns a Saga instance', () => {
    const saga = createSaga([]);
    assert.ok(saga instanceof Saga);
  });

  it('created saga works end-to-end', async () => {
    const saga = createSaga([
      {
        name: 'Init',
        execute: async (ctx) => ({ ...ctx, initialised: true }),
        compensate: async (ctx) => ctx,
      },
    ]);
    const result = await saga.execute({ initialised: false });
    assert.equal(result.success, true);
    assert.equal(result.context.initialised, true);
    assert.deepEqual(result.completedSteps, ['Init']);
  });

  it('created saga propagates step count', () => {
    const saga = createSaga([makeStep('A'), makeStep('B'), makeStep('C'), makeStep('D')]);
    assert.equal(saga.stepCount, 4);
  });
});

// ─── Integration scenarios ────────────────────────────────────────────────────

describe('Saga integration', () => {
  it('multi-step order workflow succeeds when all steps pass', async () => {
    const log = [];
    const saga = createSaga([
      {
        name: 'ValidateOrder',
        execute: async (ctx) => { log.push('validate'); return { ...ctx, validated: true }; },
        compensate: async (ctx) => ctx,
      },
      {
        name: 'ReserveStock',
        execute: async (ctx) => { log.push('reserve'); return { ...ctx, reserved: true }; },
        compensate: async (ctx) => { log.push('release'); return { ...ctx, reserved: false }; },
      },
      {
        name: 'ProcessPayment',
        execute: async (ctx) => { log.push('charge'); return { ...ctx, paid: true }; },
        compensate: async (ctx) => { log.push('refund'); return { ...ctx, paid: false }; },
      },
    ]);

    const result = await saga.execute({ orderId: 'O1' });
    assert.equal(result.success, true);
    assert.deepEqual(log, ['validate', 'reserve', 'charge']);
    assert.equal(result.context.paid, true);
    assert.equal(result.context.reserved, true);
  });

  it('multi-step order workflow compensates in reverse on payment failure', async () => {
    const log = [];
    const saga = createSaga([
      {
        name: 'ValidateOrder',
        execute: async (ctx) => { log.push('validate'); return ctx; },
        compensate: async (ctx) => { log.push('unvalidate'); return ctx; },
      },
      {
        name: 'ReserveStock',
        execute: async (ctx) => { log.push('reserve'); return ctx; },
        compensate: async (ctx) => { log.push('release'); return ctx; },
      },
      {
        name: 'ProcessPayment',
        execute: async (_ctx) => { throw new Error('card declined'); },
        compensate: async (ctx) => { log.push('refund'); return ctx; },
      },
    ]);

    const result = await saga.execute({ orderId: 'O2' });
    assert.equal(result.success, false);
    assert.equal(result.failedStep, 'ProcessPayment');
    assert.deepEqual(log, ['validate', 'reserve', 'release', 'unvalidate']);
  });
});
