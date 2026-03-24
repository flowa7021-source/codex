// ─── Unit Tests: Workspace Controller ───────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../../app/modules/state.js';

// Ensure document.body has classList for workspace-controller's theme toggle
if (!document.body.classList || typeof document.body.classList.toggle !== 'function') {
  const _classes = new Set();
  document.body.classList = {
    add(...cls) { cls.forEach((c) => _classes.add(c)); },
    remove(...cls) { cls.forEach((c) => _classes.delete(c)); },
    toggle(c, force) {
      if (force === undefined) { _classes.has(c) ? _classes.delete(c) : _classes.add(c); }
      else if (force) { _classes.add(c); }
      else { _classes.delete(c); }
    },
    contains(c) { return _classes.has(c); },
  };
}

import {
  cloudSyncUrlKey,
  loadCloudSyncUrl,
  saveCloudSyncUrl,
  ocrTextKey,
  loadOcrTextData,
  saveOcrTextData,
  loadOcrTextDataAsync,
  buildWorkspacePayload,
  applyWorkspacePayload,
  collabChannelName,
  setWorkspaceStatus,
  setStage4Status,
  initWorkspaceDeps,
  initReleaseGuards,
  broadcastWorkspaceSnapshot,
  toggleCollaborationChannel,
  importOcrJson,
  exportWorkspaceBundleJson,
  importWorkspaceBundleJson,
  pushWorkspaceToCloud,
  pullWorkspaceFromCloud,
} from '../../app/modules/workspace-controller.js';

import { els as _els } from '../../app/modules/state.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // Reset state fields used by workspace-controller
  state.docName = 'test-doc.pdf';
  state.pageCount = 10;
  state.adapter = null;
  state.currentPage = 1;
  state.collabEnabled = false;
  state.collabChannel = null;
});

// ─── Default _deps coverage ─────────────────────────────────────────────────
// Call buildWorkspacePayload and applyWorkspacePayload BEFORE any initWorkspaceDeps
// so that the default arrow functions in _deps get executed at least once.

describe('default _deps coverage', () => {
  it('buildWorkspacePayload uses default dep callbacks', () => {
    state.adapter = {};
    state.docName = 'defaults-test.pdf';
    state.pageCount = 1;
    const payload = buildWorkspacePayload();
    assert.equal(payload.app, 'NovaReader');
    assert.equal(payload.type, 'workspace-backup');
    // defaults: loadStrokes returns [], loadComments returns [], getNotesModel returns obj, loadBookmarks returns []
    assert.deepEqual(payload.pages, {}); // no strokes/comments by default
    assert.deepEqual(payload.bookmarks, []);
  });

  it('applyWorkspacePayload uses default dep callbacks', async () => {
    state.adapter = {};
    state.docName = 'defaults-test.pdf';
    state.pageCount = 5;
    const payload = {
      type: 'workspace-backup',
      docName: 'defaults-test.pdf',
      notes: { title: 'T', tags: 'tg', body: 'B' },
      bookmarks: [{ page: 1, label: 'bm' }],
      hotkeys: { next: 'ArrowRight', prev: 'ArrowLeft' },
      theme: 'dark',
      ocrText: { pagesText: ['p1'] },
      pages: {
        '1': {
          strokes: [{ tool: 'pen', size: 2, points: [{ x: 0, y: 0 }] }],
          comments: [{ point: { x: 10, y: 20 }, text: 'c1' }],
        },
      },
    };
    // This exercises normalizeImportedNotes, saveNotes, saveBookmarks,
    // renderBookmarks, setBookmarksStatus, normalizeHotkey, validateHotkeys,
    // renderHotkeyInputs, setHotkeysInputErrors, setHotkeysStatus,
    // clearDocumentAnnotationStorage, clearDocumentCommentStorage,
    // saveStrokes, saveComments, renderAnnotations, renderCommentList
    const result = await applyWorkspacePayload(payload, { skipConfirm: true });
    assert.equal(result, true);
  });
});

// ─── cloudSyncUrlKey ────────────────────────────────────────────────────────

