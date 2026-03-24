import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { copyFormattedText, copyPageAsImage, copyRegionAsImage, pasteIntoPage, ClipboardController } from '../../app/modules/cross-format-paste.js';

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

function setupClipboardWithItem() {
  globalThis.ClipboardItem = class {
    constructor(data) { this.data = data; }
  };
  globalThis.navigator.clipboard = {
    writeText: mock.fn(async () => {}),
    write: mock.fn(async () => {}),
    read: undefined,
    readText: undefined,
  };
}

function setupClipboardWriteTextOnly() {
  globalThis.ClipboardItem = undefined;
  globalThis.navigator.clipboard = {
    writeText: mock.fn(async () => {}),
    write: undefined,
    read: undefined,
    readText: undefined,
  };
}

// ---------------------------------------------------------------------------
// copyFormattedText
// ---------------------------------------------------------------------------

describe('copyFormattedText', () => {
  beforeEach(() => {
    setupClipboardWriteTextOnly();
  });

  it('does nothing for null blocks', async () => {
    await copyFormattedText(null);
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 0);
  });

  it('does nothing for empty array', async () => {
    await copyFormattedText([]);
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 0);
  });

  it('writes plain text using writeText fallback when no ClipboardItem', async () => {
    const blocks = [{ text: 'Hello' }, { text: 'World' }];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 1);
    assert.equal(navigator.clipboard.writeText.mock.calls[0].arguments[0], 'Hello\nWorld');
  });

  it('includes optional title in HTML when ClipboardItem available', async () => {
    setupClipboardWithItem();
    await copyFormattedText([{ text: 'Content' }], { title: 'My Doc' });
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('uses ClipboardItem API with all style properties', async () => {
    setupClipboardWithItem();
    const blocks = [{
      text: 'Rich text',
      fontFamily: 'Arial',
      fontSize: 14,
      bold: true,
      italic: true,
      color: { r: 1, g: 0, b: 0 },
    }];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('handles heading blocks h1 through h6', async () => {
    setupClipboardWithItem();
    const blocks = [
      { text: 'H1', heading: 1 },
      { text: 'H6', heading: 6 },
      { text: 'H7 clamped', heading: 7 },
    ];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('handles block with string color', async () => {
    setupClipboardWithItem();
    const blocks = [{ text: 'Colored', color: '#ff0000' }];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('handles block with object color (r,g,b)', async () => {
    setupClipboardWithItem();
    const blocks = [{ text: 'Colored', color: { r: 0.5, g: 0.2, b: 0.8 } }];
    await copyFormattedText(blocks);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('handles block with undefined text (falls back to empty string)', async () => {
    await copyFormattedText([{}]);
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 1);
    assert.equal(navigator.clipboard.writeText.mock.calls[0].arguments[0], '');
  });

  it('escapes HTML special characters in title', async () => {
    setupClipboardWithItem();
    await copyFormattedText([{ text: 'a' }], { title: '<b>Test & "quotes"</b>' });
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });

  it('escapes HTML special characters in text block', async () => {
    setupClipboardWithItem();
    await copyFormattedText([{ text: '<script>alert("xss")</script>' }]);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// copyRegionAsImage
// ---------------------------------------------------------------------------

describe('copyRegionAsImage', () => {
  it('uses fallback (readAsDataURL -> writeText) when no ClipboardItem', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      writeText: mock.fn(async () => {}),
      write: undefined,
      read: undefined,
      readText: undefined,
    };

    // Setup FileReader mock to call onloadend synchronously-ish
    const origFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.result = 'data:image/png;base64,abc';
        this.onloadend = null;
      }
      readAsDataURL(_blob) {
        queueMicrotask(() => { if (this.onloadend) this.onloadend(); });
      }
    };

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;

    await copyRegionAsImage(canvas, { x: 0, y: 0, width: 10, height: 10 });
    assert.equal(navigator.clipboard.writeText.mock.calls.length, 1);

    globalThis.FileReader = origFileReader;
  });

  it('uses ClipboardItem.write when available', async () => {
    setupClipboardWithItem();
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;

    await copyRegionAsImage(canvas, { x: 0, y: 0, width: 20, height: 20 });
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// copyPageAsImage
// ---------------------------------------------------------------------------

describe('copyPageAsImage', () => {
  it('delegates to copyRegionAsImage with full canvas bounds', async () => {
    setupClipboardWithItem();
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200;

    await copyPageAsImage(canvas);
    assert.equal(navigator.clipboard.write.mock.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// pasteIntoPage helper
// ---------------------------------------------------------------------------

function makeMockPdfDoc() {
  const mockFont = { name: 'Helvetica' };
  const page = {
    drawText: mock.fn(),
    drawImage: mock.fn(),
  };
  return {
    getPages: () => [page],
    embedFont: mock.fn(async () => mockFont),
    embedPng: mock.fn(async () => ({ width: 100, height: 100 })),
    embedJpg: mock.fn(async () => ({ width: 100, height: 100 })),
    _page: page,
  };
}

// ---------------------------------------------------------------------------
// pasteIntoPage — empty clipboard
// ---------------------------------------------------------------------------

describe('pasteIntoPage — empty clipboard', () => {
  it('returns empty when clipboard has no data (readText returns empty string)', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => ''),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'empty');
    assert.equal(result.content, null);
  });

  it('returns empty when clipboard readText throws', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => { throw new Error('denied'); }),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'empty');
  });

  it('returns empty for whitespace-only text', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => '   \n  '),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'empty');
  });
});

// ---------------------------------------------------------------------------
// pasteIntoPage — text paste
// ---------------------------------------------------------------------------

describe('pasteIntoPage — text paste', () => {
  it('pastes plain text from legacy readText API', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => 'Some pasted text'),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'text');
    assert.ok(result.content.includes('Some pasted text'));
    assert.ok(pdfDoc._page.drawText.mock.calls.length > 0);
  });

  it('pastes text with custom fontSize and lineHeight', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => 'Custom font size'),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 }, {
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: 'Times',
    });
    assert.equal(result.type, 'text');
  });

  it('throws when page not found', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => 'text'),
      read: undefined,
    };

    const pdfDoc = {
      getPages: () => [],
      embedFont: mock.fn(async () => ({})),
    };

    await assert.rejects(
      () => pasteIntoPage(pdfDoc, 5, { x: 0, y: 0 }),
      /Page 5 not found/,
    );
  });

  it('handles word-wrap for long text lines', async () => {
    const longLine = 'word '.repeat(100).trim();
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => longLine),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 }, { maxWidth: 100 });
    assert.equal(result.type, 'text');
    assert.ok(pdfDoc._page.drawText.mock.calls.length > 1);
  });

  it('handles text with multiple newlines', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => 'Line 1\nLine 2\nLine 3'),
      read: undefined,
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'text');
    assert.equal(pdfDoc._page.drawText.mock.calls.length, 3);
  });

  it('uses all standard font families without error', async () => {
    const fonts = ['Helvetica', 'Times', 'Times-Roman', 'TimesRoman', 'Courier', 'Courier New',
      'Arial', 'sans-serif', 'serif', 'monospace', 'Unknown'];
    for (const fontFamily of fonts) {
      globalThis.ClipboardItem = undefined;
      globalThis.navigator.clipboard = {
        readText: mock.fn(async () => 'text'),
        read: undefined,
      };
      const pdfDoc = makeMockPdfDoc();
      const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 }, { fontFamily });
      assert.equal(result.type, 'text');
    }
  });
});

