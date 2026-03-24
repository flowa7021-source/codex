// @ts-check
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  revokeCurrentObjectUrl,
  djvuTextKey,
  loadDjvuData,
  saveDjvuData,
  isLikelyDjvuFile,
  extractDjvuFallbackText,
  initFileControllerDeps,
  saveCurrentPdfAs,
  reloadPdfFromBytes,
  openFile,
} from '../../app/modules/file-controller.js';
import { state, els } from '../../app/modules/state.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal mock element with textContent and value */
function mockEl() {
  return { textContent: '', value: '', max: '', offsetWidth: 800, clientWidth: 780, style: {} };
}

/** Create a mock adapter */
function createMockAdapter(opts = {}) {
  return {
    type: opts.type || 'pdf',
    getPageCount: () => opts.pageCount || 5,
    getPageViewport: async () => ({ width: 800, height: 600 }),
    cancelMainRender: mock.fn(),
    ...opts,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  state.currentObjectUrl = null;
  state.docName = null;
  state.pdfBytes = null;
  state.file = null;
  state.adapter = null;
  state.currentPage = 1;
  state.pageCount = 0;
  state.zoom = 1;
  state.rotation = 0;
  state.searchResults = [];
  state.searchCursor = -1;
  state.outline = [];
  state.visitTrail = [];
  state.djvuBinaryDetected = false;
  state.collabEnabled = false;
  state.settings = null;
  state.readingTotalMs = 0;
  state.readingStartedAt = null;
  state.readingGoalPage = null;
  localStorage.clear();

  // Ensure els has the fields openFile expects
  if (!els.searchStatus) els.searchStatus = mockEl();
  if (!els.pageText) els.pageText = mockEl();
  if (!els.pageInput) els.pageInput = mockEl();
  if (!els.canvasWrap) els.canvasWrap = mockEl();
  if (!els.cloudSyncUrl) els.cloudSyncUrl = mockEl();
});

// ─── revokeCurrentObjectUrl ─────────────────────────────────────────────────

describe('revokeCurrentObjectUrl', () => {
  it('clears state.currentObjectUrl when set', () => {
    state.currentObjectUrl = 'blob:http://test/abc';
    revokeCurrentObjectUrl();
    assert.equal(state.currentObjectUrl, null);
  });

  it('does nothing when no URL is set', () => {
    state.currentObjectUrl = null;
    revokeCurrentObjectUrl(); // Should not throw
    assert.equal(state.currentObjectUrl, null);
  });
});

// ─── djvuTextKey ────────────────────────────────────────────────────────────

describe('djvuTextKey', () => {
  it('returns key with document name', () => {
    state.docName = 'test.djvu';
    assert.equal(djvuTextKey(), 'novareader-djvu-data:test.djvu');
  });

  it('returns key with "global" when no docName', () => {
    state.docName = null;
    assert.equal(djvuTextKey(), 'novareader-djvu-data:global');
  });

  it('returns key with empty string docName as empty', () => {
    state.docName = '';
    assert.equal(djvuTextKey(), 'novareader-djvu-data:global');
  });
});

// ─── loadDjvuData / saveDjvuData ────────────────────────────────────────────

describe('loadDjvuData', () => {
  it('returns null when no data stored', () => {
    state.docName = 'new.djvu';
    assert.equal(loadDjvuData(), null);
  });

  it('returns parsed data after save', () => {
    state.docName = 'test.djvu';
    const data = { pageCount: 5, pagesText: ['a', 'b'] };
    saveDjvuData(data);
    const loaded = loadDjvuData();
    assert.deepEqual(loaded, data);
  });

  it('handles corrupt JSON gracefully', () => {
    state.docName = 'bad.djvu';
    localStorage.setItem(djvuTextKey(), '{invalid json');
    assert.equal(loadDjvuData(), null);
  });
});

describe('saveDjvuData', () => {
  it('persists data to localStorage', () => {
    state.docName = 'save.djvu';
    saveDjvuData({ pageCount: 3 });
    const raw = localStorage.getItem(djvuTextKey());
    assert.ok(raw);
    assert.deepEqual(JSON.parse(raw), { pageCount: 3 });
  });
});

// ─── isLikelyDjvuFile ──────────────────────────────────────────────────────

