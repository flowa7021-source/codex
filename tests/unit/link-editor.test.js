import './setup-dom.js';

// Patch DOM mock: add setLineDash to canvas context
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  const _origGetContext = el.getContext;
  el.getContext = function(...args) {
    const ctx = _origGetContext.call(el, ...args);
    if (ctx && !ctx.setLineDash) ctx.setLineDash = () => {};
    return ctx;
  };
  return el;
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import { addLink, removeLink, removeAllLinks, getPageLinks, LinkEditor } from '../../app/modules/link-editor.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeDeps(overrides = {}) {
  return {
    getPdfBytes: mock.fn(() => new Uint8Array(0)),
    getPageNum: mock.fn(() => 1),
    onApply: mock.fn(),
    pageWidthPt: 595,
    pageHeightPt: 842,
    zoom: 1,
    ...overrides,
  };
}

/** Create a minimal valid PDF with the given number of pages. */
async function createPdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([200, 200]);
  }
  return await doc.save();
}

// ── Tests — LinkEditor UI ──────────────────────────────────────────────────

describe('LinkEditor', () => {
  let container, deps;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
  });

  it('constructor sets initial state', () => {
    const editor = new LinkEditor(container, deps);
    assert.equal(editor._panel, null);
    assert.deepEqual(editor._links, []);
    assert.equal(editor._overlay, null);
  });

  it('close removes panel when present', () => {
    const editor = new LinkEditor(container, deps);
    // Simulate an open panel
    editor._panel = document.createElement('div');
    container.appendChild(editor._panel);
    editor.close();
    assert.equal(editor._panel, null);
  });

  it('close removes overlay when present', () => {
    const editor = new LinkEditor(container, deps);
    editor._overlay = document.createElement('canvas');
    container.appendChild(editor._overlay);
    editor.close();
    assert.equal(editor._overlay, null);
  });

  it('close is safe to call when already closed', () => {
    const editor = new LinkEditor(container, deps);
    assert.doesNotThrow(() => editor.close());
  });

  it('_buildOverlay skips when no links exist', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildOverlay();
    assert.equal(editor._overlay, null);
  });

  it('_buildOverlay creates canvas with correct dimensions', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [{ rect: { x: 10, y: 20, width: 100, height: 14 }, url: 'https://example.com', index: 0 }];
    editor._buildOverlay();

    assert.ok(editor._overlay);
    assert.equal(editor._overlay.width, 595);
    assert.equal(editor._overlay.height, 842);
  });

  it('_buildOverlay respects zoom', () => {
    deps.zoom = 2;
    const editor = new LinkEditor(container, deps);
    editor._links = [{ rect: { x: 10, y: 20, width: 100, height: 14 }, url: 'https://test.com', index: 0 }];
    editor._buildOverlay();

    assert.equal(editor._overlay.width, 1190);
    assert.equal(editor._overlay.height, 1684);
  });

  it('_buildPanel creates panel with links', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [
      { rect: { x: 0, y: 0, width: 50, height: 10 }, url: 'https://a.com', index: 0 },
      { rect: { x: 0, y: 0, width: 50, height: 10 }, destPage: 3, index: 1 },
    ];
    editor._buildPanel();

    assert.ok(editor._panel);
    // Panel should be appended to container
    assert.ok(container.children.length > 0);
  });

  it('_buildPanel shows empty message when no links', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildPanel();

    assert.ok(editor._panel);
  });

  it('_buildPanel shows link with unknown destination', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [
      { rect: { x: 0, y: 0, width: 50, height: 10 }, index: 0 },
    ];
    editor._buildPanel();
    assert.ok(editor._panel);
  });

  it('_buildOverlay defaults zoom to 1 when not set', () => {
    const nozoomDeps = makeDeps();
    delete nozoomDeps.zoom;
    const editor = new LinkEditor(container, nozoomDeps);
    editor._links = [{ rect: { x: 10, y: 20, width: 100, height: 14 }, url: 'https://test.com', index: 0 }];
    editor._buildOverlay();
    assert.equal(editor._overlay.width, 595);
    assert.equal(editor._overlay.height, 842);
  });

  it('open fetches links and builds panel + overlay', async () => {
    const pdfBytes = await createPdf(1);
    // Add a link to the PDF first
    const blobWithLink = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://example.com' });
    const bytesWithLink = new Uint8Array(await blobWithLink.arrayBuffer());

    const localDeps = makeDeps({
      getPdfBytes: mock.fn(() => bytesWithLink),
      getPageNum: mock.fn(() => 1),
    });

    const editor = new LinkEditor(container, localDeps);
    await editor.open();

    assert.ok(editor._panel, 'panel should be built after open');
    assert.ok(editor._links.length > 0, 'should have found links');
    assert.ok(editor._overlay, 'overlay should be built when links exist');
  });

  it('open works with a page that has no links', async () => {
    const pdfBytes = await createPdf(1);

    const localDeps = makeDeps({
      getPdfBytes: mock.fn(() => new Uint8Array(pdfBytes)),
      getPageNum: mock.fn(() => 1),
    });

    const editor = new LinkEditor(container, localDeps);
    await editor.open();

    assert.ok(editor._panel, 'panel should be built');
    assert.equal(editor._links.length, 0, 'should have no links');
    assert.equal(editor._overlay, null, 'no overlay when no links');
  });

  it('_showAddForm does nothing when prompt returns null', () => {
    // Mock global prompt to return null (user cancels)
    globalThis.prompt = mock.fn(() => null);

    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildPanel();

    // Call _showAddForm — it should bail out since prompt returns null
    editor._showAddForm();
    assert.equal(deps.onApply.mock.calls.length, 0, 'onApply should not be called when prompt cancelled');

    delete globalThis.prompt;
  });

  it('_showAddForm creates link when prompt returns a URL', async () => {
    const pdfBytes = await createPdf(1);

    globalThis.prompt = mock.fn(() => 'https://newlink.example.com');

    const localDeps = makeDeps({
      getPdfBytes: mock.fn(() => new Uint8Array(pdfBytes)),
      getPageNum: mock.fn(() => 1),
    });

    const editor = new LinkEditor(container, localDeps);
    editor._links = [];
    editor._buildPanel();

    editor._showAddForm();

    // Wait for the async addLink promise chain to resolve
    await new Promise(r => setTimeout(r, 500));

    assert.equal(localDeps.onApply.mock.calls.length, 1, 'onApply should be called with the new blob');

    delete globalThis.prompt;
  });

  it('close button in panel calls close', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildPanel();

    // Find the close button (the one with text content '✕' in the header)
    const panel = editor._panel;
    const header = panel.children[0];
    const closeBtn = header.children[1]; // second child of header
    assert.equal(closeBtn.textContent, '✕');

    closeBtn.click();
    assert.equal(editor._panel, null, 'panel should be removed after close button click');
  });
});

