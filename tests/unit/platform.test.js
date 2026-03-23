import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTauri,
  openFileDialog,
  saveFileDialog,
  readFileAsBytes,
  downloadBlob,
  openExternal,
  setWindowTitle,
  getAppDataDir,
} from '../../app/modules/platform.js';

describe('platform', () => {
  describe('isTauri()', () => {
    it('returns false by default (browser mode)', () => {
      assert.strictEqual(isTauri(), false);
    });
  });

  describe('saveFileDialog()', () => {
    it('returns null in browser mode', async () => {
      const result = await saveFileDialog();
      assert.strictEqual(result, null);
    });

    it('returns null with options in browser mode', async () => {
      const result = await saveFileDialog({ title: 'Save', defaultPath: 'test.pdf' });
      assert.strictEqual(result, null);
    });
  });

  describe('readFileAsBytes()', () => {
    it('reads a File object as Uint8Array', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const file = new File([data], 'test.bin');
      const result = await readFileAsBytes(file);
      assert.ok(result instanceof Uint8Array);
      assert.deepStrictEqual([...result], [1, 2, 3, 4]);
    });

    it('throws for unsupported input type', async () => {
      await assert.rejects(
        () => readFileAsBytes('some/path'),
        { message: 'readFileAsBytes: unsupported input type' },
      );
    });
  });

  describe('downloadBlob()', () => {
    it('creates a link element and triggers click', () => {
      // downloadBlob should not throw in browser mock
      const blob = new Blob(['hello']);
      downloadBlob(blob, 'test.txt');
      // No assertion needed — just verifying no error is thrown
    });
  });

  describe('openExternal()', () => {
    it('blocks non-http URLs', async () => {
      // Should not throw, just warn and return
      await openExternal('javascript:alert(1)');
      await openExternal('data:text/html,<h1>hi</h1>');
      await openExternal('');
    });

    it('opens http URLs via window.open in browser mode', async () => {
      let openedUrl = null;
      const origOpen = globalThis.window.open;
      globalThis.window.open = (url) => { openedUrl = url; };
      try {
        await openExternal('https://example.com');
        assert.strictEqual(openedUrl, 'https://example.com');
      } finally {
        globalThis.window.open = origOpen;
      }
    });
  });

  describe('setWindowTitle()', () => {
    it('sets document.title in browser mode', async () => {
      await setWindowTitle('Test Title');
      assert.strictEqual(document.title, 'Test Title');
    });
  });

  describe('getAppDataDir()', () => {
    it('returns null in browser mode', async () => {
      const result = await getAppDataDir();
      assert.strictEqual(result, null);
    });
  });
});
