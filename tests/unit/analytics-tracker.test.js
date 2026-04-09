// ─── Unit Tests: AnalyticsTracker ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsTracker } from '../../app/modules/analytics-tracker.js';

// ─── track ────────────────────────────────────────────────────────────────────

describe('AnalyticsTracker – track', () => {
  it('creates event with correct fields', () => {
    const tracker = new AnalyticsTracker({ sessionId: 'sess-1' });
    const before = Date.now();
    const event = tracker.track('page_view', { page: '/home' }, 'navigation');
    const after = Date.now();

    assert.ok(typeof event.id === 'string' && event.id.length > 0);
    assert.equal(event.name, 'page_view');
    assert.equal(event.category, 'navigation');
    assert.deepEqual(event.properties, { page: '/home' });
    assert.ok(event.timestamp >= before && event.timestamp <= after);
    assert.equal(event.sessionId, 'sess-1');
  });

  it('creates event without optional fields', () => {
    const tracker = new AnalyticsTracker();
    const event = tracker.track('click');

    assert.equal(event.name, 'click');
    assert.equal(event.category, undefined);
    assert.deepEqual(event.properties, {});
    assert.equal(event.sessionId, undefined);
  });

  it('each event has a unique id', () => {
    const tracker = new AnalyticsTracker();
    const e1 = tracker.track('event_a');
    const e2 = tracker.track('event_b');
    assert.notEqual(e1.id, e2.id);
  });
});

// ─── getEvents ────────────────────────────────────────────────────────────────

describe('AnalyticsTracker – getEvents', () => {
  it('returns all events with no filter', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a');
    tracker.track('b');
    tracker.track('c');
    assert.equal(tracker.getEvents().length, 3);
  });

  it('filter by name', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('click');
    tracker.track('view');
    tracker.track('click');
    const results = tracker.getEvents({ name: 'click' });
    assert.equal(results.length, 2);
    assert.ok(results.every((e) => e.name === 'click'));
  });

  it('filter by category', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a', {}, 'ui');
    tracker.track('b', {}, 'network');
    tracker.track('c', {}, 'ui');
    const results = tracker.getEvents({ category: 'ui' });
    assert.equal(results.length, 2);
    assert.ok(results.every((e) => e.category === 'ui'));
  });

  it('filter by since', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('old');
    const mid = Date.now();
    tracker.track('new1');
    tracker.track('new2');
    const results = tracker.getEvents({ since: mid });
    assert.ok(results.length >= 2);
    assert.ok(results.every((e) => e.timestamp >= mid));
  });

  it('filter by limit', () => {
    const tracker = new AnalyticsTracker();
    for (let i = 0; i < 10; i++) tracker.track('evt');
    const results = tracker.getEvents({ limit: 3 });
    assert.equal(results.length, 3);
  });

  it('combined filter: name + category', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('click', {}, 'ui');
    tracker.track('click', {}, 'other');
    tracker.track('view', {}, 'ui');
    const results = tracker.getEvents({ name: 'click', category: 'ui' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'click');
    assert.equal(results[0].category, 'ui');
  });

  it('returns empty array when nothing matches', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('click');
    assert.equal(tracker.getEvents({ name: 'nope' }).length, 0);
  });
});

// ─── getEventCount ────────────────────────────────────────────────────────────

describe('AnalyticsTracker – getEventCount', () => {
  it('returns correct count for an event name', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('click');
    tracker.track('view');
    tracker.track('click');
    tracker.track('click');
    assert.equal(tracker.getEventCount('click'), 3);
    assert.equal(tracker.getEventCount('view'), 1);
  });

  it('returns 0 for an event that has never been tracked', () => {
    const tracker = new AnalyticsTracker();
    assert.equal(tracker.getEventCount('missing'), 0);
  });
});

// ─── getSummary ───────────────────────────────────────────────────────────────

describe('AnalyticsTracker – getSummary', () => {
  it('returns empty object when no events tracked', () => {
    const tracker = new AnalyticsTracker();
    assert.deepEqual(tracker.getSummary(), {});
  });

  it('returns correct name to count map', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('click');
    tracker.track('view');
    tracker.track('click');
    tracker.track('submit');
    tracker.track('view');
    tracker.track('view');
    const summary = tracker.getSummary();
    assert.equal(summary['click'], 2);
    assert.equal(summary['view'], 3);
    assert.equal(summary['submit'], 1);
  });
});

