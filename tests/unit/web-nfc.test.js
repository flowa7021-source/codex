// ─── Unit Tests: Web NFC API ──────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNFCSupported,
  requestNFCPermission,
  startNFCRead,
  writeNFCText,
  writeNFCURL,
} from '../../app/modules/web-nfc.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

class MockNDEFReader extends EventTarget {
  constructor() {
    super();
    MockNDEFReader._instances.push(this);
    this._reads = [];
  }
  async scan(options) { this._scanning = true; }
  async write(message) { this._lastWrite = message; }
  static _instances = [];
  static reset() { MockNDEFReader._instances = []; }
}

beforeEach(() => {
  MockNDEFReader.reset();
  globalThis.NDEFReader = MockNDEFReader;
});

afterEach(() => {
  delete globalThis.NDEFReader;
});

// ─── isNFCSupported ──────────────────────────────────────────────────────────

describe('isNFCSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isNFCSupported(), 'boolean');
  });

  it('returns true when NDEFReader is present', () => {
    assert.equal(isNFCSupported(), true);
  });

  it('returns false when NDEFReader is absent', () => {
    delete globalThis.NDEFReader;
    assert.equal(isNFCSupported(), false);
  });
});

// ─── startNFCRead ─────────────────────────────────────────────────────────────

describe('startNFCRead', () => {
  it('returns a Promise that resolves to a function', async () => {
    const stop = await startNFCRead(() => {});
    assert.equal(typeof stop, 'function');
  });

  it('calls scan() on NDEFReader instance', async () => {
    await startNFCRead(() => {});
    assert.equal(MockNDEFReader._instances.length, 1);
    assert.equal(MockNDEFReader._instances[0]._scanning, true);
  });

  it('returns a stop function that does not throw', async () => {
    const stop = await startNFCRead(() => {});
    assert.doesNotThrow(() => stop());
  });

  it('returns a no-op stop function when NDEFReader is absent', async () => {
    delete globalThis.NDEFReader;
    const stop = await startNFCRead(() => {});
    assert.equal(typeof stop, 'function');
    assert.doesNotThrow(() => stop());
  });

  it('calls onRead when reading event fires', async () => {
    const messages = [];
    const stop = await startNFCRead((msg) => messages.push(msg));
    const reader = MockNDEFReader._instances[0];
    const fakeMessage = { records: [{ recordType: 'text', data: 'hello' }] };
    reader.dispatchEvent(Object.assign(new Event('reading'), { message: fakeMessage }));
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], fakeMessage);
    stop();
  });
});

// ─── writeNFCText ─────────────────────────────────────────────────────────────

describe('writeNFCText', () => {
  it('returns true when write resolves', async () => {
    const result = await writeNFCText('Hello NFC');
    assert.equal(result, true);
  });

  it('writes the correct record structure', async () => {
    await writeNFCText('Hello NFC', 'fr');
    const writer = MockNDEFReader._instances[0];
    assert.ok(writer._lastWrite);
    assert.equal(writer._lastWrite.records[0].recordType, 'text');
    assert.equal(writer._lastWrite.records[0].data, 'Hello NFC');
    assert.equal(writer._lastWrite.records[0].lang, 'fr');
  });

  it('defaults lang to "en" when not provided', async () => {
    await writeNFCText('Test');
    const writer = MockNDEFReader._instances[0];
    assert.equal(writer._lastWrite.records[0].lang, 'en');
  });

  it('returns false when NDEFReader is absent', async () => {
    delete globalThis.NDEFReader;
    const result = await writeNFCText('Hello');
    assert.equal(result, false);
  });

  it('returns false when write rejects', async () => {
    globalThis.NDEFReader = class extends EventTarget {
      async scan() {}
      async write() { throw new Error('write failed'); }
    };
    const result = await writeNFCText('Hello');
    assert.equal(result, false);
  });
});

// ─── writeNFCURL ──────────────────────────────────────────────────────────────

describe('writeNFCURL', () => {
  it('returns true when write resolves', async () => {
    const result = await writeNFCURL('https://example.com');
    assert.equal(result, true);
  });

  it('writes the correct record structure', async () => {
    await writeNFCURL('https://example.com');
    const writer = MockNDEFReader._instances[0];
    assert.ok(writer._lastWrite);
    assert.equal(writer._lastWrite.records[0].recordType, 'url');
    assert.equal(writer._lastWrite.records[0].data, 'https://example.com');
  });

  it('returns false when NDEFReader is absent', async () => {
    delete globalThis.NDEFReader;
    const result = await writeNFCURL('https://example.com');
    assert.equal(result, false);
  });

  it('returns false when write rejects', async () => {
    globalThis.NDEFReader = class extends EventTarget {
      async scan() {}
      async write() { throw new Error('write failed'); }
    };
    const result = await writeNFCURL('https://example.com');
    assert.equal(result, false);
  });
});

// ─── requestNFCPermission ────────────────────────────────────────────────────

describe('requestNFCPermission', () => {
  it('returns false when NDEFReader is absent', async () => {
    delete globalThis.NDEFReader;
    const result = await requestNFCPermission();
    assert.equal(result, false);
  });

  it('returns false when permissions.query rejects', async () => {
    globalThis.navigator.permissions = {
      query: async () => { throw new Error('permissions error'); },
    };
    const result = await requestNFCPermission();
    assert.equal(result, false);
    delete globalThis.navigator.permissions;
  });

  it('returns false when permission state is "prompt"', async () => {
    globalThis.navigator.permissions = {
      query: async () => ({ state: 'prompt' }),
    };
    const result = await requestNFCPermission();
    assert.equal(result, false);
    delete globalThis.navigator.permissions;
  });

  it('returns true when permission state is "granted"', async () => {
    globalThis.navigator.permissions = {
      query: async () => ({ state: 'granted' }),
    };
    const result = await requestNFCPermission();
    assert.equal(result, true);
    delete globalThis.navigator.permissions;
  });
});
