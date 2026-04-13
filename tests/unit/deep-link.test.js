// ─── Unit Tests: Deep Link Handling ──────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDeepLink,
  buildDeepLink,
  onDeepLink,
  dispatchDeepLink,
  getCurrentDeepLink,
} from '../../app/modules/deep-link.js';

// ─── Reset handler state between tests ───────────────────────────────────────

beforeEach(() => {
  globalThis.window.location.hash = '';
});

// ─── parseDeepLink ────────────────────────────────────────────────────────────

describe('parseDeepLink', () => {
  it('parses a URL with protocol, action, and params', () => {
    const result = parseDeepLink('myapp://open?file=test.pdf');
    assert.deepEqual(result, {
      protocol: 'myapp',
      action: 'open',
      params: { file: 'test.pdf' },
    });
  });

  it('parses a URL with multiple params', () => {
    const result = parseDeepLink('myapp://open?file=test.pdf&page=5');
    assert.ok(result !== null);
    assert.equal(result.protocol, 'myapp');
    assert.equal(result.action, 'open');
    assert.equal(result.params.file, 'test.pdf');
    assert.equal(result.params.page, '5');
  });

  it('parses a URL with action and no params', () => {
    const result = parseDeepLink('myapp://close');
    assert.deepEqual(result, {
      protocol: 'myapp',
      action: 'close',
      params: {},
    });
  });

  it('returns null for a URL without ://', () => {
    assert.equal(parseDeepLink('not-a-deep-link'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(parseDeepLink(''), null);
  });

  it('returns null for a regular https URL missing protocol before ://', () => {
    // '://' exists but no protocol before it
    assert.equal(parseDeepLink('://action'), null);
  });

  it('parses a deep link with an empty params string', () => {
    const result = parseDeepLink('app://view?');
    assert.ok(result !== null);
    assert.equal(result.action, 'view');
    assert.deepEqual(result.params, {});
  });
});

// ─── buildDeepLink ────────────────────────────────────────────────────────────

describe('buildDeepLink', () => {
  it('builds a URL from protocol, action, and params', () => {
    const url = buildDeepLink('myapp', 'open', { file: 'test.pdf' });
    assert.equal(url, 'myapp://open?file=test.pdf');
  });

  it('builds a URL without params', () => {
    const url = buildDeepLink('myapp', 'close');
    assert.equal(url, 'myapp://close');
  });

  it('builds a URL with empty params object', () => {
    const url = buildDeepLink('myapp', 'home', {});
    assert.equal(url, 'myapp://home');
  });

  it('builds a URL with multiple params', () => {
    const url = buildDeepLink('app', 'book', { id: '42', chapter: '3' });
    // URLSearchParams order is insertion order
    assert.ok(url.startsWith('app://book?'));
    assert.ok(url.includes('id=42'));
    assert.ok(url.includes('chapter=3'));
  });

  it('round-trips through parseDeepLink', () => {
    const built = buildDeepLink('nova', 'view', { page: '7' });
    const parsed = parseDeepLink(built);
    assert.ok(parsed !== null);
    assert.equal(parsed.protocol, 'nova');
    assert.equal(parsed.action, 'view');
    assert.deepEqual(parsed.params, { page: '7' });
  });
});

// ─── onDeepLink + dispatchDeepLink ───────────────────────────────────────────

describe('onDeepLink + dispatchDeepLink', () => {
  it('handler is called with correct params when dispatched', () => {
    const received = [];
    const unregister = onDeepLink('open', (params) => received.push(params));
    const handled = dispatchDeepLink('myapp://open?file=test.pdf');

    assert.equal(handled, true);
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { file: 'test.pdf' });

    unregister();
  });

  it('handler is called with empty params when no query string', () => {
    const received = [];
    const unregister = onDeepLink('close', (params) => received.push(params));
    dispatchDeepLink('myapp://close');

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], {});

    unregister();
  });

  it('returns false when no handler is registered for the action', () => {
    const result = dispatchDeepLink('myapp://unknown-action?x=1');
    assert.equal(result, false);
  });

  it('returns false for an invalid URL', () => {
    const result = dispatchDeepLink('not-a-deep-link');
    assert.equal(result, false);
  });

  it('only calls the handler registered for the matching action', () => {
    const openCalls = [];
    const closeCalls = [];
    const unregisterOpen = onDeepLink('open', (p) => openCalls.push(p));
    const unregisterClose = onDeepLink('close', (p) => closeCalls.push(p));

    dispatchDeepLink('myapp://open?file=a.pdf');

    assert.equal(openCalls.length, 1);
    assert.equal(closeCalls.length, 0);

    unregisterOpen();
    unregisterClose();
  });
});

// ─── onDeepLink unregister ────────────────────────────────────────────────────

describe('onDeepLink unregister', () => {
  it('handler is not called after unregister', () => {
    const received = [];
    const unregister = onDeepLink('open', (p) => received.push(p));

    dispatchDeepLink('myapp://open?file=first.pdf');
    assert.equal(received.length, 1);

    unregister();

    dispatchDeepLink('myapp://open?file=second.pdf');
    assert.equal(received.length, 1, 'handler should not fire after unregister');
  });

  it('unregister is safe to call multiple times', () => {
    const unregister = onDeepLink('test', () => {});
    assert.doesNotThrow(() => {
      unregister();
      unregister();
    });
  });
});

// ─── getCurrentDeepLink ───────────────────────────────────────────────────────

describe('getCurrentDeepLink', () => {
  it('returns null when hash is empty', () => {
    globalThis.window.location.hash = '';
    assert.equal(getCurrentDeepLink(), null);
  });

  it('returns null when hash does not start with deep-link:', () => {
    globalThis.window.location.hash = '#some-other-hash';
    assert.equal(getCurrentDeepLink(), null);
  });

  it('returns action and params when hash has deep-link: prefix', () => {
    globalThis.window.location.hash = '#deep-link:open?file=doc.pdf';
    const result = getCurrentDeepLink();
    assert.ok(result !== null);
    assert.equal(result.action, 'open');
    assert.deepEqual(result.params, { file: 'doc.pdf' });
  });

  it('returns action with empty params when no query string', () => {
    globalThis.window.location.hash = '#deep-link:close';
    const result = getCurrentDeepLink();
    assert.ok(result !== null);
    assert.equal(result.action, 'close');
    assert.deepEqual(result.params, {});
  });
});