// ── Tests — addLink ────────────────────────────────────────────────────────

describe('addLink', () => {
  it('adds a URL link to a page', async () => {
    const pdfBytes = await createPdf(1);
    const blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 100, height: 20 }, { url: 'https://example.com' });
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);

    // Verify the link was actually added
    const resultBytes = new Uint8Array(await blob.arrayBuffer());
    const links = await getPageLinks(resultBytes, 1);
    assert.equal(links.length, 1);
    assert.equal(links[0].url, 'https://example.com/');
  });

  it('adds an internal page destination link', async () => {
    const pdfBytes = await createPdf(3);
    const blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 100, height: 20 }, { destPage: 2 });
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });

  it('adds a link with color and borderWidth', async () => {
    const pdfBytes = await createPdf(1);
    const blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 100, height: 20 }, {
      url: 'https://example.com',
      color: { r: 1, g: 0, b: 0 },
      borderWidth: 2,
    });
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });

  it('throws for invalid page number', async () => {
    const pdfBytes = await createPdf(1);
    await assert.rejects(
      addLink(pdfBytes, 99, { x: 10, y: 10, width: 100, height: 20 }, { url: 'https://example.com' }),
      { message: 'Page 99 not found' }
    );
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createPdf(1);
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const blob = await addLink(ab, 1, { x: 10, y: 10, width: 100, height: 20 }, { url: 'https://example.com' });
    assert.ok(blob instanceof Blob);
  });

  it('adds link to page that already has annotations', async () => {
    const pdfBytes = await createPdf(1);
    // Add first link
    const blob1 = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://first.com' });
    const bytes1 = new Uint8Array(await blob1.arrayBuffer());

    // Add second link to same page (existing Annots array)
    const blob2 = await addLink(bytes1, 1, { x: 70, y: 10, width: 50, height: 20 }, { url: 'https://second.com' });
    const bytes2 = new Uint8Array(await blob2.arrayBuffer());

    const links = await getPageLinks(bytes2, 1);
    assert.equal(links.length, 2);
  });

  it('handles destPage with invalid target page gracefully', async () => {
    const pdfBytes = await createPdf(1);
    // destPage 99 does not exist — the destPageRef will be undefined, so no Dest is set
    const blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { destPage: 99 });
    assert.ok(blob instanceof Blob);
  });
});

// ── Tests — removeLink ─────────────────────────────────────────────────────

