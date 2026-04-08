// ─── Unit Tests: File System Access API ─────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We need to reset module-level state between tests, so we dynamically import.
// But first, clear any FSAPI stubs from window to get baseline behavior.
delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
delete /** @type {any} */ (globalThis.window).showSaveFilePicker;

const {
  isFsAccessSupported,
  openFilePicker,
  saveFile,
  getLastHandle,
  clearHandle,
} = await import('../../app/modules/fs-access.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a mock File object */
function makeFile(name = 'test.pdf', type = 'application/pdf') {
  const blob = new Blob(['%PDF-1.4'], { type });
  Object.defineProperty(blob, 'name', { value: name });
  return /** @type {File} */ (blob);
}

/** Create a mock FileSystemFileHandle */
function makeHandle(file) {
  const writtenChunks = [];
  return {
    getFile: async () => file,
    createWritable: async () => ({
      write: async (data) => { writtenChunks.push(data); },
      close: async () => {},
    }),
    _writtenChunks: writtenChunks,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('isFsAccessSupported', () => {
  afterEach(() => {
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
  });

  it('returns false when showOpenFilePicker is not on window', () => {
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
    assert.equal(isFsAccessSupported(), false);
  });

  it('returns true when showOpenFilePicker is on window', () => {
    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => [];
    assert.equal(isFsAccessSupported(), true);
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
  });
});

describe('getLastHandle / clearHandle', () => {
  it('getLastHandle returns null initially', () => {
    clearHandle();
    assert.equal(getLastHandle(), null);
  });

  it('clearHandle sets handle to null', () => {
    clearHandle();
    assert.equal(getLastHandle(), null);
  });
});

describe('openFilePicker – fallback (no FSAPI)', () => {
  beforeEach(() => {
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
    clearHandle();
  });

  it('returns file from input element when files are selected', async () => {
    // Intercept document.createElement to capture the input element
    const origCreate = globalThis.document.createElement;
    let capturedInput = null;

    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'input') {
        capturedInput = el;
        // Override click to simulate user selecting a file
        el.click = () => {
          const file = makeFile('doc.pdf');
          // Simulate FileList
          Object.defineProperty(el, 'files', {
            value: { length: 1, 0: file, item: (i) => file },
            configurable: true,
          });
          el.type = 'file';
          el.dispatchEvent(new Event('change'));
        };
      }
      return el;
    };

    try {
      const results = await openFilePicker();
      assert.equal(results.length, 1);
      assert.equal(results[0].file.name, 'doc.pdf');
      assert.equal(results[0].handle, null);
      assert.ok(capturedInput, 'Should have created an input element');
    } finally {
      globalThis.document.createElement = origCreate;
    }
  });

  it('returns empty array when no files selected', async () => {
    const origCreate = globalThis.document.createElement;

    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'input') {
        el.click = () => {
          Object.defineProperty(el, 'files', {
            value: { length: 0 },
            configurable: true,
          });
          el.dispatchEvent(new Event('change'));
        };
      }
      return el;
    };

    try {
      const results = await openFilePicker();
      assert.equal(results.length, 0);
    } finally {
      globalThis.document.createElement = origCreate;
    }
  });
});

describe('openFilePicker – with FSAPI mock', () => {
  afterEach(() => {
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
    clearHandle();
  });

  it('returns file and handle from native picker', async () => {
    const file = makeFile('report.pdf');
    const handle = makeHandle(file);

    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => [handle];

    const results = await openFilePicker();
    assert.equal(results.length, 1);
    assert.equal(results[0].file.name, 'report.pdf');
    assert.equal(results[0].handle, handle);
    assert.equal(getLastHandle(), handle);
  });

  it('returns empty array when user cancels (AbortError)', async () => {
    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => {
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    };

    const results = await openFilePicker();
    assert.equal(results.length, 0);
  });

  it('re-throws non-abort errors', async () => {
    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => {
      throw new TypeError('SecurityError');
    };

    await assert.rejects(() => openFilePicker(), { name: 'TypeError' });
  });
});