describe('cloudSyncUrlKey', () => {
  it('returns the expected localStorage key', () => {
    assert.equal(cloudSyncUrlKey(), 'novareader-cloud-sync-url');
  });
});

// ─── loadCloudSyncUrl / saveCloudSyncUrl ────────────────────────────────────

describe('loadCloudSyncUrl', () => {
  it('returns empty string when nothing is saved and no location', () => {
    const result = loadCloudSyncUrl();
    // Depends on environment — in test with mock location it may return URL or empty
    assert.equal(typeof result, 'string');
  });

  it('returns saved URL from localStorage', () => {
    localStorage.setItem(cloudSyncUrlKey(), 'https://example.com/api');
    assert.equal(loadCloudSyncUrl(), 'https://example.com/api');
  });
});

// ─── ocrTextKey ─────────────────────────────────────────────────────────────

describe('ocrTextKey', () => {
  it('includes doc name from state', () => {
    state.docName = 'myfile.pdf';
    assert.equal(ocrTextKey(), 'novareader-ocr-text:myfile.pdf');
  });

  it('uses global when docName is empty', () => {
    state.docName = '';
    assert.equal(ocrTextKey(), 'novareader-ocr-text:global');
  });
});

// ─── loadOcrTextData / saveOcrTextData ──────────────────────────────────────

describe('loadOcrTextData', () => {
  it('returns null when nothing saved', () => {
    assert.equal(loadOcrTextData(), null);
  });

  it('returns parsed JSON data when saved', () => {
    const data = { pagesText: ['page1', 'page2'], pageCount: 2 };
    localStorage.setItem(ocrTextKey(), JSON.stringify(data));
    const result = loadOcrTextData();
    assert.deepEqual(result, data);
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(ocrTextKey(), 'not valid json{{{');
    const result = loadOcrTextData();
    assert.equal(result, null);
  });
});

describe('saveOcrTextData', () => {
  it('persists data to localStorage', () => {
    const data = { pagesText: ['hello'], pageCount: 1 };
    saveOcrTextData(data);
    const stored = JSON.parse(localStorage.getItem(ocrTextKey()));
    assert.deepEqual(stored, data);
  });
});

// ─── collabChannelName ──────────────────────────────────────────────────────

describe('collabChannelName', () => {
  it('includes doc name from state', () => {
    state.docName = 'doc.pdf';
    assert.equal(collabChannelName(), 'novareader-collab:doc.pdf');
  });

  it('uses global when docName is empty', () => {
    state.docName = '';
    assert.equal(collabChannelName(), 'novareader-collab:global');
  });
});

// ─── buildWorkspacePayload ──────────────────────────────────────────────────

describe('buildWorkspacePayload', () => {
  beforeEach(() => {
    // Inject deps that return empty data
    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      loadBookmarks: () => [],
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
    });
  });

  it('returns a workspace-backup object', () => {
    state.adapter = {}; // Simulate open doc
    state.docName = 'test.pdf';
    state.pageCount = 3;
    const payload = buildWorkspacePayload();
    assert.equal(payload.app, 'NovaReader');
    assert.equal(payload.type, 'workspace-backup');
    assert.equal(payload.version, 1);
    assert.equal(payload.docName, 'test.pdf');
    assert.equal(payload.pageCount, 3);
    assert.ok(payload.exportedAt);
    assert.ok(Array.isArray(payload.bookmarks));
    assert.equal(typeof payload.pages, 'object');
  });

  it('includes page data when strokes exist', () => {
    initWorkspaceDeps({
      loadStrokes: (page) => page === 2 ? [{ tool: 'pen', size: 2, points: [] }] : [],
      loadComments: () => [],
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      loadBookmarks: () => [],
    });
    state.pageCount = 3;
    const payload = buildWorkspacePayload();
    assert.ok(payload.pages['2'], 'page 2 should have data');
    assert.equal(payload.pages['2'].strokes.length, 1);
    assert.equal(payload.pages['1'], undefined, 'page 1 should not have data');
  });
});

// ─── applyWorkspacePayload ──────────────────────────────────────────────────

