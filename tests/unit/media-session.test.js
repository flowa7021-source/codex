// ─── Unit Tests: Media Session API ───────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isMediaSessionSupported,
  setMediaMetadata,
  setPlaybackState,
  setActionHandler,
  clearMediaSession,
} from '../../app/modules/media-session.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let mockHandlers;

beforeEach(() => {
  mockHandlers = new Map();
  globalThis.navigator.mediaSession = {
    metadata: null,
    playbackState: 'none',
    setActionHandler(action, handler) { mockHandlers.set(action, handler); },
  };
  globalThis.MediaMetadata = class MediaMetadata {
    constructor(init) { Object.assign(this, init); }
  };
});

afterEach(() => {
  delete globalThis.navigator.mediaSession;
  delete globalThis.MediaMetadata;
});

// ─── isMediaSessionSupported ──────────────────────────────────────────────────

describe('isMediaSessionSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isMediaSessionSupported(), 'boolean');
  });

  it('returns true when mediaSession is present on navigator', () => {
    assert.equal(isMediaSessionSupported(), true);
  });

  it('returns false when mediaSession is absent', () => {
    delete globalThis.navigator.mediaSession;
    assert.equal(isMediaSessionSupported(), false);
  });
});

// ─── setMediaMetadata ─────────────────────────────────────────────────────────

describe('setMediaMetadata', () => {
  it('sets title on navigator.mediaSession.metadata', () => {
    setMediaMetadata({ title: 'My PDF' });
    assert.equal(globalThis.navigator.mediaSession.metadata.title, 'My PDF');
  });

  it('sets artist on navigator.mediaSession.metadata', () => {
    setMediaMetadata({ artist: 'Author Name' });
    assert.equal(globalThis.navigator.mediaSession.metadata.artist, 'Author Name');
  });

  it('sets album on navigator.mediaSession.metadata', () => {
    setMediaMetadata({ album: 'Collection' });
    assert.equal(globalThis.navigator.mediaSession.metadata.album, 'Collection');
  });

  it('sets all fields together', () => {
    setMediaMetadata({ title: 'Title', artist: 'Artist', album: 'Album' });
    const meta = globalThis.navigator.mediaSession.metadata;
    assert.equal(meta.title, 'Title');
    assert.equal(meta.artist, 'Artist');
    assert.equal(meta.album, 'Album');
  });

  it('sets artwork when provided', () => {
    const artwork = [{ src: 'cover.png', sizes: '128x128', type: 'image/png' }];
    setMediaMetadata({ title: 'T', artwork });
    assert.deepEqual(globalThis.navigator.mediaSession.metadata.artwork, artwork);
  });

  it('falls back gracefully when MediaMetadata constructor throws', () => {
    globalThis.MediaMetadata = class MediaMetadata {
      constructor() { throw new Error('not supported'); }
    };
    setMediaMetadata({ title: 'Fallback' });
    assert.equal(globalThis.navigator.mediaSession.metadata.title, 'Fallback');
  });

  it('is a no-op when mediaSession is unsupported', () => {
    delete globalThis.navigator.mediaSession;
    // Should not throw
    assert.doesNotThrow(() => setMediaMetadata({ title: 'Ignored' }));
  });
});

// ─── setPlaybackState ─────────────────────────────────────────────────────────

describe('setPlaybackState', () => {
  it('sets playbackState to "playing"', () => {
    setPlaybackState('playing');
    assert.equal(globalThis.navigator.mediaSession.playbackState, 'playing');
  });

  it('sets playbackState to "paused"', () => {
    setPlaybackState('paused');
    assert.equal(globalThis.navigator.mediaSession.playbackState, 'paused');
  });

  it('sets playbackState to "none"', () => {
    setPlaybackState('playing');
    setPlaybackState('none');
    assert.equal(globalThis.navigator.mediaSession.playbackState, 'none');
  });

  it('is a no-op when mediaSession is unsupported', () => {
    delete globalThis.navigator.mediaSession;
    assert.doesNotThrow(() => setPlaybackState('playing'));
  });
});

// ─── setActionHandler ─────────────────────────────────────────────────────────

describe('setActionHandler', () => {
  it('registers a play handler', () => {
    const handler = () => {};
    setActionHandler('play', handler);
    assert.equal(mockHandlers.get('play'), handler);
  });

  it('registers a pause handler', () => {
    const handler = () => {};
    setActionHandler('pause', handler);
    assert.equal(mockHandlers.get('pause'), handler);
  });

  it('registers a nexttrack handler', () => {
    const handler = () => {};
    setActionHandler('nexttrack', handler);
    assert.equal(mockHandlers.get('nexttrack'), handler);
  });

  it('registers a previoustrack handler', () => {
    const handler = () => {};
    setActionHandler('previoustrack', handler);
    assert.equal(mockHandlers.get('previoustrack'), handler);
  });

  it('returns a cleanup function', () => {
    const cleanup = setActionHandler('play', () => {});
    assert.equal(typeof cleanup, 'function');
  });

  it('cleanup function removes the handler by setting it to null', () => {
    const cleanup = setActionHandler('play', () => {});
    cleanup();
    assert.equal(mockHandlers.get('play'), null);
  });

  it('returns a no-op cleanup when mediaSession is unsupported', () => {
    delete globalThis.navigator.mediaSession;
    const cleanup = setActionHandler('play', () => {});
    assert.equal(typeof cleanup, 'function');
    assert.doesNotThrow(() => cleanup());
  });

  it('allows setting a null handler to remove it', () => {
    setActionHandler('play', () => {});
    setActionHandler('play', null);
    assert.equal(mockHandlers.get('play'), null);
  });
});

// ─── clearMediaSession ────────────────────────────────────────────────────────

describe('clearMediaSession', () => {
  it('resets playbackState to "none"', () => {
    globalThis.navigator.mediaSession.playbackState = 'playing';
    clearMediaSession();
    assert.equal(globalThis.navigator.mediaSession.playbackState, 'none');
  });

  it('clears metadata to null', () => {
    setMediaMetadata({ title: 'My PDF' });
    clearMediaSession();
    assert.equal(globalThis.navigator.mediaSession.metadata, null);
  });

  it('removes registered action handlers', () => {
    const handler = () => {};
    setActionHandler('play', handler);
    setActionHandler('pause', handler);
    clearMediaSession();
    assert.equal(mockHandlers.get('play'), null);
    assert.equal(mockHandlers.get('pause'), null);
  });

  it('is a no-op when mediaSession is unsupported', () => {
    delete globalThis.navigator.mediaSession;
    assert.doesNotThrow(() => clearMediaSession());
  });

  it('does not throw when setActionHandler throws for unsupported actions', () => {
    globalThis.navigator.mediaSession.setActionHandler = (action, handler) => {
      if (action === 'skipad') throw new Error('unsupported action');
      mockHandlers.set(action, handler);
    };
    assert.doesNotThrow(() => clearMediaSession());
  });
});
