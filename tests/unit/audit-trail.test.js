// ─── Unit Tests: AuditTrail ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AuditTrail } from '../../app/modules/audit-trail.js';

// ─── record ───────────────────────────────────────────────────────────────────

describe('AuditTrail – record', () => {
  it('generates id and timestamp automatically', () => {
    const trail = new AuditTrail();
    const before = Date.now();
    const event = trail.record({
      actor: 'user1',
      action: 'read',
      resource: 'doc/1',
      result: 'success',
    });
    const after = Date.now();

    assert.ok(typeof event.id === 'string' && event.id.length > 0);
    assert.ok(event.timestamp >= before && event.timestamp <= after);
  });

  it('returns the full AuditEvent with all supplied fields', () => {
    const trail = new AuditTrail();
    const event = trail.record({
      actor: 'alice',
      action: 'create',
      resource: 'file/readme.md',
      details: { size: 1024 },
      result: 'success',
    });

    assert.equal(event.actor, 'alice');
    assert.equal(event.action, 'create');
    assert.equal(event.resource, 'file/readme.md');
    assert.deepEqual(event.details, { size: 1024 });
    assert.equal(event.result, 'success');
  });

  it('records multiple events independently', () => {
    const trail = new AuditTrail();
    const e1 = trail.record({ actor: 'a', action: 'login', resource: 'auth', result: 'success' });
    const e2 = trail.record({ actor: 'b', action: 'login', resource: 'auth', result: 'failure' });
    assert.notEqual(e1.id, e2.id);
    assert.equal(trail.count, 2);
  });

  it('drops oldest when maxEvents exceeded', () => {
    const trail = new AuditTrail(3);
    trail.record({ actor: 'a', action: 'a1', resource: 'r', result: 'success' });
    trail.record({ actor: 'a', action: 'a2', resource: 'r', result: 'success' });
    trail.record({ actor: 'a', action: 'a3', resource: 'r', result: 'success' });
    trail.record({ actor: 'a', action: 'a4', resource: 'r', result: 'success' });
    assert.equal(trail.count, 3);
    const events = trail.query();
    assert.ok(!events.some((e) => e.action === 'a1'));
    assert.ok(events.some((e) => e.action === 'a4'));
  });
});

// ─── query ────────────────────────────────────────────────────────────────────

describe('AuditTrail – query', () => {
  it('no filter returns all events', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r1', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r2', result: 'failure' });
    assert.equal(trail.query().length, 2);
  });

  it('filter by actor', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'alice', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'bob', action: 'write', resource: 'r', result: 'success' });
    trail.record({ actor: 'alice', action: 'delete', resource: 'r', result: 'success' });
    const results = trail.query({ actor: 'alice' });
    assert.equal(results.length, 2);
    assert.ok(results.every((e) => e.actor === 'alice'));
  });

  it('filter by action', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r', result: 'success' });
    trail.record({ actor: 'c', action: 'read', resource: 'r', result: 'success' });
    const results = trail.query({ action: 'read' });
    assert.equal(results.length, 2);
    assert.ok(results.every((e) => e.action === 'read'));
  });

  it('filter by resource', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'doc/1', result: 'success' });
    trail.record({ actor: 'b', action: 'read', resource: 'doc/2', result: 'success' });
    const results = trail.query({ resource: 'doc/1' });
    assert.equal(results.length, 1);
    assert.equal(results[0].resource, 'doc/1');
  });

  it('filter by result', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r', result: 'failure' });
    trail.record({ actor: 'c', action: 'update', resource: 'r', result: 'pending' });
    const successes = trail.query({ result: 'success' });
    assert.equal(successes.length, 1);
    assert.equal(successes[0].result, 'success');
  });

  it('filter by since timestamp', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'old', resource: 'r', result: 'success' });
    const mid = Date.now();
    trail.record({ actor: 'b', action: 'new1', resource: 'r', result: 'success' });
    trail.record({ actor: 'c', action: 'new2', resource: 'r', result: 'success' });
    const results = trail.query({ since: mid });
    assert.ok(results.length >= 2);
    assert.ok(results.every((e) => e.timestamp >= mid));
  });

  it('filter by until timestamp', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'early', resource: 'r', result: 'success' });
    trail.record({ actor: 'b', action: 'early2', resource: 'r', result: 'success' });
    // Record the "late" event and use a cutoff strictly before its timestamp
    const lateEvent = trail.record({ actor: 'c', action: 'late', resource: 'r', result: 'success' });
    const cutoff = lateEvent.timestamp - 1;
    const results = trail.query({ until: cutoff });
    assert.ok(results.every((e) => e.timestamp <= cutoff));
    assert.ok(!results.some((e) => e.action === 'late'));
  });

  it('filter by limit', () => {
    const trail = new AuditTrail();
    for (let i = 0; i < 10; i++) {
      trail.record({ actor: 'a', action: 'act', resource: 'r', result: 'success' });
    }
    const results = trail.query({ limit: 4 });
    assert.equal(results.length, 4);
  });

  it('combined filters: actor + result', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'alice', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'alice', action: 'write', resource: 'r', result: 'failure' });
    trail.record({ actor: 'bob', action: 'read', resource: 'r', result: 'success' });
    const results = trail.query({ actor: 'alice', result: 'failure' });
    assert.equal(results.length, 1);
    assert.equal(results[0].action, 'write');
  });

  it('returns empty array when nothing matches', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r', result: 'success' });
    assert.equal(trail.query({ actor: 'nobody' }).length, 0);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('AuditTrail – count', () => {
  it('starts at 0', () => {
    const trail = new AuditTrail();
    assert.equal(trail.count, 0);
  });

  it('increments with each recorded event', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'x', resource: 'r', result: 'success' });
    assert.equal(trail.count, 1);
    trail.record({ actor: 'b', action: 'y', resource: 'r', result: 'success' });
    assert.equal(trail.count, 2);
  });

  it('resets to 0 after clear', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'x', resource: 'r', result: 'success' });
    trail.clear();
    assert.equal(trail.count, 0);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('AuditTrail – clear', () => {
  it('empties the trail', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r', result: 'success' });
    trail.clear();
    assert.equal(trail.count, 0);
    assert.deepEqual(trail.query(), []);
  });

  it('can record again after clear', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'x', resource: 'r', result: 'success' });
    trail.clear();
    trail.record({ actor: 'b', action: 'y', resource: 'r', result: 'pending' });
    assert.equal(trail.count, 1);
  });
});