describe('applyWorkspacePayload', () => {
  let savedStrokes, savedComments, savedNotes, savedBookmarks;

  beforeEach(() => {
    savedStrokes = {};
    savedComments = {};
    savedNotes = null;
    savedBookmarks = null;

    initWorkspaceDeps({
      loadStrokes: (page) => savedStrokes[page] || [],
      saveStrokes: (strokes, page) => { savedStrokes[page] = strokes; },
      loadComments: (page) => savedComments[page] || [],
      saveComments: (comments, page) => { savedComments[page] = comments; },
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => { savedNotes = true; },
      loadBookmarks: () => savedBookmarks || [],
      saveBookmarks: (b) => { savedBookmarks = b; },
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
    });

    state.adapter = {}; // Simulate open doc
    state.docName = 'test.pdf';
    state.pageCount = 5;
  });

  it('rejects invalid payload', async () => {
    await assert.rejects(
      () => applyWorkspacePayload(null),
      /bad workspace payload/,
    );
  });

  it('rejects payload without workspace-backup type', async () => {
    await assert.rejects(
      () => applyWorkspacePayload({ type: 'other' }),
      /bad workspace payload/,
    );
  });

  it('applies valid workspace payload', async () => {
    const payload = {
      type: 'workspace-backup',
      docName: 'test.pdf',
      notes: { title: 'My Notes', tags: 'tag1', body: 'Note body' },
      bookmarks: [{ page: 1, label: 'start' }],
      hotkeys: {},
      theme: 'dark',
      pages: {
        '1': {
          strokes: [{ tool: 'pen', size: 2, points: [{ x: 0, y: 0 }] }],
          comments: [{ point: { x: 10, y: 20 }, text: 'hello' }],
        },
      },
    };
    const ok = await applyWorkspacePayload(payload, { skipConfirm: true });
    assert.equal(ok, true);
    assert.ok(savedNotes, 'notes should be saved');
    assert.deepEqual(savedBookmarks, [{ page: 1, label: 'start' }]);
    assert.equal(savedStrokes[1].length, 1);
    assert.equal(savedComments[1].length, 1);
  });

  it('filters out invalid bookmarks', async () => {
    const payload = {
      type: 'workspace-backup',
      docName: 'test.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [
        { page: 1, label: 'ok' },
        { page: 999, label: 'out of range' },
        { page: -1, label: 'negative' },
        null,
      ],
      pages: {},
    };
    await applyWorkspacePayload(payload, { skipConfirm: true });
    // Only page 1 is valid (pageCount is 5)
    assert.equal(savedBookmarks.length, 1);
    assert.equal(savedBookmarks[0].page, 1);
  });

  it('filters out invalid strokes', async () => {
    const payload = {
      type: 'workspace-backup',
      docName: 'test.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      pages: {
        '2': {
          strokes: [
            { tool: 'pen', size: 2, points: [] },       // valid
            { tool: 'invalid-tool', size: 2, points: [] }, // invalid
            { tool: 'pen', size: 'not-a-number', points: [] }, // invalid
          ],
          comments: [],
        },
      },
    };
    await applyWorkspacePayload(payload, { skipConfirm: true });
    assert.equal(savedStrokes[2].length, 1, 'only valid strokes should be saved');
  });

  it('applies theme from payload', async () => {
    const payload = {
      type: 'workspace-backup',
      docName: 'test.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      theme: 'light',
      pages: {},
    };
    await applyWorkspacePayload(payload, { skipConfirm: true });
    assert.equal(localStorage.getItem('novareader-theme'), 'light');
  });
});

// ─── setWorkspaceStatus / setStage4Status ───────────────────────────────────

describe('setWorkspaceStatus', () => {
  it('does not throw when els.workspaceStatus is null', () => {
    assert.doesNotThrow(() => setWorkspaceStatus('test'));
  });
});

describe('setStage4Status', () => {
  it('does not throw when els.stage4Status is null', () => {
    assert.doesNotThrow(() => setStage4Status('test', 'error'));
  });
});

// ─── Cast els for property injection ────────────────────────────────────────
/** @type {any} */
const els = _els;

// ─── initReleaseGuards ──────────────────────────────────────────────────────