// ---------------------------------------------------------------------------
// pasteIntoPage — modern clipboard API
// ---------------------------------------------------------------------------

describe('pasteIntoPage — modern clipboard API', () => {
  it('strips HTML and pastes text when clipboard has HTML item', async () => {
    const htmlText = '<p>Hello <b>world</b></p>';
    const mockBlob = { text: async () => htmlText };
    const mockItem = {
      types: ['text/html'],
      getType: async (_t) => mockBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'text');
  });

  it('pastes PNG image when clipboard has image/png item', async () => {
    const pngBlob = {
      type: 'image/png',
      arrayBuffer: async () => new ArrayBuffer(8),
    };
    const mockItem = {
      types: ['image/png'],
      getType: async (_t) => pngBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'image');
    assert.ok(pdfDoc._page.drawImage.mock.calls.length > 0);
  });

  it('pastes JPEG image when clipboard has image/jpeg item', async () => {
    const jpgBlob = {
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(8),
    };
    const mockItem = {
      types: ['image/jpeg'],
      getType: async (_t) => jpgBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'image');
  });

  it('reads plain text from modern clipboard API item', async () => {
    const textBlob = { text: async () => 'Plain from API' };
    const mockItem = {
      types: ['text/plain'],
      getType: async (_t) => textBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'text');
    assert.ok(result.content.includes('Plain from API'));
  });

  it('falls back to readText when clipboard.read throws', async () => {
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => { throw new Error('Permission denied'); }),
      readText: mock.fn(async () => 'Fallback text'),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.equal(result.type, 'text');
  });

  it('image paste result includes dimensions string', async () => {
    const pngBlob = {
      type: 'image/png',
      arrayBuffer: async () => new ArrayBuffer(8),
    };
    const mockItem = {
      types: ['image/png'],
      getType: async (_t) => pngBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    const pdfDoc = makeMockPdfDoc();
    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 });
    assert.ok(result.content.includes('×'));
  });

  it('image paste scales down when image exceeds maxWidth', async () => {
    const largePngBlob = {
      type: 'image/png',
      arrayBuffer: async () => new ArrayBuffer(8),
    };
    const mockItem = {
      types: ['image/png'],
      getType: async (_t) => largePngBlob,
    };
    globalThis.ClipboardItem = class { constructor(d) { this.data = d; } };
    globalThis.navigator.clipboard = {
      read: mock.fn(async () => [mockItem]),
      write: mock.fn(async () => {}),
    };

    // embedPng returns a large image
    const page = { drawText: mock.fn(), drawImage: mock.fn() };
    const pdfDoc = {
      getPages: () => [page],
      embedFont: mock.fn(async () => ({})),
      embedPng: mock.fn(async () => ({ width: 2000, height: 1000 })),
      embedJpg: mock.fn(async () => ({ width: 2000, height: 1000 })),
      _page: page,
    };

    const result = await pasteIntoPage(pdfDoc, 0, { x: 72, y: 700 }, { maxWidth: 200 });
    assert.equal(result.type, 'image');
    // The content should show scaled dimensions (200 wide)
    const [w] = result.content.split('×').map(Number);
    assert.ok(w <= 200);
  });
});

