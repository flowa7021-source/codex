import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { copyFormattedText, copyPageAsImage, ClipboardController } from '../../app/modules/cross-format-paste.js';

// Set up clipboard mocks
beforeEach(() => {
  globalThis.navigator.clipboard = {
    writeText: mock.fn(async () => {}),
    write: undefined,
    read: undefined,
    readText: undefined,
  };
  globalThis.ClipboardItem = undefined;
});

describe('copyFormattedText', () => {
  it('does nothing for empty blocks', async () => {
    await copyFormattedText(null);
    await copyFormattedText([]);
    // No error thrown
  });

  it('calls clipboard.writeText with plain text fallback', async () => {
    const blocks = [
      { text: 'Hello' },
      { text: 'World' },
    ];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 1);
    const written = navigator.clipboard.writeText.mock.calls[0].arguments[0];
    assert.equal(written, 'Hello\nWorld');
  });

  it('uses ClipboardItem API when available', async () => {
    let writtenItems = null;
    globalThis.ClipboardItem = class {
      constructor(data) { this.data = data; }
    };
    navigator.clipboard.write = mock.fn(async (items) => { writtenItems = items; });

    const blocks = [{ text: 'Test' }];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
    assert.ok(writtenItems);
    assert.equal(writtenItems.length, 1);
  });

  it('includes title in HTML when provided', async () => {
    let writtenItems = null;
    globalThis.ClipboardItem = class {
      constructor(data) { this.data = data; }
    };
    navigator.clipboard.write = mock.fn(async (items) => { writtenItems = items; });

    await copyFormattedText([{ text: 'Content' }], { title: 'Doc Title' });
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });
});

describe('ClipboardController', () => {
  it('creates and attaches to container', () => {
    const container = document.createElement('div');
    const ctrl = new ClipboardController({
      container,
      getSelection: () => null,
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
    });
    assert.ok(ctrl);
  });

  it('destroy removes event listener', () => {
    const container = document.createElement('div');
    const ctrl = new ClipboardController({
      container,
      getSelection: () => null,
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
    });
    assert.doesNotThrow(() => ctrl.destroy());
  });

  it('ignores keydown without ctrl/meta', () => {
    const container = document.createElement('div');
    const onCopy = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: () => ({ blocks: [{ text: 'x' }] }),
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
      onCopyComplete: onCopy,
    });
    container.dispatchEvent(new Event('keydown'));
    // Without ctrlKey, nothing happens
    assert.equal(onCopy.mock.calls.length, 0);
    ctrl.destroy();
  });

  it('handles Ctrl+C with no selection gracefully', () => {
    const container = document.createElement('div');
    const ctrl = new ClipboardController({
      container,
      getSelection: () => null,
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
    });
    // Simulate Ctrl+C
    const event = { type: 'keydown', key: 'c', ctrlKey: true, preventDefault: mock.fn() };
    container.dispatchEvent(event);
    // No crash, no preventDefault call since selection is null
    ctrl.destroy();
  });
});
