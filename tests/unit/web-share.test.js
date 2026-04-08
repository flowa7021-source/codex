import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isShareSupported,
  isFileShareSupported,
  shareDocument,
  shareText,
  shareUrl,
  downloadFallback,
} from '../../app/modules/web-share.js';

describe('web-share', () => {
  /** @type {any} */
  let origShare;
  /** @type {any} */
  let origCanShare;
  /** @type {any} */
  let lastShared;

  beforeEach(() => {
    origShare = navigator.share;
    origCanShare = navigator.canShare;
    lastShared = null;
    navigator.share = async (data) => { lastShared = data; };
    navigator.canShare = (data) => !!(data?.files);
  });

  afterEach(() => {
    navigator.share = origShare;
    navigator.canShare = origCanShare;
  });

  // ─── isShareSupported ──────────────────────────────────────────────────────

  describe('isShareSupported', () => {
    it('returns true when navigator.share exists', () => {
      assert.equal(isShareSupported(), true);
    });

    it('returns false when navigator.share is missing', () => {
      delete navigator.share;
      assert.equal(isShareSupported(), false);
    });
  });

  // ─── isFileShareSupported ──────────────────────────────────────────────────

  describe('isFileShareSupported', () => {
    it('returns true when canShare says yes', () => {
      assert.equal(isFileShareSupported(), true);
    });

    it('returns true for a custom MIME type', () => {
      assert.equal(isFileShareSupported('image/png'), true);
    });

    it('returns false when canShare is unavailable', () => {
      delete navigator.canShare;
      assert.equal(isFileShareSupported(), false);
    });

    it('returns false when canShare returns false', () => {
      navigator.canShare = () => false;
      assert.equal(isFileShareSupported(), false);
    });

    it('returns false when canShare throws', () => {
      navigator.canShare = () => { throw new Error('not supported'); };
      assert.equal(isFileShareSupported(), false);
    });
  });

  // ─── shareDocument ─────────────────────────────────────────────────────────

  describe('shareDocument', () => {
    it('calls navigator.share with a File', async () => {
      const blob = new Blob(['hello'], { type: 'application/pdf' });
      const result = await shareDocument(blob, 'test.pdf', { title: 'My Doc', text: 'A document' });
      assert.equal(result, true);
      assert.ok(lastShared);
      assert.equal(lastShared.files.length, 1);
      assert.equal(lastShared.files[0].name, 'test.pdf');
      assert.equal(lastShared.title, 'My Doc');
      assert.equal(lastShared.text, 'A document');
    });

    it('works without options', async () => {
      const blob = new Blob(['data']);
      const result = await shareDocument(blob, 'doc.pdf');
      assert.equal(result, true);
      assert.ok(lastShared);
      assert.equal(lastShared.title, undefined);
      assert.equal(lastShared.text, undefined);
    });

    it('returns false on AbortError (user cancel)', async () => {
      const abortErr = new DOMException('User cancelled', 'AbortError');
      navigator.share = async () => { throw abortErr; };
      const blob = new Blob(['test']);
      const result = await shareDocument(blob, 'test.pdf');
      assert.equal(result, false);
    });

    it('falls back to download on other errors', async () => {
      navigator.share = async () => { throw new Error('network error'); };
      let clickedHref = null;
      const origCreateElement = document.createElement;
      // Track the anchor that gets created
      const createElement = (tag) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          const origClick = el.click.bind(el);
          el.click = () => { clickedHref = el.href; origClick(); };
        }
        return el;
      };
      document.createElement = createElement;

      const blob = new Blob(['test']);
      const result = await shareDocument(blob, 'test.pdf');
      assert.equal(result, false);

      document.createElement = origCreateElement;
    });

    it('uses downloadFallback when navigator.share is missing', async () => {
      delete navigator.share;
      const blob = new Blob(['fallback']);
      const result = await shareDocument(blob, 'fallback.pdf');
      assert.equal(result, false);
    });
  });

  // ─── shareText ─────────────────────────────────────────────────────────────

  describe('shareText', () => {
    it('shares text data', async () => {
      const result = await shareText('Hello world', 'Greeting');
      assert.equal(result, true);
      assert.ok(lastShared);
      assert.equal(lastShared.text, 'Hello world');
      assert.equal(lastShared.title, 'Greeting');
    });

    it('shares text without title', async () => {
      const result = await shareText('Just text');
      assert.equal(result, true);
      assert.equal(lastShared.text, 'Just text');
      assert.equal(lastShared.title, undefined);
    });

    it('returns false when navigator.share is missing', async () => {
      delete navigator.share;
      const result = await shareText('no share');
      assert.equal(result, false);
    });

    it('returns false on AbortError', async () => {
      const abortErr = new DOMException('User cancelled', 'AbortError');
      navigator.share = async () => { throw abortErr; };
      const result = await shareText('cancel');
      assert.equal(result, false);
    });

    it('returns false on other errors', async () => {
      navigator.share = async () => { throw new Error('fail'); };
      const result = await shareText('error');
      assert.equal(result, false);
    });
  });

  // ─── shareUrl ──────────────────────────────────────────────────────────────

  describe('shareUrl', () => {
    it('shares URL data', async () => {
      const result = await shareUrl('https://example.com', 'Example');
      assert.equal(result, true);
      assert.ok(lastShared);
      assert.equal(lastShared.url, 'https://example.com');
      assert.equal(lastShared.title, 'Example');
    });

    it('shares URL without title', async () => {
      const result = await shareUrl('https://test.org');
      assert.equal(result, true);
      assert.equal(lastShared.url, 'https://test.org');
      assert.equal(lastShared.title, undefined);
    });

    it('returns false when navigator.share is missing', async () => {
      delete navigator.share;
      const result = await shareUrl('https://no-share.com');
      assert.equal(result, false);
    });

    it('returns false on AbortError', async () => {
      const abortErr = new DOMException('User cancelled', 'AbortError');
      navigator.share = async () => { throw abortErr; };
      const result = await shareUrl('https://cancel.com');
      assert.equal(result, false);
    });

    it('returns false on other errors', async () => {
      navigator.share = async () => { throw new Error('fail'); };
      const result = await shareUrl('https://error.com');
      assert.equal(result, false);
    });
  });

  // ─── downloadFallback ──────────────────────────────────────────────────────

  describe('downloadFallback', () => {
    it('creates and clicks an anchor element', () => {
      let anchorCreated = false;
      let anchorClicked = false;
      let anchorHref = null;
      let anchorDownload = null;
      let appendedToBody = false;
      let removedFromBody = false;
      let revokedUrl = false;

      const origCreateElement = document.createElement;
      const origAppendChild = document.body.appendChild;
      const origRemoveChild = document.body.removeChild;
      const origRevokeObjectURL = URL.revokeObjectURL;

      document.createElement = (tag) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          anchorCreated = true;
          const origClick = el.click.bind(el);
          el.click = () => {
            anchorClicked = true;
            anchorHref = el.href;
            anchorDownload = el.download;
            origClick();
          };
        }
        return el;
      };
      document.body.appendChild = (child) => {
        appendedToBody = true;
        return origAppendChild.call(document.body, child);
      };
      document.body.removeChild = (child) => {
        removedFromBody = true;
        return origRemoveChild.call(document.body, child);
      };
      URL.revokeObjectURL = (url) => {
        revokedUrl = true;
        origRevokeObjectURL(url);
      };

      const blob = new Blob(['download content'], { type: 'application/pdf' });
      downloadFallback(blob, 'document.pdf');

      assert.equal(anchorCreated, true, 'anchor element should be created');
      assert.equal(anchorClicked, true, 'anchor should be clicked');
      assert.equal(anchorDownload, 'document.pdf', 'download attribute should be set');
      assert.equal(appendedToBody, true, 'anchor should be appended to body');
      assert.equal(removedFromBody, true, 'anchor should be removed from body');
      assert.equal(revokedUrl, true, 'object URL should be revoked');

      // Restore
      document.createElement = origCreateElement;
      document.body.appendChild = origAppendChild;
      document.body.removeChild = origRemoveChild;
      URL.revokeObjectURL = origRevokeObjectURL;
    });
  });
});