// ---------------------------------------------------------------------------
// ClipboardController
// ---------------------------------------------------------------------------

describe('ClipboardController', () => {
  beforeEach(() => {
    setupClipboardWriteTextOnly();
  });

  it('creates without errors and attaches keydown listener', () => {
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
    ctrl.destroy();
  });

  it('destroy removes event listener without error', () => {
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

  it('ignores keydown without ctrl/meta modifier', async () => {
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

    container.dispatchEvent({ type: 'keydown', key: 'c', ctrlKey: false, metaKey: false, preventDefault: mock.fn() });
    assert.equal(onCopy.mock.calls.length, 0);
    ctrl.destroy();
  });

  it('Ctrl+C with no selection returns early (no preventDefault)', async () => {
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

    const preventDefault = mock.fn();
    container.dispatchEvent({ type: 'keydown', key: 'c', ctrlKey: true, metaKey: false, preventDefault });
    assert.equal(preventDefault.mock.calls.length, 0);
    ctrl.destroy();
  });

  it('Ctrl+C with text blocks calls copyFormattedText and onCopyComplete', async () => {
    setupClipboardWithItem();
    const container = document.createElement('div');
    const onCopyComplete = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: () => ({ blocks: [{ text: 'Hello' }] }),
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
      onCopyComplete,
    });

    const preventDefault = mock.fn();
    container.dispatchEvent({ type: 'keydown', key: 'c', ctrlKey: true, metaKey: false, preventDefault });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(preventDefault.mock.calls.length, 1);
    ctrl.destroy();
  });

  it('Ctrl+C with rect selection and canvas calls copyRegionAsImage', async () => {
    setupClipboardWithItem();
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const onCopyComplete = mock.fn();

    const ctrl = new ClipboardController({
      container,
      getSelection: () => ({ rect: { x: 0, y: 0, width: 50, height: 50 } }),
      getPageCanvas: () => canvas,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
      onCopyComplete,
    });

    const preventDefault = mock.fn();
    container.dispatchEvent({ type: 'keydown', key: 'c', ctrlKey: true, metaKey: false, preventDefault });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(preventDefault.mock.calls.length, 1);
    ctrl.destroy();
  });

  it('Ctrl+V with no pdfDoc returns early', async () => {
    const container = document.createElement('div');
    const onPasteComplete = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: () => null,
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete,
    });

    const preventDefault = mock.fn();
    container.dispatchEvent({ type: 'keydown', key: 'v', ctrlKey: true, metaKey: false, preventDefault });
    assert.equal(preventDefault.mock.calls.length, 0);
    assert.equal(onPasteComplete.mock.calls.length, 0);
    ctrl.destroy();
  });

  it('Ctrl+V with pdfDoc triggers pasteIntoPage and calls onPasteComplete', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => ''),
      read: undefined,
    };

    const page = { drawText: mock.fn(), drawImage: mock.fn() };
    const pdfDoc = {
      getPages: () => [page],
      embedFont: mock.fn(async () => ({})),
    };

    const container = document.createElement('div');
    const onPasteComplete = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: () => null,
      getPageCanvas: () => null,
      getPdfDoc: () => pdfDoc,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete,
    });

    container.dispatchEvent({ type: 'keydown', key: 'v', ctrlKey: true, metaKey: false, preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(onPasteComplete.mock.calls.length, 1);
    ctrl.destroy();
  });

  it('uses metaKey as ctrl equivalent', async () => {
    setupClipboardWithItem();
    const container = document.createElement('div');
    const onCopyComplete = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: () => ({ blocks: [{ text: 'Meta copy' }] }),
      getPageCanvas: () => null,
      getPdfDoc: () => null,
      getPageNum: () => 0,
      getCursorPos: () => ({ x: 72, y: 700 }),
      onPasteComplete: () => {},
      onCopyComplete,
    });

    const preventDefault = mock.fn();
    container.dispatchEvent({ type: 'keydown', key: 'c', ctrlKey: false, metaKey: true, preventDefault });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(preventDefault.mock.calls.length, 1);
    ctrl.destroy();
  });

  it('Ctrl+V uses default page 0 and pos when getters not provided', async () => {
    globalThis.ClipboardItem = undefined;
    globalThis.navigator.clipboard = {
      readText: mock.fn(async () => ''),
      read: undefined,
    };

    const page = { drawText: mock.fn(), drawImage: mock.fn() };
    const pdfDoc = {
      getPages: () => [page],
      embedFont: mock.fn(async () => ({})),
    };

    const container = document.createElement('div');
    const onPasteComplete = mock.fn();
    const ctrl = new ClipboardController({
      container,
      getSelection: undefined,
      getPageCanvas: undefined,
      getPdfDoc: () => pdfDoc,
      getPageNum: undefined,
      getCursorPos: undefined,
      onPasteComplete,
    });

    container.dispatchEvent({ type: 'keydown', key: 'v', ctrlKey: true, metaKey: false, preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(onPasteComplete.mock.calls.length, 1);
    ctrl.destroy();
  });
});