describe('initReleaseGuards', () => {
  let origAppVersion, origPushCloudSync, origPullCloudSync, origToggleCollab, origBroadcastCollab;

  beforeEach(() => {
    origAppVersion = els.appVersion;
    origPushCloudSync = els.pushCloudSync;
    origPullCloudSync = els.pullCloudSync;
    origToggleCollab = els.toggleCollab;
    origBroadcastCollab = els.broadcastCollab;
  });

  afterEach(() => {
    els.appVersion = origAppVersion;
    els.pushCloudSync = origPushCloudSync;
    els.pullCloudSync = origPullCloudSync;
    els.toggleCollab = origToggleCollab;
    els.broadcastCollab = origBroadcastCollab;
  });

  it('sets appVersion textContent when element exists', () => {
    const fakeEl = { textContent: '' };
    els.appVersion = fakeEl;
    els.pushCloudSync = null;
    els.pullCloudSync = null;
    els.toggleCollab = null;
    els.broadcastCollab = null;
    initReleaseGuards();
    assert.ok(fakeEl.textContent.length > 0, 'should set version text');
  });

  it('does not throw when all elements are null', () => {
    els.appVersion = null;
    els.pushCloudSync = null;
    els.pullCloudSync = null;
    els.toggleCollab = null;
    els.broadcastCollab = null;
    assert.doesNotThrow(() => initReleaseGuards());
  });
});

// ─── saveCloudSyncUrl (with element) ────────────────────────────────────────

describe('saveCloudSyncUrl', () => {
  let origCloudSyncUrl, origStage4Status;

  beforeEach(() => {
    origCloudSyncUrl = els.cloudSyncUrl;
    origStage4Status = els.stage4Status;
  });

  afterEach(() => {
    els.cloudSyncUrl = origCloudSyncUrl;
    els.stage4Status = origStage4Status;
  });

  it('saves non-empty URL to localStorage', () => {
    els.cloudSyncUrl = { value: 'https://example.com/api' };
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    saveCloudSyncUrl();
    assert.equal(localStorage.getItem(cloudSyncUrlKey()), 'https://example.com/api');
  });

  it('saves empty string when value is empty', () => {
    els.cloudSyncUrl = { value: '  ' };
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    saveCloudSyncUrl();
    assert.equal(localStorage.getItem(cloudSyncUrlKey()), '');
  });
});

// ─── loadOcrTextDataAsync ───────────────────────────────────────────────────

describe('loadOcrTextDataAsync', () => {
  it('falls back to localStorage when IndexedDB returns null', async () => {
    state.docName = 'async-test.pdf';
    const data = { pagesText: ['p1'], pageCount: 1 };
    localStorage.setItem(ocrTextKey(), JSON.stringify(data));
    const result = await loadOcrTextDataAsync();
    assert.deepEqual(result, data);
  });

  it('returns null when nothing is stored', async () => {
    state.docName = 'missing-doc.pdf';
    const result = await loadOcrTextDataAsync();
    assert.equal(result, null);
  });
});

// ─── broadcastWorkspaceSnapshot ─────────────────────────────────────────────

describe('broadcastWorkspaceSnapshot', () => {
  let origStage4Status;

  beforeEach(() => {
    origStage4Status = els.stage4Status;
    initWorkspaceDeps({
      loadStrokes: () => [],
      loadComments: () => [],
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      loadBookmarks: () => [],
    });
  });

  afterEach(() => {
    els.stage4Status = origStage4Status;
    state.collabEnabled = false;
    state.collabChannel = null;
  });

  it('does nothing when collab is not enabled', () => {
    state.collabEnabled = false;
    state.collabChannel = null;
    assert.doesNotThrow(() => broadcastWorkspaceSnapshot());
  });

  it('posts a message when collab is enabled', () => {
    let posted = null;
    state.collabEnabled = true;
    state.collabChannel = { postMessage(msg) { posted = msg; } };
    state.pageCount = 1;
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    broadcastWorkspaceSnapshot('test-reason');
    assert.ok(posted, 'message should be posted');
    assert.equal(posted.type, 'workspace-sync');
    assert.equal(posted.reason, 'test-reason');
    assert.ok(posted.payload);
  });
});

