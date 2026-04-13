// ─── Unit Tests: Content Index API ───────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isContentIndexSupported,
  addToContentIndex,
  removeFromContentIndex,
  getContentIndexEntries,
  syncDocumentToIndex,
} from '../../app/modules/content-index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock SW registration with a Content Index. */
function mockSwReg(overrides = {}) {
  return {
    index: {
      add: async () => {},
      delete: async () => {},
      getAll: async () => [],
      ...overrides,
    },
  };
}

/** Install a mock serviceWorker on navigator that resolves to swReg. */
function installSwMock(swReg) {
  (navigator).serviceWorker = {
    ready: Promise.resolve(swReg),
  };
}

/** Remove the serviceWorker mock from navigator. */
function removeSwMock() {
  delete (navigator).serviceWorker;
}

// ─── beforeEach: reset navigator state ───────────────────────────────────────

beforeEach(() => {
  removeSwMock();
});

// ─── isContentIndexSupported ──────────────────────────────────────────────────

describe('isContentIndexSupported', () => {
  it('returns a boolean', () => {
    const result = isContentIndexSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when serviceWorker is absent from navigator', () => {
    // navigator.serviceWorker already removed in beforeEach
    assert.equal(isContentIndexSupported(), false);
  });

  it('returns false when navigator.serviceWorker has no index property', () => {
    // SW present but no index on the registration object
    (navigator).serviceWorker = { ready: Promise.resolve({}) };
    assert.equal(isContentIndexSupported(), false);
    delete (navigator).serviceWorker;
  });

  it('returns true when serviceWorker and index are both present', () => {
    (navigator).serviceWorker = {
      ready: Promise.resolve(mockSwReg()),
      index: {},
    };
    assert.equal(isContentIndexSupported(), true);
    delete (navigator).serviceWorker;
  });
});

// ─── addToContentIndex ────────────────────────────────────────────────────────

describe('addToContentIndex', () => {
  const entry = {
    id: 'doc-1',
    title: 'Test Document',
    url: '/docs/test.pdf',
    category: 'article',
  };

  it('returns false when serviceWorker is absent', async () => {
    const result = await addToContentIndex(entry);
    assert.equal(result, false);
  });

  it('returns false when SW registration has no index', async () => {
    installSwMock({});
    const result = await addToContentIndex(entry);
    assert.equal(result, false);
    removeSwMock();
  });

  it('returns true when mock SW and index are present', async () => {
    installSwMock(mockSwReg());
    const result = await addToContentIndex(entry);
    assert.equal(result, true);
    removeSwMock();
  });

  it('returns false when index.add rejects', async () => {
    installSwMock(mockSwReg({
      add: async () => { throw new Error('quota exceeded'); },
    }));
    const result = await addToContentIndex(entry);
    assert.equal(result, false);
    removeSwMock();
  });

  it('calls index.add with the entry object', async () => {
    let received = null;
    installSwMock(mockSwReg({
      add: async (e) => { received = e; },
    }));
    await addToContentIndex(entry);
    assert.deepEqual(received, entry);
    removeSwMock();
  });
});

// ─── removeFromContentIndex ───────────────────────────────────────────────────

describe('removeFromContentIndex', () => {
  it('returns false when serviceWorker is absent', async () => {
    const result = await removeFromContentIndex('doc-1');
    assert.equal(result, false);
  });

  it('returns false when SW registration has no index', async () => {
    installSwMock({});
    const result = await removeFromContentIndex('doc-1');
    assert.equal(result, false);
    removeSwMock();
  });

  it('returns true when mock SW and index are present', async () => {
    installSwMock(mockSwReg());
    const result = await removeFromContentIndex('doc-1');
    assert.equal(result, true);
    removeSwMock();
  });

  it('returns false when index.delete rejects', async () => {
    installSwMock(mockSwReg({
      delete: async () => { throw new Error('not found'); },
    }));
    const result = await removeFromContentIndex('doc-1');
    assert.equal(result, false);
    removeSwMock();
  });
});

// ─── getContentIndexEntries ───────────────────────────────────────────────────

describe('getContentIndexEntries', () => {
  it('returns [] when serviceWorker is absent', async () => {
    const result = await getContentIndexEntries();
    assert.deepEqual(result, []);
  });

  it('returns [] when SW registration has no index', async () => {
    installSwMock({});
    const result = await getContentIndexEntries();
    assert.deepEqual(result, []);
    removeSwMock();
  });

  it('returns entries from the mock index', async () => {
    const entries = [
      { id: 'a', title: 'A', url: '/a.pdf', category: 'article' },
      { id: 'b', title: 'B', url: '/b.pdf', category: 'article' },
    ];
    installSwMock(mockSwReg({
      getAll: async () => entries,
    }));
    const result = await getContentIndexEntries();
    assert.deepEqual(result, entries);
    removeSwMock();
  });

  it('returns [] when index.getAll rejects', async () => {
    installSwMock(mockSwReg({
      getAll: async () => { throw new Error('IPC error'); },
    }));
    const result = await getContentIndexEntries();
    assert.deepEqual(result, []);
    removeSwMock();
  });
});

// ─── syncDocumentToIndex ──────────────────────────────────────────────────────

describe('syncDocumentToIndex', () => {
  it('returns false when serviceWorker is absent', async () => {
    const result = await syncDocumentToIndex({
      id: 'doc-sync',
      title: 'Sync Doc',
      url: '/sync.pdf',
    });
    assert.equal(result, false);
  });

  it('calls addToContentIndex with category="article"', async () => {
    let received = null;
    installSwMock(mockSwReg({
      add: async (e) => { received = e; },
    }));
    await syncDocumentToIndex({
      id: 'doc-sync',
      title: 'Sync Doc',
      url: '/sync.pdf',
      description: 'A synced document',
    });
    assert.equal(received?.category, 'article');
    assert.equal(received?.id, 'doc-sync');
    assert.equal(received?.title, 'Sync Doc');
    assert.equal(received?.url, '/sync.pdf');
    assert.equal(received?.description, 'A synced document');
    removeSwMock();
  });

  it('returns true when mock SW and index are present', async () => {
    installSwMock(mockSwReg());
    const result = await syncDocumentToIndex({
      id: 'doc-sync-2',
      title: 'Another Doc',
      url: '/another.pdf',
    });
    assert.equal(result, true);
    removeSwMock();
  });

  it('returns false when index.add rejects', async () => {
    installSwMock(mockSwReg({
      add: async () => { throw new Error('failed'); },
    }));
    const result = await syncDocumentToIndex({
      id: 'doc-err',
      title: 'Error Doc',
      url: '/error.pdf',
    });
    assert.equal(result, false);
    removeSwMock();
  });
});