// ─── getFunnel ────────────────────────────────────────────────────────────────

describe('AnalyticsTracker – getFunnel', () => {
  it('returns empty array for empty eventNames', () => {
    const tracker = new AnalyticsTracker();
    assert.deepEqual(tracker.getFunnel([]), []);
  });

  it('first step is 100% when events exist', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('signup');
    tracker.track('signup');
    tracker.track('verify');
    const funnel = tracker.getFunnel(['signup', 'verify']);
    assert.equal(funnel[0], 100);
  });

  it('calculates completion percentage at each step', () => {
    const tracker = new AnalyticsTracker();
    // 4 signups, 2 verifies, 1 purchase
    for (let i = 0; i < 4; i++) tracker.track('signup');
    for (let i = 0; i < 2; i++) tracker.track('verify');
    tracker.track('purchase');

    const funnel = tracker.getFunnel(['signup', 'verify', 'purchase']);
    assert.equal(funnel[0], 100);
    assert.equal(funnel[1], 50);
    assert.equal(funnel[2], 25);
  });

  it('returns all zeros when first step has 0 events', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('verify');
    const funnel = tracker.getFunnel(['signup', 'verify']);
    assert.deepEqual(funnel, [0, 0]);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('AnalyticsTracker – clear', () => {
  it('empties all events', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a');
    tracker.track('b');
    tracker.clear();
    assert.equal(tracker.totalEvents, 0);
    assert.deepEqual(tracker.getEvents(), []);
  });

  it('can track again after clear', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a');
    tracker.clear();
    tracker.track('b');
    assert.equal(tracker.totalEvents, 1);
  });
});

// ─── totalEvents ──────────────────────────────────────────────────────────────

describe('AnalyticsTracker – totalEvents', () => {
  it('starts at 0', () => {
    const tracker = new AnalyticsTracker();
    assert.equal(tracker.totalEvents, 0);
  });

  it('increments with each tracked event', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a');
    assert.equal(tracker.totalEvents, 1);
    tracker.track('b');
    assert.equal(tracker.totalEvents, 2);
  });

  it('resets to 0 after clear', () => {
    const tracker = new AnalyticsTracker();
    tracker.track('a');
    tracker.clear();
    assert.equal(tracker.totalEvents, 0);
  });
});

// ─── setGlobalProperties ──────────────────────────────────────────────────────

describe('AnalyticsTracker – setGlobalProperties', () => {
  it('merges global properties into every event', () => {
    const tracker = new AnalyticsTracker();
    tracker.setGlobalProperties({ app: 'nova', version: '1.0' });
    const event = tracker.track('page_view');
    assert.equal(event.properties['app'], 'nova');
    assert.equal(event.properties['version'], '1.0');
  });

  it('event-level properties override global properties', () => {
    const tracker = new AnalyticsTracker();
    tracker.setGlobalProperties({ env: 'prod' });
    const event = tracker.track('click', { env: 'test' });
    assert.equal(event.properties['env'], 'test');
  });

  it('calling setGlobalProperties multiple times merges cumulatively', () => {
    const tracker = new AnalyticsTracker();
    tracker.setGlobalProperties({ a: 1 });
    tracker.setGlobalProperties({ b: 2 });
    const event = tracker.track('x');
    assert.equal(event.properties['a'], 1);
    assert.equal(event.properties['b'], 2);
  });
});

// ─── maxEvents ────────────────────────────────────────────────────────────────

describe('AnalyticsTracker – maxEvents', () => {
  it('drops oldest events when limit is exceeded', () => {
    const tracker = new AnalyticsTracker({ maxEvents: 3 });
    tracker.track('first');
    tracker.track('second');
    tracker.track('third');
    tracker.track('fourth');

    assert.equal(tracker.totalEvents, 3);
    const events = tracker.getEvents();
    assert.ok(!events.some((e) => e.name === 'first'));
    assert.ok(events.some((e) => e.name === 'fourth'));
  });

  it('enforces limit on further additions', () => {
    const tracker = new AnalyticsTracker({ maxEvents: 2 });
    for (let i = 0; i < 10; i++) tracker.track(`evt-${i}`);
    assert.equal(tracker.totalEvents, 2);
  });
});
