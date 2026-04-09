// ─── Unit Tests: BatchProcessor ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BatchProcessor, createBatchProcessor } from '../../app/modules/batch-processor.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a process function that echoes each item back, optionally with a delay.
 * Tracks how many times it has been called and which batches it received.
 */
function makeEchoProcess(delayMs = 0) {
  const calls = [];
  const process = async (batch) => {
    calls.push([...batch]);
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
    return batch; // identity
  };
  return { process, calls };
}

/**
 * Build a process function that appends a suffix to each string item.
 */
function makeSuffixProcess(suffix, delayMs = 0) {
  const process = async (batch) => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    return batch.map(s => s + suffix);
  };
  return { process };
}

// ─── Basic add / result ───────────────────────────────────────────────────────

describe('BatchProcessor – add() returns correct result per item', () => {
  it('single item resolves with its processed result', async () => {
    const { process } = makeSuffixProcess('!');
    const bp = new BatchProcessor({ process, maxWait: 5 });
    const result = await bp.add('hello');
    assert.equal(result, 'hello!');
  });

  it('multiple items each resolve with their own result', async () => {
    const { process } = makeSuffixProcess('-done');
    const bp = new BatchProcessor({ process, batchSize: 10, maxWait: 5 });
    const [a, b, c] = await Promise.all([
      bp.add('x'),
      bp.add('y'),
      bp.add('z'),
    ]);
    assert.equal(a, 'x-done');
    assert.equal(b, 'y-done');
    assert.equal(c, 'z-done');
  });

  it('items added together are batched into one call', async () => {
    const { process, calls } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 10, maxWait: 5 });
    await Promise.all(['a', 'b', 'c'].map(item => bp.add(item)));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ['a', 'b', 'c']);
  });

  it('batch split occurs at batchSize boundary', async () => {
    const { process, calls } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 3, maxWait: 100 });

    // First 3 fill the batch immediately; 4th starts a new one
    const results = await Promise.all([
      bp.add('1'), bp.add('2'), bp.add('3'), // triggers flush at batchSize
    ]);
    assert.deepEqual(results, ['1', '2', '3']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].length, 3);
  });

  it('fourth item goes into a second batch after size-3 flush', async () => {
    const { process, calls } = makeEchoProcess(5);
    const bp = new BatchProcessor({ process, batchSize: 3, maxWait: 50 });

    const p1 = bp.add('a');
    const p2 = bp.add('b');
    const p3 = bp.add('c'); // triggers immediate flush
    const p4 = bp.add('d'); // lands in second batch

    const results = await Promise.all([p1, p2, p3, p4]);
    assert.deepEqual(results, ['a', 'b', 'c', 'd']);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], ['a', 'b', 'c']);
    assert.deepEqual(calls[1], ['d']);
  });

  it('items processed via maxWait timer are all resolved', async () => {
    const { process } = makeSuffixProcess('_ok');
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10 });
    const [r1, r2] = await Promise.all([bp.add('p'), bp.add('q')]);
    assert.equal(r1, 'p_ok');
    assert.equal(r2, 'q_ok');
  });
});

// ─── flush() ─────────────────────────────────────────────────────────────────

describe('BatchProcessor – flush()', () => {
  it('flush() dispatches pending items immediately', async () => {
    const { process, calls } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10000 });

    const p = bp.add('immediate');
    assert.equal(bp.pendingCount, 1);
    await bp.flush();
    assert.equal(calls.length, 1);
    assert.equal(await p, 'immediate');
  });

  it('flush() on an empty queue resolves without calling process', async () => {
    const { process, calls } = makeEchoProcess();
    const bp = new BatchProcessor({ process });
    await bp.flush(); // should not throw
    assert.equal(calls.length, 0);
  });

  it('flush() clears pendingCount', async () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10000 });
    bp.add('item1');
    bp.add('item2');
    assert.equal(bp.pendingCount, 2);
    await bp.flush();
    assert.equal(bp.pendingCount, 0);
  });

  it('multiple flush() calls are safe', async () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10000 });
    bp.add('x');
    await bp.flush();
    await bp.flush(); // second call — nothing pending
    // no assertion needed; just must not throw
  });
});

// ─── pendingCount / processingCount / totalProcessed ─────────────────────────

