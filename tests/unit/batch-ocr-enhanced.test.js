import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { BatchOcrEngine } from '../../app/modules/batch-ocr-enhanced.js';

function makeEngine(overrides = {}) {
  return new BatchOcrEngine({
    ocrFn: async (pageNum) => ({ text: `text-${pageNum}`, confidence: 90 }),
    concurrency: 1,
    ...overrides,
  });
}

describe('BatchOcrEngine', () => {
  it('constructor sets defaults', () => {
    const engine = makeEngine();
    assert.equal(engine.concurrency, 1);
    assert.deepEqual(engine.jobs, []);
    assert.equal(engine.paused, false);
    assert.equal(engine.cancelled, false);
  });

  it('addPages adds jobs sorted by priority then page number', () => {
    const engine = makeEngine();
    engine.addPages([3, 1, 2], 0);
    assert.equal(engine.jobs.length, 3);
    assert.equal(engine.jobs[0].pageNum, 1);
    assert.equal(engine.jobs[1].pageNum, 2);
    assert.equal(engine.jobs[2].pageNum, 3);
  });

  it('addPages does not add duplicate page numbers', () => {
    const engine = makeEngine();
    engine.addPages([1, 2]);
    engine.addPages([2, 3]);
    assert.equal(engine.jobs.length, 3);
  });

  it('addPages respects priority ordering', () => {
    const engine = makeEngine();
    engine.addPages([1, 2], 0);
    engine.addPages([3], 10);
    // Page 3 has higher priority so should be first
    assert.equal(engine.jobs[0].pageNum, 3);
  });

  it('start processes all pages and resolves with jobs', async () => {
    const engine = makeEngine();
    engine.addPages([1, 2, 3]);
    const result = await engine.start();
    assert.equal(result.length, 3);
    assert.ok(result.every(j => j.status === 'done'));
  });

  it('cancel marks pending jobs as cancelled', async () => {
    let resolvers = [];
    const engine = new BatchOcrEngine({
      ocrFn: (pageNum) => new Promise((resolve) => {
        resolvers.push(() => resolve({ text: `p${pageNum}`, confidence: 80 }));
      }),
      concurrency: 1,
    });
    engine.addPages([1, 2, 3]);

    const promise = engine.start();
    // Wait for first job to start
    await new Promise(r => setTimeout(r, 10));

    engine.cancel();
    // Resolve running job
    if (resolvers.length > 0) resolvers[0]();
    await new Promise(r => setTimeout(r, 10));
    // Resolve remaining if any
    resolvers.forEach(r => r());

    const jobs = await promise;
    const cancelledJobs = jobs.filter(j => j.status === 'cancelled');
    assert.ok(cancelledJobs.length > 0, 'should have cancelled jobs');
  });

  it('getStatus returns correct summary', () => {
    const engine = makeEngine();
    engine.addPages([1, 2, 3]);
    const status = engine.getStatus();
    assert.equal(status.total, 3);
    assert.equal(status.pending, 3);
    assert.equal(status.done, 0);
    assert.equal(status.progress, 0);
  });

  it('getResults returns map of completed pages', async () => {
    const engine = makeEngine();
    engine.addPages([1, 2]);
    await engine.start();
    const results = engine.getResults();
    assert.equal(results.size, 2);
    assert.equal(results.get(1).text, 'text-1');
    assert.equal(results.get(2).text, 'text-2');
  });

  it('prioritize changes job priority and re-sorts', () => {
    const engine = makeEngine();
    engine.addPages([1, 2, 3], 0);
    engine.prioritize(3, 100);
    assert.equal(engine.jobs[0].pageNum, 3);
    assert.equal(engine.jobs[0].priority, 100);
  });

  it('handles OCR errors gracefully', async () => {
    const engine = new BatchOcrEngine({
      ocrFn: async () => { throw new Error('OCR failed'); },
      concurrency: 1,
    });
    engine.addPages([1]);
    const jobs = await engine.start();
    assert.equal(jobs[0].status, 'error');
    assert.equal(jobs[0].error, 'OCR failed');
  });
});