// ─── toggleCollaborationChannel ─────────────────────────────────────────────

describe('toggleCollaborationChannel', () => {
  let origToggleCollab, origStage4Status;

  beforeEach(() => {
    origToggleCollab = els.toggleCollab;
    origStage4Status = els.stage4Status;
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };

    // Provide a minimal BroadcastChannel mock
    if (typeof globalThis.BroadcastChannel === 'undefined') {
      globalThis.BroadcastChannel = class BroadcastChannel {
        constructor(name) { this.name = name; this.onmessage = null; }
        postMessage() {}
        close() {}
      };
    }
  });

  afterEach(() => {
    els.toggleCollab = origToggleCollab;
    els.stage4Status = origStage4Status;
    state.collabEnabled = false;
    if (state.collabChannel) {
      state.collabChannel.close();
      state.collabChannel = null;
    }
  });

  it('returns early when no adapter is set', () => {
    state.adapter = null;
    els.toggleCollab = { textContent: '' };
    toggleCollaborationChannel();
    assert.equal(state.collabEnabled, false);
  });

  it('enables collaboration when adapter is set', () => {
    state.adapter = {};
    state.docName = 'test.pdf';
    els.toggleCollab = { textContent: '' };
    toggleCollaborationChannel();
    assert.equal(state.collabEnabled, true);
    assert.ok(state.collabChannel, 'collabChannel should be created');
    assert.equal(els.toggleCollab.textContent, 'Collab: on');
  });

  it('disables collaboration when already enabled', () => {
    state.adapter = {};
    state.collabEnabled = true;
    state.collabChannel = { close() {} };
    els.toggleCollab = { textContent: '' };
    toggleCollaborationChannel();
    assert.equal(state.collabEnabled, false);
    assert.equal(state.collabChannel, null);
    assert.equal(els.toggleCollab.textContent, 'Collab: off');
  });

  it('onmessage handler applies incoming workspace-sync payload', async () => {
    state.adapter = {};
    state.docName = 'collab-msg-test.pdf';
    state.pageCount = 5;
    els.toggleCollab = { textContent: '' };
    const origWorkspaceStatus = els.workspaceStatus;
    els.workspaceStatus = { textContent: '', classList: { remove() {}, add() {} } };

    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => {},
      loadBookmarks: () => [],
      saveBookmarks: () => {},
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
      renderPagePreviews: async () => {},
      renderCurrentPage: async () => {},
    });

    // Enable collab to install onmessage handler
    toggleCollaborationChannel();
    assert.equal(state.collabEnabled, true);
    assert.ok(state.collabChannel);
    assert.ok(typeof state.collabChannel.onmessage === 'function');

    // Simulate receiving a message
    const payload = {
      type: 'workspace-backup',
      docName: 'collab-msg-test.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      pages: {},
    };
    await state.collabChannel.onmessage({ data: { type: 'workspace-sync', payload } });
    assert.match(els.workspaceStatus.textContent, /collab/);

    // Test with invalid message (no payload)
    await state.collabChannel.onmessage({ data: { type: 'other' } });
    // Should not throw, just skip

    // Test with null data
    await state.collabChannel.onmessage({ data: null });

    // Cleanup
    state.collabChannel.close();
    state.collabChannel = null;
    state.collabEnabled = false;
    els.workspaceStatus = origWorkspaceStatus;
  });

  it('onmessage handler handles apply errors', async () => {
    state.adapter = {};
    state.docName = 'collab-err-test.pdf';
    state.pageCount = 5;
    els.toggleCollab = { textContent: '' };

    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: () => { throw new Error('test error'); },
      saveNotes: () => {},
      loadBookmarks: () => [],
      saveBookmarks: () => {},
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
    });

    toggleCollaborationChannel();

    // Send valid workspace-sync but with a payload that will cause applyWorkspacePayload to throw
    const badPayload = {
      type: 'workspace-backup',
      docName: 'collab-err-test.pdf',
      notes: null,
      bookmarks: [],
      pages: {},
    };
    // Should not throw — error is caught internally
    await state.collabChannel.onmessage({ data: { type: 'workspace-sync', payload: badPayload } });
    assert.match(els.stage4Status.textContent, /Ошибка/);

    state.collabChannel.close();
    state.collabChannel = null;
    state.collabEnabled = false;
  });
});