describe('removeLink', () => {
  it('removes a link by index', async () => {
    const pdfBytes = await createPdf(1);
    const blob1 = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://a.com' });
    const bytes1 = new Uint8Array(await blob1.arrayBuffer());

    const blob2 = await removeLink(bytes1, 1, 0);
    const resultBytes = new Uint8Array(await blob2.arrayBuffer());
    const links = await getPageLinks(resultBytes, 1);
    assert.equal(links.length, 0);
  });

  it('returns unchanged PDF when page has no annotations', async () => {
    const pdfBytes = await createPdf(1);
    const blob = await removeLink(pdfBytes, 1, 0);
    assert.ok(blob instanceof Blob);
  });

  it('throws for invalid page number', async () => {
    const pdfBytes = await createPdf(1);
    await assert.rejects(
      removeLink(pdfBytes, 99, 0),
      { message: 'Page 99 not found' }
    );
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createPdf(1);
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const blob = await removeLink(ab, 1, 0);
    assert.ok(blob instanceof Blob);
  });

  it('removes only the targeted link when multiple exist', async () => {
    const pdfBytes = await createPdf(1);
    let blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://keep.com' });
    let bytes = new Uint8Array(await blob.arrayBuffer());
    blob = await addLink(bytes, 1, { x: 70, y: 10, width: 50, height: 20 }, { url: 'https://remove.com' });
    bytes = new Uint8Array(await blob.arrayBuffer());

    // Remove second link (index 1)
    blob = await removeLink(bytes, 1, 1);
    const resultBytes = new Uint8Array(await blob.arrayBuffer());
    const links = await getPageLinks(resultBytes, 1);
    assert.equal(links.length, 1);
    assert.equal(links[0].url, 'https://keep.com/');
  });
});

// ── Tests — removeAllLinks ─────────────────────────────────────────────────

describe('removeAllLinks', () => {
  it('removes all links from all pages', async () => {
    const pdfBytes = await createPdf(2);
    let blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://a.com' });
    let bytes = new Uint8Array(await blob.arrayBuffer());
    blob = await addLink(bytes, 2, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://b.com' });
    bytes = new Uint8Array(await blob.arrayBuffer());

    blob = await removeAllLinks(bytes);
    const resultBytes = new Uint8Array(await blob.arrayBuffer());

    const links1 = await getPageLinks(resultBytes, 1);
    const links2 = await getPageLinks(resultBytes, 2);
    assert.equal(links1.length, 0);
    assert.equal(links2.length, 0);
  });

  it('handles PDF with no links', async () => {
    const pdfBytes = await createPdf(1);
    const blob = await removeAllLinks(pdfBytes);
    assert.ok(blob instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createPdf(1);
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const blob = await removeAllLinks(ab);
    assert.ok(blob instanceof Blob);
  });
});

// ── Tests — getPageLinks ───────────────────────────────────────────────────

describe('getPageLinks', () => {
  it('returns empty array for page with no links', async () => {
    const pdfBytes = await createPdf(1);
    const links = await getPageLinks(pdfBytes, 1);
    assert.deepEqual(links, []);
  });

  it('returns links with url property', async () => {
    const pdfBytes = await createPdf(1);
    const blob = await addLink(pdfBytes, 1, { x: 10, y: 20, width: 100, height: 15 }, { url: 'https://example.com' });
    const resultBytes = new Uint8Array(await blob.arrayBuffer());

    const links = await getPageLinks(resultBytes, 1);
    assert.equal(links.length, 1);
    assert.equal(links[0].index, 0);
    assert.ok(links[0].rect);
    assert.equal(links[0].rect.x, 10);
    assert.equal(links[0].rect.y, 20);
    assert.equal(links[0].rect.width, 100);
    assert.equal(links[0].rect.height, 15);
    assert.ok(links[0].url.includes('example.com'));
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createPdf(1);
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const links = await getPageLinks(ab, 1);
    assert.deepEqual(links, []);
  });

  it('returns multiple links indexed correctly', async () => {
    const pdfBytes = await createPdf(1);
    let blob = await addLink(pdfBytes, 1, { x: 10, y: 10, width: 50, height: 20 }, { url: 'https://first.com' });
    let bytes = new Uint8Array(await blob.arrayBuffer());
    blob = await addLink(bytes, 1, { x: 70, y: 10, width: 50, height: 20 }, { url: 'https://second.com' });
    bytes = new Uint8Array(await blob.arrayBuffer());

    const links = await getPageLinks(bytes, 1);
    assert.equal(links.length, 2);
    assert.equal(links[0].index, 0);
    assert.equal(links[1].index, 1);
  });
});