describe('saveFile – fallback (no FSAPI, no handle)', () => {
  beforeEach(() => {
    delete /** @type {any} */ (globalThis.window).showSaveFilePicker;
    clearHandle();
  });

  it('creates and clicks an anchor element', async () => {
    const origCreate = globalThis.document.createElement;
    let capturedAnchor = null;
    let anchorClicked = false;

    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        capturedAnchor = el;
        el.click = () => { anchorClicked = true; };
      }
      return el;
    };

    try {
      const blob = new Blob(['hello'], { type: 'text/plain' });
      const result = await saveFile(blob, 'output.pdf');
      assert.equal(result, true);
      assert.ok(capturedAnchor, 'Should have created an anchor element');
      assert.ok(anchorClicked, 'Should have clicked the anchor');
      assert.equal(capturedAnchor.getAttribute('download'), 'output.pdf');
    } finally {
      globalThis.document.createElement = origCreate;
    }
  });
});

describe('saveFile – with stored handle', () => {
  afterEach(() => {
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;
    clearHandle();
  });

  it('uses createWritable on stored handle', async () => {
    const file = makeFile('existing.pdf');
    const handle = makeHandle(file);

    // Simulate opening a file to store the handle
    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => [handle];
    await openFilePicker();

    assert.equal(getLastHandle(), handle);

    const blob = new Blob(['updated content'], { type: 'application/pdf' });
    const result = await saveFile(blob, 'existing.pdf');
    assert.equal(result, true);
    assert.equal(handle._writtenChunks.length, 1);
    assert.equal(handle._writtenChunks[0], blob);
  });

  it('falls through if createWritable fails', async () => {
    const file = makeFile('broken.pdf');
    const brokenHandle = {
      getFile: async () => file,
      createWritable: async () => { throw new Error('permission denied'); },
    };

    // Store the broken handle
    /** @type {any} */ (globalThis.window).showOpenFilePicker = async () => [brokenHandle];
    await openFilePicker();
    delete /** @type {any} */ (globalThis.window).showOpenFilePicker;

    // Should fall through to anchor fallback
    const origCreate = globalThis.document.createElement;
    let anchorClicked = false;
    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = () => { anchorClicked = true; };
      }
      return el;
    };

    try {
      const blob = new Blob(['data'], { type: 'application/pdf' });
      const result = await saveFile(blob, 'broken.pdf');
      assert.equal(result, true);
      assert.ok(anchorClicked, 'Should fall through to anchor download');
    } finally {
      globalThis.document.createElement = origCreate;
    }
  });
});

describe('saveFile – with showSaveFilePicker', () => {
  afterEach(() => {
    delete /** @type {any} */ (globalThis.window).showSaveFilePicker;
    clearHandle();
  });

  it('uses native save picker when available', async () => {
    const writtenChunks = [];
    const savedHandle = {
      createWritable: async () => ({
        write: async (data) => { writtenChunks.push(data); },
        close: async () => {},
      }),
    };

    /** @type {any} */ (globalThis.window).showSaveFilePicker = async (opts) => {
      assert.equal(opts.suggestedName, 'export.pdf');
      return savedHandle;
    };

    const blob = new Blob(['pdf data'], { type: 'application/pdf' });
    const result = await saveFile(blob, 'export.pdf');
    assert.equal(result, true);
    assert.equal(writtenChunks.length, 1);
    assert.equal(getLastHandle(), savedHandle);
  });

  it('returns false when user cancels save picker', async () => {
    /** @type {any} */ (globalThis.window).showSaveFilePicker = async () => {
      const err = new Error('cancelled');
      err.name = 'AbortError';
      throw err;
    };

    const blob = new Blob(['data'], { type: 'text/plain' });
    const result = await saveFile(blob, 'test.txt');
    assert.equal(result, false);
  });
});
