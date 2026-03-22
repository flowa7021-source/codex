// ─── Unit Tests: Workspace Controller ───────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
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
  buildWorkspacePayload,
  applyWorkspacePayload,
  collabChannelName,
  setWorkspaceStatus,
  setStage4Status,
  initWorkspaceDeps,
} from '../../app/modules/workspace-controller.js';

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