describe('BatchProcessor – counters', () => {
  it('pendingCount reflects queued items', async () => {
    const { process } = makeSuffixProcess('');
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10000 });
    bp.add('a');
    bp.add('b');
    assert.equal(bp.pendingCount, 2);
    await bp.flush();
    assert.equal(bp.pendingCount, 0);
  });

  it('totalProcessed increments after each batch', async () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process, batchSize: 3, maxWait: 5 });
    assert.equal(bp.totalProcessed, 0);

    await Promise.all([bp.add('a'), bp.add('b'), bp.add('c')]);
    assert.equal(bp.totalProcessed, 3);

    await Promise.all([bp.add('d'), bp.add('e')]);
    // Wait for the timer batch
    await new Promise(r => setTimeout(r, 20));
    assert.equal(bp.totalProcessed, 5);
  });

  it('processingCount is 0 when idle', () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process });
    assert.equal(bp.processingCount, 0);
  });
});

// ─── concurrency ─────────────────────────────────────────────────────────────

describe('BatchProcessor – concurrency', () => {
  it('concurrency=1 means only one batch in flight at a time', async () => {
    let maxConcurrent = 0;
    let current = 0;
    const process = async (batch) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(r => setTimeout(r, 10));
      current--;
      return batch;
    };
    const bp = new BatchProcessor({ process, batchSize: 2, maxWait: 5, concurrency: 1 });
    await Promise.all(['a', 'b', 'c', 'd'].map(item => bp.add(item)));
    assert.equal(maxConcurrent, 1);
  });

  it('concurrency=2 allows two batches in flight', async () => {
    let maxConcurrent = 0;
    let current = 0;
    const process = async (batch) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(r => setTimeout(r, 15));
      current--;
      return batch;
    };
    const bp = new BatchProcessor({ process, batchSize: 2, maxWait: 5, concurrency: 2 });
    await Promise.all(['a', 'b', 'c', 'd'].map(item => bp.add(item)));
    assert.ok(maxConcurrent <= 2, `Expected max concurrent <= 2, got ${maxConcurrent}`);
    assert.ok(maxConcurrent >= 1, 'Expected at least one concurrent batch');
  });
});

// ─── destroy() ───────────────────────────────────────────────────────────────

describe('BatchProcessor – destroy()', () => {
  it('destroy() rejects all pending items', async () => {
    const { process } = makeEchoProcess(100); // slow process
    const bp = new BatchProcessor({ process, batchSize: 100, maxWait: 10000 });

    const p1 = bp.add('x');
    const p2 = bp.add('y');
    bp.destroy();

    await assert.rejects(p1, /destroyed/);
    await assert.rejects(p2, /destroyed/);
  });

  it('add() after destroy() rejects immediately', async () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process });
    bp.destroy();
    await assert.rejects(bp.add('late'), /destroyed/);
  });

  it('destroy() on an empty processor is safe', () => {
    const { process } = makeEchoProcess();
    const bp = new BatchProcessor({ process });
    assert.doesNotThrow(() => bp.destroy());
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('BatchProcessor – error handling', () => {
  it('process() rejection propagates to each item in the batch', async () => {
    const process = async () => { throw new Error('batch failed'); };
    const bp = new BatchProcessor({ process, batchSize: 10, maxWait: 5 });
    const p1 = bp.add('a');
    const p2 = bp.add('b');
    await assert.rejects(p1, /batch failed/);
    await assert.rejects(p2, /batch failed/);
  });

  it('result count mismatch rejects all items with a descriptive error', async () => {
    // Returns only 1 result for a 2-item batch
    const process = async (batch) => batch.slice(0, 1);
    const bp = new BatchProcessor({ process, batchSize: 10, maxWait: 5 });
    const p1 = bp.add('a');
    const p2 = bp.add('b');
    await assert.rejects(p1, /returned 1 results for 2 items/);
    await assert.rejects(p2, /returned 1 results for 2 items/);
  });
});

// ─── createBatchProcessor factory ────────────────────────────────────────────

describe('createBatchProcessor – factory', () => {
  it('returns a BatchProcessor instance', () => {
    const bp = createBatchProcessor({ process: async (b) => b });
    assert.ok(bp instanceof BatchProcessor);
  });

  it('factory-created processor works end-to-end', async () => {
    const bp = createBatchProcessor({
      process: async (nums) => nums.map(n => n * 2),
      batchSize: 5,
      maxWait: 5,
    });
    const [r1, r2] = await Promise.all([bp.add(3), bp.add(7)]);
    assert.equal(r1, 6);
    assert.equal(r2, 14);
  });
});