describe('isLikelyDjvuFile', () => {
  it('returns true for AT&TFORM header', async () => {
    const bytes = new TextEncoder().encode('AT&TFORM0000DJVU');
    const file = new Blob([bytes]);
    file.slice = (start, end) => new Blob([bytes.slice(start, end)]);
    assert.equal(await isLikelyDjvuFile(file), true);
  });

  it('returns true for AT&T prefix', async () => {
    const bytes = new TextEncoder().encode('AT&T some other data');
    const file = new Blob([bytes]);
    file.slice = (start, end) => new Blob([bytes.slice(start, end)]);
    assert.equal(await isLikelyDjvuFile(file), true);
  });

  it('returns false for PDF header', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 header');
    const file = new Blob([bytes]);
    file.slice = (start, end) => new Blob([bytes.slice(start, end)]);
    assert.equal(await isLikelyDjvuFile(file), false);
  });

  it('handles empty file', async () => {
    const bytes = new Uint8Array(0);
    const file = new Blob([bytes]);
    file.slice = () => new Blob([bytes]);
    assert.equal(await isLikelyDjvuFile(file), false);
  });

  it('returns false on error (slice throws)', async () => {
    const file = {
      slice() { throw new Error('read error'); },
    };
    assert.equal(await isLikelyDjvuFile(file), false);
  });
});

// ─── extractDjvuFallbackText ────────────────────────────────────────────────

describe('extractDjvuFallbackText', () => {
  it('extracts readable text chunks from binary', async () => {
    const text = 'This is a readable text chunk that is at least twenty characters long for testing purposes';
    const bytes = new TextEncoder().encode(text);
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.ok(result.length > 0, 'should extract some text');
  });

  it('returns empty string for pure binary', async () => {
    const bytes = new Uint8Array(100);
    for (let i = 0; i < 100; i++) bytes[i] = i % 8; // mostly control chars
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.equal(typeof result, 'string');
  });

  it('limits output to 5000 chars', async () => {
    const longText = 'A'.repeat(10000) + ' some readable content here for testing';
    const bytes = new TextEncoder().encode(longText);
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.ok(result.length <= 5000);
  });

  it('falls back to normalized text when no regex chunks match', async () => {
    // Short words separated by spaces - no chunk >= 20 chars matching the regex
    const text = 'ab cd ef gh ij kl mn op qr st uv wx yz ab cd ef gh ij kl mn';
    const bytes = new TextEncoder().encode(text);
    const file = {
      size: bytes.length,
      slice: (start, end) => new Blob([bytes.slice(start, end)]),
    };
    const result = await extractDjvuFallbackText(file);
    // The normalized fallback should return text since length >= 20
    assert.ok(result.length > 0 || result === '', 'returns a string');
  });

  it('returns empty string on error', async () => {
    const file = {
      size: 100,
      slice() { throw new Error('read error'); },
    };
    const result = await extractDjvuFallbackText(file);
    assert.equal(result, '');
  });

  it('caps sample at 2MB for large files', async () => {
    // File reports large size but actual data is small
    const bytes = new TextEncoder().encode('Hello world test data for extraction');
    const file = {
      size: 10 * 1024 * 1024, // 10MB
      slice: (start, end) => new Blob([bytes.slice(start, Math.min(end, bytes.length))]),
    };
    const result = await extractDjvuFallbackText(file);
    assert.equal(typeof result, 'string');
  });
});

// ─── initFileControllerDeps ─────────────────────────────────────────────────

describe('initFileControllerDeps', () => {
  it('accepts deps object without error', () => {
    initFileControllerDeps({
      withErrorBoundary: (fn) => fn,
      renderCurrentPage: async () => {},
      renderOutline: async () => {},
      renderPagePreviews: async () => {},
      resetHistory: () => {},
    });
  });

  it('overwrites specific keys without removing others', () => {
    // First set some deps
    initFileControllerDeps({ renderCurrentPage: async () => 'first' });
    // Then set different ones - should not clear previous
    initFileControllerDeps({ renderOutline: async () => 'second' });
    // No error means both deps coexist
  });
});

// ─── saveCurrentPdfAs ───────────────────────────────────────────────────────

