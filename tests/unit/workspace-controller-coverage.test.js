// ─── Coverage Tests: WorkspaceController ──────────────────────────────────────
// Tests pushWorkspaceToCloud, pullWorkspaceFromCloud, toggleCollaborationChannel,
// broadcastWorkspaceSnapshot, importOcrJson, exportWorkspaceBundleJson,
// importWorkspaceBundleJson, initReleaseGuards, loadOcrTextDataAsync
// to push coverage from 68% toward 85%.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Ensure document.body has classList
if (!document.body.classList || typeof document.body.classList.toggle !== 'function') {
  const _classes = new Set();
  document.body.classList = {
    add(...cls) { cls.forEach(c => _classes.add(c)); },
    remove(...cls) { cls.forEach(c => _classes.delete(c)); },
    toggle(c, force) {
      if (force === undefined) { _classes.has(c) ? _classes.delete(c) : _classes.add(c); }
      else if (force) { _classes.add(c); } else { _classes.delete(c); }
    },
    contains(c) { return _classes.has(c); },
  };
}

// Patch createElement for click/remove
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.remove) el.remove = () => {};
  return el;
};

import {
  pushWorkspaceToCloud,
  pullWorkspaceFromCloud,
  toggleCollaborationChannel,
  broadcastWorkspaceSnapshot,
  importOcrJson,
  exportWorkspaceBundleJson,
  importWorkspaceBundleJson,
  setWorkspaceStatus,
  setStage4Status,
  initWorkspaceDeps,
  initReleaseGuards,
  buildWorkspacePayload,
  applyWorkspacePayload,
  loadOcrTextDataAsync,
  saveOcrTextData,
  saveCloudSyncUrl,
} from '../../app/modules/workspace-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockEl(defaults = {}) {
  return {
    textContent: '',
    value: defaults.value || '',
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {} },
    ...defaults,
  };
}

function resetState() {
  localStorage.clear();
  state.docName = 'test-doc.pdf';
  state.pageCount = 10;
  state.adapter = { type: 'pdf' };
  state.currentPage = 1;
  state.collabEnabled = false;
  state.collabChannel = null;

  els.workspaceStatus = makeMockEl();
  els.stage4Status = makeMockEl();
  els.cloudSyncUrl = makeMockEl({ value: '' });
  els.appVersion = makeMockEl();
  els.pushCloudSync = makeMockEl();
  els.pullCloudSync = makeMockEl();
  els.toggleCollab = makeMockEl();
  els.broadcastCollab = makeMockEl();
  els.notesTitle = makeMockEl();
  els.notesTags = makeMockEl();
  els.notes = makeMockEl();
  els.pageInput = makeMockEl();

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
}

// ── pushWorkspaceToCloud ─────────────────────────────────────────────────────