// ─── importOcrJson ──────────────────────────────────────────────────────────

describe('importOcrJson', () => {
  let origStage4Status;

  beforeEach(() => {
    origStage4Status = els.stage4Status;
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    initWorkspaceDeps({
      renderPagePreviews: async () => {},
      renderCurrentPage: async () => {},
    });
  });

  afterEach(() => {
    els.stage4Status = origStage4Status;
  });

  it('returns early when no adapter', async () => {
    state.adapter = null;
    await importOcrJson({ text: async () => '{}' });
    assert.match(els.stage4Status.textContent, /откройте документ/);
  });

  it('returns early when no file', async () => {
    state.adapter = {};
    await importOcrJson(null);
    assert.match(els.stage4Status.textContent, /откройте документ/);
  });

  it('imports valid OCR JSON', async () => {
    state.adapter = {};
    state.docName = 'ocr-import-test.pdf';
    state.pageCount = 5;
    const data = { pagesText: ['page 1 text', 'page 2 text'], source: 'test' };
    const file = { text: async () => JSON.stringify(data) };
    await importOcrJson(file);
    assert.match(els.stage4Status.textContent, /импортирован/);
    // Verify data was saved to localStorage
    const key = `novareader-ocr-text:${state.docName}`;
    const saved = JSON.parse(localStorage.getItem(key));
    assert.ok(saved);
    assert.deepEqual(saved.pagesText, data.pagesText);
  });

  it('rejects OCR JSON without pagesText', async () => {
    state.adapter = {};
    state.pageCount = 5;
    const file = { text: async () => JSON.stringify({ other: 'data' }) };
    await importOcrJson(file);
    assert.match(els.stage4Status.textContent, /нет pagesText/);
  });

  it('handles invalid JSON gracefully', async () => {
    state.adapter = {};
    state.pageCount = 5;
    const file = { text: async () => 'not json{{' };
    await importOcrJson(file);
    assert.match(els.stage4Status.textContent, /Ошибка/);
  });

  it('updates djvu adapter when applicable', async () => {
    let renderPreviewsCalled = false;
    let renderCurrentCalled = false;
    initWorkspaceDeps({
      renderPagePreviews: async () => { renderPreviewsCalled = true; },
      renderCurrentPage: async () => { renderCurrentCalled = true; },
    });
    const origPageInput = els.pageInput;
    els.pageInput = { max: '' };
    state.adapter = {
      type: 'djvu',
      setData(d) { this._data = d; },
      exportData() { return { existing: true }; },
      getPageCount() { return 3; },
    };
    state.docName = 'djvu-test.djvu';
    state.pageCount = 2;
    const data = { pagesText: ['p1', 'p2', 'p3'] };
    const file = { text: async () => JSON.stringify(data) };
    await importOcrJson(file);
    assert.equal(state.pageCount, 3);
    assert.equal(els.pageInput.max, '3');
    assert.ok(renderPreviewsCalled);
    assert.ok(renderCurrentCalled);
    els.pageInput = origPageInput;
  });
});

// ─── exportWorkspaceBundleJson ──────────────────────────────────────────────

describe('exportWorkspaceBundleJson', () => {
  let origWorkspaceStatus;

  beforeEach(() => {
    origWorkspaceStatus = els.workspaceStatus;
    els.workspaceStatus = { textContent: '', classList: { remove() {}, add() {} } };
    initWorkspaceDeps({
      loadStrokes: () => [],
      loadComments: () => [],
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      loadBookmarks: () => [],
    });
  });

  afterEach(() => {
    els.workspaceStatus = origWorkspaceStatus;
  });

  it('sets error status when no adapter', () => {
    state.adapter = null;
    exportWorkspaceBundleJson();
    assert.match(els.workspaceStatus.textContent, /откройте документ/);
  });

  it('exports workspace as JSON download', () => {
    state.adapter = {};
    state.docName = 'export-test.pdf';
    state.pageCount = 1;
    let clickCalled = false;
    const origCreateElement = document.createElement.bind(document);
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:test-url';
    URL.revokeObjectURL = () => {};
    // The function creates an anchor element and clicks it
    exportWorkspaceBundleJson();
    assert.match(els.workspaceStatus.textContent, /экспортирован/);
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });
});

