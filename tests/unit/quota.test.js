// ─── Unit Tests: Quota & Token Dispenser ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QuotaManager, TokenDispenser } from '../../app/modules/quota.js';

// ─── QuotaManager ─────────────────────────────────────────────────────────────

describe('QuotaManager – basic usage', () => {
  it('allows consumption within limit', () => {
    const qm = new QuotaManager({ limit: 5, windowMs: 10000 });
    const result = qm.consume('user:1');
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 4);
  });

  it('blocks consumption above limit', () => {
    const qm = new QuotaManager({ limit: 2, windowMs: 10000 });
    qm.consume('u');
    qm.consume('u');
    const result = qm.consume('u');
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it('tracks separate keys independently', () => {
    const qm = new QuotaManager({ limit: 3, windowMs: 10000 });
    qm.consume('a');
    qm.consume('a');
    qm.consume('b');
    assert.equal(qm.peek('a').count, 2);
    assert.equal(qm.peek('b').count, 1);
  });
});

describe('QuotaManager – window reset', () => {
  it('resets quota after window expires', () => {
    const qm = new QuotaManager({ limit: 1, windowMs: 1000 });
    qm.consume('u');
    assert.equal(qm.consume('u').allowed, false);
    qm.advance(1001);
    assert.equal(qm.consume('u').allowed, true);
  });

  it('manual reset clears the key', () => {
    const qm = new QuotaManager({ limit: 2, windowMs: 10000 });
    qm.consume('u');
    qm.consume('u');
    assert.equal(qm.consume('u').allowed, false);
    qm.reset('u');
    assert.equal(qm.consume('u').allowed, true);
  });
});

describe('QuotaManager – peek & keys', () => {
  it('peek returns count without consuming', () => {
    const qm = new QuotaManager({ limit: 10, windowMs: 5000 });
    qm.consume('x');
    const info = qm.peek('x');
    assert.equal(info.count, 1);
    assert.equal(info.remaining, 9);
  });

  it('keys() returns tracked keys', () => {
    const qm = new QuotaManager({ limit: 5, windowMs: 5000 });
    qm.consume('alice');
    qm.consume('bob');
    const ks = qm.keys().sort();
    assert.deepEqual(ks, ['alice', 'bob']);
  });
});

// ─── TokenDispenser ──────────────────────────────────────────────────────────

describe('TokenDispenser – basic', () => {
  it('starts with full bucket', () => {
    const td = new TokenDispenser({ tokensPerSecond: 10, maxTokens: 100 });
    assert.equal(td.tokens('u'), 100);
  });

  it('acquire deducts tokens', () => {
    const td = new TokenDispenser({ tokensPerSecond: 10, maxTokens: 100 });
    assert.equal(td.acquire('u', 30), true);
    assert.equal(td.tokens('u'), 70);
  });

  it('acquire fails when not enough tokens', () => {
    const td = new TokenDispenser({ tokensPerSecond: 1, maxTokens: 5 });
    td.acquire('u', 5);
    assert.equal(td.acquire('u', 1), false);
  });

  it('tokens refill over time', () => {
    const td = new TokenDispenser({ tokensPerSecond: 10, maxTokens: 20 });
    td.acquire('u', 10); // use half
    td.advance(500);     // 0.5s × 10/s = 5 refilled
    assert.ok(td.tokens('u') >= 14); // 10 + ~5 (may be exactly 15)
  });

  it('tokens capped at maxTokens', () => {
    const td = new TokenDispenser({ tokensPerSecond: 100, maxTokens: 50 });
    td.advance(10000); // would refill 1000 tokens but cap is 50
    assert.equal(td.tokens('u'), 50);
  });

  it('separate keys have independent buckets', () => {
    const td = new TokenDispenser({ tokensPerSecond: 10, maxTokens: 10 });
    td.acquire('a', 10);
    assert.equal(td.tokens('a'), 0);
    assert.equal(td.tokens('b'), 10);
  });
});