// ─── summarize ────────────────────────────────────────────────────────────────

describe('AuditTrail – summarize', () => {
  it('returns empty object for empty trail', () => {
    const trail = new AuditTrail();
    assert.deepEqual(trail.summarize(), {});
  });

  it('counts each action correctly', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r', result: 'success' });
    trail.record({ actor: 'c', action: 'read', resource: 'r', result: 'success' });
    trail.record({ actor: 'd', action: 'delete', resource: 'r', result: 'failure' });
    trail.record({ actor: 'e', action: 'read', resource: 'r', result: 'success' });
    const summary = trail.summarize();
    assert.equal(summary['read'], 3);
    assert.equal(summary['write'], 1);
    assert.equal(summary['delete'], 1);
  });

  it('summary has one key per distinct action', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'login', resource: 'auth', result: 'success' });
    trail.record({ actor: 'b', action: 'login', resource: 'auth', result: 'failure' });
    const summary = trail.summarize();
    assert.deepEqual(Object.keys(summary), ['login']);
    assert.equal(summary['login'], 2);
  });
});

// ─── toCSV ────────────────────────────────────────────────────────────────────

describe('AuditTrail – toCSV', () => {
  it('returns just the header row for an empty trail', () => {
    const trail = new AuditTrail();
    const csv = trail.toCSV();
    assert.equal(csv, 'id,timestamp,actor,action,resource,result');
  });

  it('includes a header row as the first line', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'alice', action: 'read', resource: 'doc/1', result: 'success' });
    const lines = trail.toCSV().split('\n');
    assert.equal(lines[0], 'id,timestamp,actor,action,resource,result');
  });

  it('produces one row per event plus header', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'a', action: 'read', resource: 'r1', result: 'success' });
    trail.record({ actor: 'b', action: 'write', resource: 'r2', result: 'failure' });
    const lines = trail.toCSV().split('\n');
    assert.equal(lines.length, 3); // header + 2 rows
  });

  it('each data row has 6 comma-separated columns', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'alice', action: 'login', resource: 'auth', result: 'success' });
    const lines = trail.toCSV().split('\n');
    const dataLine = lines[1];
    // Split naively (no embedded commas in this test data)
    const cols = dataLine.split(',');
    assert.equal(cols.length, 6);
  });

  it('CSV row contains correct actor, action, resource, result values', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'bob', action: 'delete', resource: 'file/x', result: 'failure' });
    const lines = trail.toCSV().split('\n');
    const row = lines[1];
    assert.ok(row.includes('bob'));
    assert.ok(row.includes('delete'));
    assert.ok(row.includes('file/x'));
    assert.ok(row.includes('failure'));
  });

  it('quotes fields containing commas', () => {
    const trail = new AuditTrail();
    trail.record({ actor: 'last,first', action: 'read', resource: 'r', result: 'success' });
    const csv = trail.toCSV();
    assert.ok(csv.includes('"last,first"'));
  });
});