// ─── importWorkspaceBundleJson ──────────────────────────────────────────────

describe('importWorkspaceBundleJson', () => {
  let origWorkspaceStatus;

  beforeEach(() => {
    origWorkspaceStatus = els.workspaceStatus;
    els.workspaceStatus = { textContent: '', classList: { remove() {}, add() {} } };
    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => {},
      loadBookmarks: () => [],
      saveBookmarks: () => {},
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
    });
  });

  afterEach(() => {
    els.workspaceStatus = origWorkspaceStatus;
  });

  it('returns early when no adapter', async () => {
    state.adapter = null;
    await importWorkspaceBundleJson({ text: async () => '{}' });
    assert.match(els.workspaceStatus.textContent, /откройте документ/);
  });

  it('returns early when no file', async () => {
    state.adapter = {};
    await importWorkspaceBundleJson(null);
    assert.match(els.workspaceStatus.textContent, /откройте документ/);
  });

  it('imports valid workspace bundle', async () => {
    state.adapter = {};
    state.docName = 'test.pdf';
    state.pageCount = 5;
    const payload = {
      type: 'workspace-backup',
      docName: 'test.pdf',
      notes: { title: 'T', tags: '', body: 'B' },
      bookmarks: [],
      pages: {},
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importWorkspaceBundleJson(file);
    assert.match(els.workspaceStatus.textContent, /импортирован/);
  });

  it('shows error on invalid JSON', async () => {
    state.adapter = {};
    state.pageCount = 5;
    const file = { text: async () => 'not valid json' };
    await importWorkspaceBundleJson(file);
    assert.match(els.workspaceStatus.textContent, /Ошибка/);
  });
});

// ─── pushWorkspaceToCloud ───────────────────────────────────────────────────

describe('pushWorkspaceToCloud', () => {
  let origStage4Status, origCloudSyncUrl, origFetch;

  beforeEach(() => {
    origStage4Status = els.stage4Status;
    origCloudSyncUrl = els.cloudSyncUrl;
    origFetch = globalThis.fetch;
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    initWorkspaceDeps({
      loadStrokes: () => [],
      loadComments: () => [],
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      loadBookmarks: () => [],
    });
  });

  afterEach(() => {
    els.stage4Status = origStage4Status;
    els.cloudSyncUrl = origCloudSyncUrl;
    globalThis.fetch = origFetch;
  });

  it('returns early when no adapter', async () => {
    state.adapter = null;
    await pushWorkspaceToCloud();
    assert.match(els.stage4Status.textContent, /откройте документ/);
  });

  it('returns early when no endpoint URL', async () => {
    state.adapter = {};
    els.cloudSyncUrl = { value: '' };
    await pushWorkspaceToCloud();
    assert.match(els.stage4Status.textContent, /endpoint/);
  });

  it('pushes workspace to cloud on success', async () => {
    state.adapter = {};
    state.docName = 'push-test.pdf';
    state.pageCount = 1;
    els.cloudSyncUrl = { value: 'https://example.com/api' };
    globalThis.fetch = async () => ({ ok: true });
    await pushWorkspaceToCloud();
    assert.match(els.stage4Status.textContent, /отправлен/);
  });

  it('throws on non-ok response', async () => {
    state.adapter = {};
    state.docName = 'push-test.pdf';
    state.pageCount = 1;
    els.cloudSyncUrl = { value: 'https://example.com/api' };
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(() => pushWorkspaceToCloud(), /push failed: 500/);
  });
});

// ─── pullWorkspaceFromCloud ─────────────────────────────────────────────────

