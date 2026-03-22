// ─── Extended Unit Tests: Workspace Controller Module ────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  setWorkspaceStatus,
  setStage4Status,
  initReleaseGuards,
  cloudSyncUrlKey,
  loadCloudSyncUrl,
  saveCloudSyncUrl,
  ocrTextKey,
  loadOcrTextData,
  saveOcrTextData,
  loadOcrTextDataAsync,
  collabChannelName,
  broadcastWorkspaceSnapshot,
  initWorkspaceDeps,
  exportWorkspaceBundleJson,
  pushWorkspaceToCloud,
  pullWorkspaceFromCloud,
  importOcrJson,
} from '../../app/modules/workspace-controller.js';
import { state, els } from '../../app/modules/state.js';

// ─── setWorkspaceStatus / setStage4Status ───────────────────────────────────

describe('setWorkspaceStatus', () => {
  it('does not throw when workspaceStatus is null', () => {
    assert.doesNotThrow(() => setWorkspaceStatus('test'));
  });

  it('sets text when element exists', () => {
    const orig = els.workspaceStatus;
    els.workspaceStatus = {
      textContent: '',
      classList: { remove() {}, add() {} },
    };
    setWorkspaceStatus('hello', 'success');
    assert.equal(els.workspaceStatus.textContent, 'hello');
    els.workspaceStatus = orig;
  });
});

describe('setStage4Status', () => {
  it('does not throw when stage4Status is null', () => {
    assert.doesNotThrow(() => setStage4Status('test'));
  });

  it('sets text when element exists', () => {
    const orig = els.stage4Status;
    els.stage4Status = {
      textContent: '',
      classList: { remove() {}, add() {} },
    };
    setStage4Status('hello', 'error');
    assert.equal(els.stage4Status.textContent, 'hello');
    els.stage4Status = orig;
  });
});

// ─── initReleaseGuards ──────────────────────────────────────────────────────

describe('initReleaseGuards', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => initReleaseGuards());
  });
});

// ─── cloudSyncUrlKey / loadCloudSyncUrl / saveCloudSyncUrl ──────────────────

describe('cloudSyncUrlKey', () => {
  it('returns the key', () => {
    assert.equal(cloudSyncUrlKey(), 'novareader-cloud-sync-url');
  });
});

describe('loadCloudSyncUrl', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty string when no saved URL', () => {
    const result = loadCloudSyncUrl();
    assert.equal(typeof result, 'string');
  });

  it('returns saved URL', () => {
    localStorage.setItem('novareader-cloud-sync-url', 'https://example.com/api');
    assert.equal(loadCloudSyncUrl(), 'https://example.com/api');
  });
});

describe('saveCloudSyncUrl', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => saveCloudSyncUrl());
  });
});

// ─── ocrTextKey ─────────────────────────────────────────────────────────────

describe('ocrTextKey', () => {
  it('includes docName', () => {
    const origDocName = state.docName;
    state.docName = 'test.pdf';
    assert.ok(ocrTextKey().includes('test.pdf'));
    state.docName = origDocName;
  });

  it('uses global when no docName', () => {
    const origDocName = state.docName;
    state.docName = '';
    assert.ok(ocrTextKey().includes('global'));
    state.docName = origDocName;
  });
});

// ─── loadOcrTextData / saveOcrTextData ──────────────────────────────────────

describe('loadOcrTextData / saveOcrTextData', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when no data saved', () => {
    assert.equal(loadOcrTextData(), null);
  });

  it('saves and loads OCR text data', () => {
    const data = { pagesText: ['Hello', 'World'], pageCount: 2 };
    saveOcrTextData(data);
    const loaded = loadOcrTextData();
    assert.ok(loaded);
    assert.deepEqual(loaded.pagesText, ['Hello', 'World']);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(ocrTextKey(), 'not-json');
    assert.equal(loadOcrTextData(), null);
  });
});

// ─── loadOcrTextDataAsync ───────────────────────────────────────────────────

describe('loadOcrTextDataAsync', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to localStorage when IndexedDB fails', async () => {
    const data = { pagesText: ['Async'], pageCount: 1 };
    saveOcrTextData(data);
    const result = await loadOcrTextDataAsync();
    assert.ok(result);
    assert.deepEqual(result.pagesText, ['Async']);
  });
});

// ─── collabChannelName ──────────────────────────────────────────────────────

describe('collabChannelName', () => {
  it('includes docName', () => {
    const origDocName = state.docName;
    state.docName = 'collab-test.pdf';
    assert.ok(collabChannelName().includes('collab-test.pdf'));
    state.docName = origDocName;
  });

  it('uses global when no docName', () => {
    const origDocName = state.docName;
    state.docName = '';
    assert.ok(collabChannelName().includes('global'));
    state.docName = origDocName;
  });
});

// ─── broadcastWorkspaceSnapshot ─────────────────────────────────────────────

describe('broadcastWorkspaceSnapshot', () => {
  it('does nothing when collab is disabled', () => {
    const orig = state.collabEnabled;
    state.collabEnabled = false;
    assert.doesNotThrow(() => broadcastWorkspaceSnapshot());
    state.collabEnabled = orig;
  });
});

// ─── pushWorkspaceToCloud ───────────────────────────────────────────────────

describe('pushWorkspaceToCloud', () => {
  it('returns early when no adapter', async () => {
    const origAdapter = state.adapter;
    state.adapter = null;
    // Should not throw, just set status
    await assert.doesNotReject(pushWorkspaceToCloud());
    state.adapter = origAdapter;
  });
});

// ─── pullWorkspaceFromCloud ─────────────────────────────────────────────────

describe('pullWorkspaceFromCloud', () => {
  it('returns early when no adapter', async () => {
    const origAdapter = state.adapter;
    state.adapter = null;
    await assert.doesNotReject(pullWorkspaceFromCloud());
    state.adapter = origAdapter;
  });
});

// ─── importOcrJson ──────────────────────────────────────────────────────────

describe('importOcrJson', () => {
  it('returns early when no adapter', async () => {
    const origAdapter = state.adapter;
    state.adapter = null;
    await assert.doesNotReject(importOcrJson(null));
    state.adapter = origAdapter;
  });

  it('returns early when no file', async () => {
    const origAdapter = state.adapter;
    state.adapter = { type: 'pdf' };
    await assert.doesNotReject(importOcrJson(null));
    state.adapter = origAdapter;
  });
});

// ─── exportWorkspaceBundleJson ──────────────────────────────────────────────

describe('exportWorkspaceBundleJson', () => {
  it('returns early when no adapter', () => {
    const origAdapter = state.adapter;
    state.adapter = null;
    assert.doesNotThrow(() => exportWorkspaceBundleJson());
    state.adapter = origAdapter;
  });
});