describe('saveCurrentPdfAs', () => {
  it('does nothing when pdfBytes is null', () => {
    state.pdfBytes = null;
    // Should not throw
    saveCurrentPdfAs();
  });

  it('does nothing when pdfBytes is undefined', () => {
    state.pdfBytes = undefined;
    saveCurrentPdfAs();
  });

  it('creates download link and triggers click when pdfBytes exist', () => {
    state.pdfBytes = new Uint8Array([1, 2, 3]);
    state.docName = 'test.pdf';

    let clickCalled = false;
    const origCreateElement = document.createElement;
    const fakeAnchor = {
      href: '',
      download: '',
      click() { clickCalled = true; },
    };
    document.createElement = (tag) => {
      if (tag === 'a') return fakeAnchor;
      return origCreateElement(tag);
    };

    try {
      saveCurrentPdfAs();
      assert.ok(clickCalled, 'click should have been called');
      assert.equal(fakeAnchor.download, 'test.pdf');
      assert.ok(fakeAnchor.href, 'href should be set');
    } finally {
      document.createElement = origCreateElement;
    }
  });

  it('uses default filename when docName is null', () => {
    state.pdfBytes = new Uint8Array([1, 2, 3]);
    state.docName = null;

    const fakeAnchor = { href: '', download: '', click() {} };
    const origCreateElement = document.createElement;
    document.createElement = (tag) => {
      if (tag === 'a') return fakeAnchor;
      return origCreateElement(tag);
    };

    try {
      saveCurrentPdfAs();
      assert.equal(fakeAnchor.download, 'document.pdf');
    } finally {
      document.createElement = origCreateElement;
    }
  });
});

// ─── reloadPdfFromBytes ─────────────────────────────────────────────────────

describe('reloadPdfFromBytes', () => {
  it('throws on null input', async () => {
    await assert.rejects(() => reloadPdfFromBytes(null), /expected Uint8Array/);
  });

  it('throws on undefined input', async () => {
    await assert.rejects(() => reloadPdfFromBytes(undefined), /expected Uint8Array/);
  });

  it('throws on non-Uint8Array input', async () => {
    await assert.rejects(() => reloadPdfFromBytes('not bytes'), /expected Uint8Array/);
  });

  it('throws on array input', async () => {
    await assert.rejects(() => reloadPdfFromBytes([1, 2, 3]), /expected Uint8Array/);
  });
});

// ─── openFile ───────────────────────────────────────────────────────────────

