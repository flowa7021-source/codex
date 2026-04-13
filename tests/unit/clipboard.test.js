// ─── Unit Tests: Clipboard API ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isClipboardSupported,
  copyText,
  readText,
  copyImage,
  getClipboardReadPermission,
} from '../../app/modules/clipboard.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

/** @type {{ writeText: Function|undefined, readText: Function|undefined, write: Function|undefined }} */
let clipboardMock;

beforeEach(() => {
  clipboardMock = {
    writeText: async (text) => { void text; },
    readText: async () => 'clipboard text',
    write: async (items) => { void items; },
  };
  globalThis.navigator.clipboard = clipboardMock;
  globalThis.ClipboardItem = class ClipboardItem {
    constructor(data) { this.data = data; }
  };
  globalThis.navigator.permissions = {
    query: async ({ name }) => { void name; return { state: 'granted' }; },
  };
});

afterEach(() => {
  delete globalThis.navigator.clipboard;
  delete globalThis.ClipboardItem;
  delete globalThis.navigator.permissions;
});

// ─── isClipboardSupported ────────────────────────────────────────────────────

describe('isClipboardSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isClipboardSupported(), 'boolean');
  });

  it('returns true when navigator.clipboard is present', () => {
    assert.equal(isClipboardSupported(), true);
  });

  it('returns false when navigator.clipboard is absent', () => {
    delete globalThis.navigator.clipboard;
    assert.equal(isClipboardSupported(), false);
  });
});

// ─── copyText ────────────────────────────────────────────────────────────────

describe('copyText', () => {
  it('returns true when writeText resolves', async () => {
    const result = await copyText('hello');
    assert.equal(result, true);
  });

  it('returns false when writeText rejects', async () => {
    clipboardMock.writeText = async () => { throw new Error('permission denied'); };
    const result = await copyText('hello');
    assert.equal(result, false);
  });

  it('returns false when clipboard is absent', async () => {
    delete globalThis.navigator.clipboard;
    const result = await copyText('hello');
    assert.equal(result, false);
  });

  it('passes the text string to writeText', async () => {
    const written = [];
    clipboardMock.writeText = async (text) => written.push(text);
    await copyText('test string');
    assert.equal(written.length, 1);
    assert.equal(written[0], 'test string');
  });
});

// ─── readText ────────────────────────────────────────────────────────────────

describe('readText', () => {
  it('returns a string when readText resolves', async () => {
    const result = await readText();
    assert.equal(typeof result, 'string');
    assert.equal(result, 'clipboard text');
  });

  it('returns null when readText rejects', async () => {
    clipboardMock.readText = async () => { throw new Error('not allowed'); };
    const result = await readText();
    assert.equal(result, null);
  });

  it('returns null when clipboard is absent', async () => {
    delete globalThis.navigator.clipboard;
    const result = await readText();
    assert.equal(result, null);
  });

  it('returns the resolved string value', async () => {
    clipboardMock.readText = async () => 'specific value';
    const result = await readText();
    assert.equal(result, 'specific value');
  });
});

// ─── copyImage ───────────────────────────────────────────────────────────────

describe('copyImage', () => {
  it('returns true when write resolves', async () => {
    const blob = new Blob();
    const result = await copyImage(blob);
    assert.equal(result, true);
  });

  it('returns false when write rejects', async () => {
    clipboardMock.write = async () => { throw new Error('not allowed'); };
    const blob = new Blob();
    const result = await copyImage(blob);
    assert.equal(result, false);
  });

  it('returns false when clipboard is absent', async () => {
    delete globalThis.navigator.clipboard;
    const blob = new Blob();
    const result = await copyImage(blob);
    assert.equal(result, false);
  });

  it('passes a ClipboardItem with image/png key to write', async () => {
    const written = [];
    clipboardMock.write = async (items) => written.push(...items);
    const blob = new Blob();
    await copyImage(blob);
    assert.equal(written.length, 1);
    assert.ok(written[0] instanceof globalThis.ClipboardItem);
    assert.deepEqual(written[0].data, { 'image/png': blob });
  });
});

// ─── getClipboardReadPermission ──────────────────────────────────────────────

describe('getClipboardReadPermission', () => {
  it('returns granted when permissions query returns granted', async () => {
    globalThis.navigator.permissions.query = async () => ({ state: 'granted' });
    const result = await getClipboardReadPermission();
    assert.equal(result, 'granted');
  });

  it('returns denied when permissions query returns denied', async () => {
    globalThis.navigator.permissions.query = async () => ({ state: 'denied' });
    const result = await getClipboardReadPermission();
    assert.equal(result, 'denied');
  });

  it('returns prompt when permissions query returns prompt', async () => {
    globalThis.navigator.permissions.query = async () => ({ state: 'prompt' });
    const result = await getClipboardReadPermission();
    assert.equal(result, 'prompt');
  });

  it('returns unknown when permissions query throws', async () => {
    globalThis.navigator.permissions.query = async () => { throw new Error('not supported'); };
    const result = await getClipboardReadPermission();
    assert.equal(result, 'unknown');
  });

  it('returns unknown when navigator.permissions is absent', async () => {
    delete globalThis.navigator.permissions;
    const result = await getClipboardReadPermission();
    assert.equal(result, 'unknown');
  });

  it('returns a known permission state string', async () => {
    const result = await getClipboardReadPermission();
    const valid = ['granted', 'denied', 'prompt', 'unknown'];
    assert.ok(valid.includes(result), `Expected one of ${valid.join(', ')}, got: ${result}`);
  });
});