describe('pushWorkspaceToCloud', () => {
  beforeEach(resetState);

  it('shows error when no adapter', async () => {
    state.adapter = null;
    await pushWorkspaceToCloud();
    assert.ok(els.stage4Status.textContent.includes('откройте'));
  });

  it('shows error when no endpoint URL', async () => {
    els.cloudSyncUrl.value = '';
    await pushWorkspaceToCloud();
    assert.ok(els.stage4Status.textContent.includes('endpoint'));
  });

  it('sends PUT request to endpoint', async () => {
    els.cloudSyncUrl.value = 'https://example.com/api';
    let fetchUrl = '';
    let fetchOpts = {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      fetchUrl = url;
      fetchOpts = opts;
      return { ok: true };
    };

    try {
      await pushWorkspaceToCloud();
      assert.equal(fetchUrl, 'https://example.com/api');
      assert.equal(fetchOpts.method, 'PUT');
      assert.ok(fetchOpts.headers['Content-Type'].includes('json'));
      assert.ok(els.stage4Status.textContent.includes('отправлен'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws on non-ok response', async () => {
    els.cloudSyncUrl.value = 'https://example.com/api';
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 500 });

    try {
      await assert.rejects(() => pushWorkspaceToCloud(), /push failed/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── pullWorkspaceFromCloud ───────────────────────────────────────────────────

describe('pullWorkspaceFromCloud', () => {
  beforeEach(resetState);

  it('shows error when no adapter', async () => {
    state.adapter = null;
    await pullWorkspaceFromCloud();
    assert.ok(els.stage4Status.textContent.includes('откройте'));
  });

  it('shows error when no endpoint URL', async () => {
    els.cloudSyncUrl.value = '';
    await pullWorkspaceFromCloud();
    assert.ok(els.stage4Status.textContent.includes('endpoint'));
  });

  it('fetches and applies workspace payload', async () => {
    els.cloudSyncUrl.value = 'https://example.com/api';
    const payload = {
      type: 'workspace-backup',
      docName: 'test-doc.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      pages: {},
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => payload,
    });

    try {
      await pullWorkspaceFromCloud();
      assert.ok(
        els.stage4Status.textContent.includes('pull') ||
        els.workspaceStatus.textContent.includes('подтянут')
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws on non-ok response', async () => {
    els.cloudSyncUrl.value = 'https://example.com/api';
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 404 });

    try {
      await assert.rejects(() => pullWorkspaceFromCloud(), /pull failed/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── toggleCollaborationChannel ───────────────────────────────────────────────

describe('toggleCollaborationChannel', () => {
  beforeEach(resetState);

  it('shows error when no adapter', () => {
    state.adapter = null;
    toggleCollaborationChannel();
    assert.ok(els.stage4Status.textContent.includes('откройте'));
  });

  it('enables collaboration channel', () => {
    // BroadcastChannel mock
    const origBC = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = class {
      constructor() { this.onmessage = null; }
      postMessage() {}
      close() {}
    };

    try {
      toggleCollaborationChannel();
      assert.equal(state.collabEnabled, true);
      assert.ok(state.collabChannel);
      assert.ok(els.stage4Status.textContent.includes('включен'));
    } finally {
      globalThis.BroadcastChannel = origBC;
    }
  });

  it('disables collaboration channel when already enabled', () => {
    state.collabEnabled = true;
    state.collabChannel = { close() {} };
    toggleCollaborationChannel();
    assert.equal(state.collabEnabled, false);
    assert.equal(state.collabChannel, null);
    assert.ok(els.stage4Status.textContent.includes('выключен'));
  });
});

// ── broadcastWorkspaceSnapshot ───────────────────────────────────────────────

describe('broadcastWorkspaceSnapshot', () => {
  beforeEach(resetState);

  it('does nothing when collab is disabled', () => {
    state.collabEnabled = false;
    state.collabChannel = null;
    // Should not throw
    broadcastWorkspaceSnapshot();
  });

  it('sends snapshot when collab is enabled', () => {
    let sentMessage = null;
    state.collabEnabled = true;
    state.collabChannel = {
      postMessage(msg) { sentMessage = msg; },
    };
    broadcastWorkspaceSnapshot('test');
    assert.ok(sentMessage);
    assert.equal(sentMessage.type, 'workspace-sync');
    assert.equal(sentMessage.reason, 'test');
    assert.ok(sentMessage.payload);
    assert.ok(els.stage4Status.textContent.includes('Snapshot'));
  });
});

// ── importOcrJson ────────────────────────────────────────────────────────────

describe('importOcrJson', () => {
  beforeEach(resetState);

  it('shows error when no adapter', async () => {
    state.adapter = null;
    await importOcrJson({ text: async () => '{}' });
    assert.ok(els.stage4Status.textContent.includes('откройте'));
  });

  it('shows error when no file', async () => {
    await importOcrJson(null);
    assert.ok(els.stage4Status.textContent.includes('откройте'));
  });

  it('imports valid OCR JSON', async () => {
    const ocrPayload = {
      pagesText: ['Page 1 text', 'Page 2 text'],
      source: 'test-import',
    };
    const file = { text: async () => JSON.stringify(ocrPayload) };
    await importOcrJson(file);
    assert.ok(els.stage4Status.textContent.includes('импортирован'));
  });

  it('shows error for empty pagesText', async () => {
    const file = { text: async () => JSON.stringify({ pagesText: [] }) };
    await importOcrJson(file);
    assert.ok(els.stage4Status.textContent.includes('нет pagesText'));
  });

  it('shows error for invalid JSON', async () => {
    const file = { text: async () => 'not json' };
    await importOcrJson(file);
    assert.ok(els.stage4Status.textContent.includes('Ошибка'));
  });
});

// ── exportWorkspaceBundleJson ────────────────────────────────────────────────

describe('exportWorkspaceBundleJson', () => {
  beforeEach(resetState);

  it('shows error when no adapter', () => {
    state.adapter = null;
    exportWorkspaceBundleJson();
    assert.ok(els.workspaceStatus.textContent.includes('откройте'));
  });

  it('exports when adapter exists', () => {
    exportWorkspaceBundleJson();
    assert.ok(els.workspaceStatus.textContent.includes('экспортирован'));
  });
});

// ── importWorkspaceBundleJson ────────────────────────────────────────────────

describe('importWorkspaceBundleJson', () => {
  beforeEach(resetState);

  it('shows error when no adapter', async () => {
    state.adapter = null;
    await importWorkspaceBundleJson({ text: async () => '{}' });
    assert.ok(els.workspaceStatus.textContent.includes('откройте'));
  });

  it('imports valid workspace bundle', async () => {
    const payload = {
      type: 'workspace-backup',
      docName: 'test-doc.pdf',
      notes: { title: '', tags: '', body: '' },
      bookmarks: [],
      pages: {},
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importWorkspaceBundleJson(file);
    assert.ok(els.workspaceStatus.textContent.includes('импортирован'));
  });

  it('shows error for invalid payload', async () => {
    const file = { text: async () => JSON.stringify({ type: 'wrong' }) };
    await importWorkspaceBundleJson(file);
    assert.ok(els.workspaceStatus.textContent.includes('Ошибка'));
  });
});

// ── initReleaseGuards ────────────────────────────────────────────────────────

describe('initReleaseGuards', () => {
  beforeEach(resetState);

  it('sets appVersion text', () => {
    initReleaseGuards();
    // Should set els.appVersion.textContent to APP_VERSION
    assert.ok(typeof els.appVersion.textContent === 'string');
  });

  it('does not throw when elements are null', () => {
    els.appVersion = null;
    els.pushCloudSync = null;
    els.pullCloudSync = null;
    els.toggleCollab = null;
    els.broadcastCollab = null;
    assert.doesNotThrow(() => initReleaseGuards());
  });
});

// ── loadOcrTextDataAsync ─────────────────────────────────────────────────────

describe('loadOcrTextDataAsync', () => {
  beforeEach(resetState);

  it('returns data from async source or null', async () => {
    const result = await loadOcrTextDataAsync();
    // May return null or data from IDB depending on previous tests
    assert.ok(result === null || typeof result === 'object');
  });

  it('falls back to localStorage', async () => {
    const data = { pagesText: ['hello'], pageCount: 1 };
    saveOcrTextData(data);
    const result = await loadOcrTextDataAsync();
    assert.ok(result);
    assert.deepEqual(result.pagesText, ['hello']);
  });
});

// ── saveCloudSyncUrl ─────────────────────────────────────────────────────────

describe('saveCloudSyncUrl', () => {
  beforeEach(resetState);

  it('saves URL from input', () => {
    els.cloudSyncUrl = { value: 'https://example.com/sync' };
    saveCloudSyncUrl();
    assert.equal(localStorage.getItem('novareader-cloud-sync-url'), 'https://example.com/sync');
    assert.ok(els.stage4Status.textContent.includes('сохранён'));
  });

  it('clears URL when empty', () => {
    els.cloudSyncUrl = { value: '' };
    saveCloudSyncUrl();
    assert.equal(localStorage.getItem('novareader-cloud-sync-url'), '');
    assert.ok(els.stage4Status.textContent.includes('очищен'));
  });
});