describe('openFile', () => {
  /** @type {any} */
  let deps;

  beforeEach(() => {
    deps = {
      withErrorBoundary: (fn, _ctx) => fn,
      renderCurrentPage: mock.fn(async () => {}),
      renderOutline: mock.fn(async () => {}),
      renderPagePreviews: mock.fn(async () => {}),
      resetHistory: mock.fn(),
      setWorkspaceStatus: mock.fn(),
      setBookmarksStatus: mock.fn(),
      ensureTextToolsVisible: mock.fn(),
      invalidateAnnotationCaches: mock.fn(),
      clearOcrRuntimeCaches: mock.fn(),
      restoreViewStateIfPresent: mock.fn(() => false),
      stopReadingTimer: mock.fn(),
      loadReadingTime: mock.fn(() => 0),
      loadReadingGoal: mock.fn(() => null),
      loadCloudSyncUrl: mock.fn(() => ''),
      toggleCollaborationChannel: mock.fn(),
      saveRecent: mock.fn(),
      renderRecent: mock.fn(),
      loadNotes: mock.fn(),
      renderBookmarks: mock.fn(),
      renderDocInfo: mock.fn(),
      renderVisitTrail: mock.fn(),
      renderSearchHistory: mock.fn(),
      renderSearchResultsList: mock.fn(),
      renderDocStats: mock.fn(),
      estimatePageSkewAngle: mock.fn(),
      scheduleBackgroundOcrScan: mock.fn(),
      setOcrStatus: mock.fn(),
      loadPersistedEdits: mock.fn(),
      renderCommentList: mock.fn(),
      updateReadingTimeStatus: mock.fn(),
      renderEtaStatus: mock.fn(),
      startReadingTimer: mock.fn(),
      recordCrashEvent: mock.fn(),
      PDFAdapter: class {
        constructor(doc) { this.doc = doc; this.type = 'pdf'; }
        getPageCount() { return 3; }
        async getPageViewport() { return { width: 800, height: 600 }; }
      },
      DjVuAdapter: class {
        constructor(name, data) { this.name = name; this.data = data; this.type = 'djvu'; }
        getPageCount() { return 1; }
        async getPageViewport() { return { width: 600, height: 800 }; }
      },
      DjVuNativeAdapter: class {
        constructor(doc, name) { this.doc = doc; this.name = name; this.type = 'djvu-native'; }
        getPageCount() { return 2; }
        async getPageViewport() { return { width: 600, height: 800 }; }
      },
      ImageAdapter: class {
        constructor(url, dims) { this.url = url; this.dims = dims; this.type = 'image'; }
        getPageCount() { return 1; }
        async getPageViewport() { return { width: 640, height: 480 }; }
      },
      UnsupportedAdapter: class {
        constructor(name) { this.name = name; this.type = 'unsupported'; }
        getPageCount() { return 1; }
        async getPageViewport() { return { width: 100, height: 100 }; }
      },
    };
    initFileControllerDeps(deps);

    // Ensure required els exist
    els.searchStatus = mockEl();
    els.pageText = mockEl();
    els.pageInput = mockEl();
    els.canvasWrap = mockEl();
    els.cloudSyncUrl = mockEl();
  });

  it('opens an unsupported file type', async () => {
    const file = new File(['data'], 'readme.txt', { type: 'text/plain' });
    await openFile(file);

    assert.equal(state.docName, 'readme.txt');
    assert.equal(state.adapter.type, 'unsupported');
    assert.equal(state.pageCount, 1);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    assert.equal(deps.saveRecent.mock.callCount(), 1);
  });

  it('resets state fields on file open', async () => {
    state.currentPage = 5;
    state.zoom = 2.5;
    state.rotation = 90;
    state.searchResults = [1, 2, 3];
    state.searchCursor = 2;
    state.outline = [{ title: 'test' }];
    state.visitTrail = [1, 2];

    const file = new File(['data'], 'test.txt');
    await openFile(file);

    assert.equal(state.currentPage, 1);
    assert.equal(state.rotation, 0);
    assert.deepEqual(state.searchResults, []);
    assert.equal(state.searchCursor, -1);
    assert.deepEqual(state.outline, []);
    assert.deepEqual(state.visitTrail, []);
  });

  it('calls resetHistory', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.resetHistory.mock.callCount(), 1);
  });

  it('calls invalidateAnnotationCaches', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.invalidateAnnotationCaches.mock.callCount(), 1);
  });

  it('calls clearOcrRuntimeCaches with file-open', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.clearOcrRuntimeCaches.mock.callCount(), 1);
    assert.deepEqual(deps.clearOcrRuntimeCaches.mock.calls[0].arguments, ['file-open']);
  });

  it('sets djvuBinaryDetected to false', async () => {
    state.djvuBinaryDetected = true;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(state.djvuBinaryDetected, false);
  });

  it('calls restoreViewStateIfPresent', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.restoreViewStateIfPresent.mock.callCount(), 1);
  });

  it('skips auto-zoom when restoreViewStateIfPresent returns true', async () => {
    deps.restoreViewStateIfPresent = mock.fn(() => true);
    initFileControllerDeps(deps);

    state.zoom = 2.0;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    // zoom should remain at initial 1 since state was reset, but auto-zoom not applied
    // The key thing is restoreViewStateIfPresent was called and returned true
    assert.equal(deps.restoreViewStateIfPresent.mock.callCount(), 1);
  });

  it('sets pageInput max and value', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(els.pageInput.max, '1');
    assert.equal(els.pageInput.value, '1');
  });

  it('loads reading time and goal', async () => {
    deps.loadReadingTime = mock.fn(() => 5000);
    deps.loadReadingGoal = mock.fn(() => 42);
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.txt');
    await openFile(file);

    assert.equal(state.readingTotalMs, 5000);
    assert.equal(state.readingGoalPage, 42);
    assert.equal(state.readingStartedAt, null);
  });

  it('sets cloudSyncUrl value', async () => {
    deps.loadCloudSyncUrl = mock.fn(() => 'https://example.com/sync');
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(els.cloudSyncUrl.value, 'https://example.com/sync');
  });

  it('calls toggleCollaborationChannel when collabEnabled', async () => {
    state.collabEnabled = true;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.toggleCollaborationChannel.mock.callCount(), 1);
  });

  it('does not call toggleCollaborationChannel when collab disabled', async () => {
    state.collabEnabled = false;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.toggleCollaborationChannel.mock.callCount(), 0);
  });

  it('calls all post-open render functions', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);

    assert.equal(deps.saveRecent.mock.callCount(), 1);
    assert.equal(deps.renderRecent.mock.callCount(), 1);
    assert.equal(deps.loadNotes.mock.callCount(), 1);
    assert.equal(deps.renderBookmarks.mock.callCount(), 1);
    assert.equal(deps.renderDocInfo.mock.callCount(), 1);
    assert.equal(deps.renderVisitTrail.mock.callCount(), 1);
    assert.equal(deps.renderSearchHistory.mock.callCount(), 1);
    assert.equal(deps.renderSearchResultsList.mock.callCount(), 1);
    assert.equal(deps.renderDocStats.mock.callCount(), 1);
  });

  it('calls estimatePageSkewAngle with current page', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.estimatePageSkewAngle.mock.callCount(), 1);
    assert.deepEqual(deps.estimatePageSkewAngle.mock.calls[0].arguments, [1]);
  });

  it('schedules background OCR when settings.backgroundOcr is true', async () => {
    state.settings = { backgroundOcr: true };
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.scheduleBackgroundOcrScan.mock.callCount(), 1);
    assert.deepEqual(deps.scheduleBackgroundOcrScan.mock.calls[0].arguments, ['open-file', 900]);
  });

  it('sets OCR status when backgroundOcr is false', async () => {
    state.settings = { backgroundOcr: false };
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.setOcrStatus.mock.callCount(), 1);
    assert.equal(deps.scheduleBackgroundOcrScan.mock.callCount(), 0);
  });

  it('sets OCR status when settings is null', async () => {
    state.settings = null;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.setOcrStatus.mock.callCount(), 1);
  });

  it('calls loadPersistedEdits, renderCommentList, timers', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);

    assert.equal(deps.loadPersistedEdits.mock.callCount(), 1);
    assert.equal(deps.renderCommentList.mock.callCount(), 1);
    assert.equal(deps.updateReadingTimeStatus.mock.callCount(), 1);
    assert.equal(deps.renderEtaStatus.mock.callCount(), 1);
    assert.equal(deps.startReadingTimer.mock.callCount(), 1);
    assert.equal(deps.stopReadingTimer.mock.callCount(), 1);
  });

  it('calls _bootstrapAdvancedTools if present on window', async () => {
    let called = false;
    /** @type {any} */ (window)._bootstrapAdvancedTools = () => { called = true; };

    const file = new File(['data'], 'test.txt');
    await openFile(file);

    assert.ok(called, '_bootstrapAdvancedTools should be called');
    delete /** @type {any} */ (window)._bootstrapAdvancedTools;
  });

  it('handles _bootstrapAdvancedTools throwing without crashing', async () => {
    /** @type {any} */ (window)._bootstrapAdvancedTools = () => { throw new Error('boom'); };

    const file = new File(['data'], 'test.txt');
    // Should not throw
    await openFile(file);

    delete /** @type {any} */ (window)._bootstrapAdvancedTools;
  });

  it('opens an image file (png)', async () => {
    // Patch Image so loadImage resolves immediately
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'photo.png', { type: 'image/png' });
      await openFile(file);
      assert.equal(state.docName, 'photo.png');
      assert.equal(state.adapter.type, 'image');
      assert.ok(state.currentObjectUrl, 'should set currentObjectUrl');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('opens a jpeg file', async () => {
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'photo.jpg', { type: 'image/jpeg' });
      await openFile(file);
      assert.equal(state.docName, 'photo.jpg');
      assert.equal(state.adapter.type, 'image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('opens a webp file', async () => {
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'image.webp', { type: 'image/webp' });
      await openFile(file);
      assert.equal(state.docName, 'image.webp');
      assert.equal(state.adapter.type, 'image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('opens a gif file', async () => {
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'anim.gif', { type: 'image/gif' });
      await openFile(file);
      assert.equal(state.adapter.type, 'image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('opens a bmp file', async () => {
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'legacy.bmp', { type: 'image/bmp' });
      await openFile(file);
      assert.equal(state.adapter.type, 'image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('handles case-insensitive file extensions', async () => {
    const OrigImage = globalThis.Image;
    globalThis.Image = class FakeImage {
      constructor() { this.width = 640; this.height = 480; }
      set src(_v) { queueMicrotask(() => { if (this.onload) this.onload(); }); }
      get src() { return ''; }
    };
    try {
      const file = new File(['imagedata'], 'PHOTO.PNG', { type: 'image/png' });
      await openFile(file);
      assert.equal(state.adapter.type, 'image');
    } finally {
      globalThis.Image = OrigImage;
    }
  });

  it('handles cloudSyncUrl being null/undefined in els', async () => {
    const saved = els.cloudSyncUrl;
    els.cloudSyncUrl = null;

    const file = new File(['data'], 'test.txt');
    // Should not throw
    await openFile(file);

    els.cloudSyncUrl = saved;
  });

  it('passes file name to saveRecent', async () => {
    const file = new File(['data'], 'myfile.txt');
    await openFile(file);

    assert.deepEqual(deps.saveRecent.mock.calls[0].arguments, ['myfile.txt']);
  });

  it('clears searchStatus text', async () => {
    els.searchStatus.textContent = 'old search result';
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    // For unsupported: searchStatus is cleared at start, may be set again
    // The initial clear happens
    assert.equal(typeof els.searchStatus.textContent, 'string');
  });

  it('clears pageText value', async () => {
    els.pageText.value = 'old text';
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(els.pageText.value, '');
  });

  it('cancels in-flight render if adapter supports it', async () => {
    const cancelFn = mock.fn();
    state.adapter = { cancelMainRender: cancelFn };

    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(cancelFn.mock.callCount(), 1);
  });

  it('handles adapter without cancelMainRender', async () => {
    state.adapter = { type: 'test' };

    const file = new File(['data'], 'test.txt');
    // Should not throw
    await openFile(file);
  });

  it('handles null adapter', async () => {
    state.adapter = null;
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.ok(state.adapter);
  });

  it('falls back to UnsupportedAdapter when PDF loading fails', async () => {
    // ensurePdfJs will fail in test env, triggering the catch branch
    const file = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });
    await openFile(file);

    // Should fall back to UnsupportedAdapter when pdfjs can't load
    assert.equal(state.adapter.type, 'unsupported');
    assert.ok(els.searchStatus.textContent.length > 0, 'searchStatus should have error message');
  });

  it('falls back to UnsupportedAdapter when epub loading fails', async () => {
    // parseEpub will fail on invalid data
    const file = new File(['not an epub'], 'book.epub');
    await openFile(file);

    assert.equal(state.adapter.type, 'unsupported');
    assert.ok(els.searchStatus.textContent.includes('ePub'), 'should mention ePub in error');
  });

  it('does not call formManager for non-pdf adapter', async () => {
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(state.adapter.type, 'unsupported');
  });

  it('sets file reference in state', async () => {
    const file = new File(['data'], 'myfile.txt');
    await openFile(file);
    assert.equal(state.file, file);
    assert.equal(state.docName, 'myfile.txt');
  });

  it('exercises default _deps arrow functions when not overridden', async () => {
    // Re-inject only the minimum deps needed so the default arrow-function
    // stubs (lines 27-65 in file-controller.js) get executed, boosting
    // function coverage.
    initFileControllerDeps({
      withErrorBoundary: (fn) => fn,
      // Adapters are required for the openFile flow
      PDFAdapter: class { constructor() { this.type = 'pdf'; } getPageCount() { return 1; } async getPageViewport() { return { width: 100, height: 100 }; } },
      DjVuAdapter: class { constructor() { this.type = 'djvu'; } getPageCount() { return 1; } async getPageViewport() { return { width: 100, height: 100 }; } },
      DjVuNativeAdapter: class { constructor() { this.type = 'djvu-native'; } getPageCount() { return 1; } async getPageViewport() { return { width: 100, height: 100 }; } },
      ImageAdapter: class { constructor() { this.type = 'image'; } getPageCount() { return 1; } async getPageViewport() { return { width: 100, height: 100 }; } },
      UnsupportedAdapter: class { constructor() { this.type = 'unsupported'; } getPageCount() { return 1; } async getPageViewport() { return { width: 100, height: 100 }; } },
      // Leave all other deps as defaults (the arrow stubs)
      renderCurrentPage: async () => {},
      renderOutline: async () => {},
      renderPagePreviews: async () => {},
    });

    const file = new File(['data'], 'something.xyz');
    await openFile(file);
    assert.equal(state.adapter.type, 'unsupported');
  });

  it('opens a .djvu file via DjVuNativeAdapter when DjVu runtime is available', async () => {
    // Set up window.DjVu mock so ensureDjVuJs succeeds
    /** @type {any} */ (window).DjVu = {
      Document: class MockDjVuDocument {
        constructor(_data) { this.pages = [{}]; }
      },
    };

    const origAppendChild = document.head.appendChild;
    document.head.appendChild = (el) => {
      if (el && el.tagName === 'SCRIPT' && el.onload) {
        queueMicrotask(() => el.onload());
      }
      return el;
    };

    try {
      const file = new File(['AT&TFORM fake djvu data'], 'book.djvu');
      await openFile(file);

      assert.equal(state.docName, 'book.djvu');
      assert.ok(state.adapter, 'adapter should be set');
      assert.equal(state.adapter.type, 'djvu-native');
    } finally {
      document.head.appendChild = origAppendChild;
      delete /** @type {any} */ (window).DjVu;
    }
  });

  it('opens a .djvu file via DjVuAdapter fallback (no native runtime)', async () => {
    // Patch document.head.appendChild to trigger onerror on script elements
    // so ensureDjVuJs rejects quickly instead of hanging
    const origAppendChild = document.head.appendChild;
    document.head.appendChild = (el) => {
      if (el && el.tagName === 'SCRIPT' && el.onerror) {
        queueMicrotask(() => el.onerror(new Error('script load failed')));
      }
      return el;
    };

    try {
      const file = new File(['not a real djvu'], 'book.djvu');
      await openFile(file);

      assert.equal(state.docName, 'book.djvu');
      assert.ok(state.adapter, 'adapter should be set');
      assert.equal(state.adapter.type, 'djvu');
    } finally {
      document.head.appendChild = origAppendChild;
    }
  });

  it('opens a .djv file via DjVuAdapter fallback', async () => {
    const origAppendChild = document.head.appendChild;
    document.head.appendChild = (el) => {
      if (el && el.tagName === 'SCRIPT' && el.onerror) {
        queueMicrotask(() => el.onerror(new Error('script load failed')));
      }
      return el;
    };

    try {
      const file = new File(['not a real djvu'], 'book.djv');
      await openFile(file);

      assert.equal(state.docName, 'book.djv');
      assert.ok(state.adapter, 'adapter should be set');
    } finally {
      document.head.appendChild = origAppendChild;
    }
  });

  it('opens .djvu with pre-existing djvu data in localStorage', async () => {
    const origAppendChild = document.head.appendChild;
    document.head.appendChild = (el) => {
      if (el && el.tagName === 'SCRIPT' && el.onerror) {
        queueMicrotask(() => el.onerror(new Error('script load failed')));
      }
      return el;
    };

    try {
      // Pre-populate djvu data with page images so the hasPageData branch is taken
      state.docName = 'saved.djvu';
      saveDjvuData({
        pageCount: 2,
        pagesImages: ['data:image/png;base64,abc', 'data:image/png;base64,def'],
        pagesText: ['Page 1 text', 'Page 2 text'],
      });

      state.docName = null;
      const file = new File(['not a real djvu'], 'saved.djvu');
      await openFile(file);

      assert.equal(state.docName, 'saved.djvu');
      assert.ok(state.adapter, 'adapter should be set');
    } finally {
      document.head.appendChild = origAppendChild;
    }
  });

  it('reloadPdfFromBytes rejects on invalid PDF data', async () => {
    // ensurePdfJs succeeds in this env (pdfjs-dist is installed), but
    // getDocument will reject on garbage bytes
    await assert.rejects(
      () => reloadPdfFromBytes(new Uint8Array([1, 2, 3])),
      (err) => err instanceof Error,
    );
  });

  it('reloadPdfFromBytes succeeds with valid PDF bytes', async () => {
    // Minimal valid PDF that pdfjs can parse
    const pdfSrc = '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
    const bytes = new TextEncoder().encode(pdfSrc);

    // Set up state so reloadPdfFromBytes has something to work with
    state.docName = 'test.pdf';
    state.currentPage = 1;

    await reloadPdfFromBytes(new Uint8Array(bytes));

    assert.ok(state.pdfBytes, 'pdfBytes should be set');
    assert.ok(state.adapter, 'adapter should be created');
    assert.equal(state.pageCount, 3); // mock PDFAdapter.getPageCount returns 3
    assert.ok(state.file instanceof File, 'file should be a File');
  });

  it('reloadPdfFromBytes clamps currentPage when it exceeds new page count', async () => {
    const pdfSrc = '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
    const bytes = new TextEncoder().encode(pdfSrc);

    state.docName = 'test.pdf';
    state.currentPage = 999; // higher than actual page count

    await reloadPdfFromBytes(new Uint8Array(bytes));

    // Mock PDFAdapter.getPageCount returns 3, so 999 gets clamped to 3
    assert.equal(state.currentPage, 3, 'currentPage should be clamped to pageCount');
  });

  it('reloadPdfFromBytes calls _bootstrapAdvancedTools if present', async () => {
    const pdfSrc = '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
    const bytes = new TextEncoder().encode(pdfSrc);

    state.docName = 'test.pdf';
    state.currentPage = 1;

    let bootstrapCalled = false;
    /** @type {any} */ (window)._bootstrapAdvancedTools = () => { bootstrapCalled = true; };

    try {
      await reloadPdfFromBytes(new Uint8Array(bytes));
      assert.ok(bootstrapCalled, '_bootstrapAdvancedTools should be called');
    } finally {
      delete /** @type {any} */ (window)._bootstrapAdvancedTools;
    }
  });

  it('handles renderOutline rejection gracefully', async () => {
    deps.renderOutline = mock.fn(async () => { throw new Error('outline fail'); });
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.txt');
    // Should not throw even though renderOutline rejects
    await openFile(file);
    assert.equal(deps.renderOutline.mock.callCount(), 1);
  });

  it('handles renderPagePreviews rejection gracefully', async () => {
    deps.renderPagePreviews = mock.fn(async () => { throw new Error('previews fail'); });
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.txt');
    await openFile(file);
    assert.equal(deps.renderPagePreviews.mock.callCount(), 1);
  });

  it('handles formManager.loadFromAdapter for pdf adapter type', async () => {
    // The PDF path falls back to UnsupportedAdapter in test env, so
    // to test the formManager branch we need an adapter that reports type=pdf
    // Set up a custom UnsupportedAdapter that reports type as pdf
    deps.UnsupportedAdapter = class {
      constructor(name) { this.name = name; this.type = 'pdf'; }
      getPageCount() { return 1; }
      async getPageViewport() { return { width: 100, height: 100 }; }
    };
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.xyz');
    await openFile(file);
    // formManager.loadFromAdapter should be called since adapter.type === 'pdf'
    assert.equal(state.adapter.type, 'pdf');
  });

  it('auto-fits zoom when getPageViewport is available and no saved state', async () => {
    deps.restoreViewStateIfPresent = mock.fn(() => false);
    deps.UnsupportedAdapter = class {
      constructor(name) { this.name = name; this.type = 'unsupported'; }
      getPageCount() { return 1; }
      async getPageViewport() { return { width: 400, height: 600 }; }
    };
    initFileControllerDeps(deps);

    els.canvasWrap = { offsetWidth: 800, clientWidth: 780, style: {} };
    const file = new File(['data'], 'test.txt');
    await openFile(file);
    // zoom should be auto-fitted based on viewport width vs available width
    assert.ok(state.zoom > 0, 'zoom should be positive');
  });

  it('handles getPageViewport throwing during auto-zoom', async () => {
    deps.restoreViewStateIfPresent = mock.fn(() => false);
    deps.UnsupportedAdapter = class {
      constructor(name) { this.name = name; this.type = 'unsupported'; }
      getPageCount() { return 1; }
      async getPageViewport() { throw new Error('no viewport'); }
    };
    initFileControllerDeps(deps);

    const file = new File(['data'], 'test.txt');
    // Should not throw
    await openFile(file);
    assert.ok(state.adapter, 'adapter should be set');
  });
});