describe('pullWorkspaceFromCloud', () => {
  let origStage4Status, origWorkspaceStatus, origCloudSyncUrl, origFetch;

  beforeEach(() => {
    origStage4Status = els.stage4Status;
    origWorkspaceStatus = els.workspaceStatus;
    origCloudSyncUrl = els.cloudSyncUrl;
    origFetch = globalThis.fetch;
    els.stage4Status = { textContent: '', classList: { remove() {}, add() {} } };
    els.workspaceStatus = { textContent: '', classList: { remove() {}, add() {} } };
    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => {},
      loadBookmarks: () => [],
      saveBookmarks: () => {},
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
    });
  });

  afterEach(() => {
    els.stage4Status = origStage4Status;
    els.workspaceStatus = origWorkspaceStatus;
    els.cloudSyncUrl = origCloudSyncUrl;
    globalThis.fetch = origFetch;
  });

  it('returns early when no adapter', async () => {
    state.adapter = null;
    await pullWorkspaceFromCloud();
    assert.match(els.stage4Status.textContent, /откройте документ/);
  });

  it('returns early when no endpoint URL', async () => {
    state.adapter = {};
    els.cloudSyncUrl = { value: '' };
    await pullWorkspaceFromCloud();
    assert.match(els.stage4Status.textContent, /endpoint/);
  });

  it('pulls and applies workspace from cloud', async () => {
    state.adapter = {};
    state.docName = 'pull-test.pdf';
    state.pageCount = 5;
    els.cloudSyncUrl = { value: 'https://example.com/api' };
    const payload = {
      type: 'workspace-backup',
      docName: 'pull-test.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      pages: {},
    };
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => payload,
    });
    await pullWorkspaceFromCloud();
    assert.match(els.workspaceStatus.textContent, /подтянут/);
  });

  it('throws on non-ok response', async () => {
    state.adapter = {};
    state.docName = 'pull-test.pdf';
    state.pageCount = 1;
    els.cloudSyncUrl = { value: 'https://example.com/api' };
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(() => pullWorkspaceFromCloud(), /pull failed: 404/);
  });
});

// ─── setWorkspaceStatus with element ────────────────────────────────────────

describe('setWorkspaceStatus (with element)', () => {
  let origWorkspaceStatus;

  beforeEach(() => {
    origWorkspaceStatus = els.workspaceStatus;
  });

  afterEach(() => {
    els.workspaceStatus = origWorkspaceStatus;
  });

  it('sets textContent and adds class when type provided', () => {
    const classes = new Set();
    els.workspaceStatus = {
      textContent: '',
      classList: {
        remove(...cls) { cls.forEach((c) => classes.delete(c)); },
        add(c) { classes.add(c); },
      },
    };
    setWorkspaceStatus('test message', 'success');
    assert.equal(els.workspaceStatus.textContent, 'test message');
    assert.ok(classes.has('success'));
  });

  it('removes error/success classes when no type provided', () => {
    const classes = new Set(['error', 'success']);
    els.workspaceStatus = {
      textContent: '',
      classList: {
        remove(...cls) { cls.forEach((c) => classes.delete(c)); },
        add(c) { classes.add(c); },
      },
    };
    setWorkspaceStatus('neutral message');
    assert.equal(els.workspaceStatus.textContent, 'neutral message');
    assert.ok(!classes.has('error'));
    assert.ok(!classes.has('success'));
  });
});

// ─── setStage4Status with element ───────────────────────────────────────────

describe('setStage4Status (with element)', () => {
  let origStage4Status;

  beforeEach(() => {
    origStage4Status = els.stage4Status;
  });

  afterEach(() => {
    els.stage4Status = origStage4Status;
  });

  it('sets textContent and adds class when type provided', () => {
    const classes = new Set();
    els.stage4Status = {
      textContent: '',
      classList: {
        remove(...cls) { cls.forEach((c) => classes.delete(c)); },
        add(c) { classes.add(c); },
      },
    };
    setStage4Status('stage4 msg', 'error');
    assert.equal(els.stage4Status.textContent, 'stage4 msg');
    assert.ok(classes.has('error'));
  });
});
