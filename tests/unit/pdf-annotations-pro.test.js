// ─── Unit Tests: PdfAnnotationsPro ──────────────────────────────────────────
// Tests the AnnotationManager class and its pure helper methods.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

// Ensure crypto.randomUUID is available
if (!globalThis.crypto) {
  globalThis.crypto = { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` };
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Minimal XML DOMParser for importFromXFDF tests (not in setup-dom to avoid
// affecting epub-adapter which relies on DOMParser being undefined in Node.js)
if (typeof globalThis.DOMParser === 'undefined') {
  class _El {
    constructor(tag, attrs, children) {
      this.tagName = tag;
      this._a = attrs;
      this.children = children;
      this.textContent = '';
    }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._a, k) ? this._a[k] : null; }
    querySelector(sel) {
      const t = sel.toLowerCase();
      for (const c of this.children) {
        if (c.tagName && c.tagName.toLowerCase() === t) return c;
        const f = c.querySelector && c.querySelector(sel);
        if (f) return f;
      }
      return null;
    }
  }
  function _attrs(s) {
    const a = {};
    const r = /([a-zA-Z_][\w:.-]*)="([^"]*)"/g;
    let m;
    while ((m = r.exec(s)) !== null) a[m[1]] = m[2];
    return a;
  }
  function _kids(xml) {
    const out = [];
    const re = /<([a-zA-Z][a-zA-Z0-9:_-]*)([^>]*?)\/?>(?:([\s\S]*?)<\/\1>)?/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const el = new _El(m[1], _attrs(m[2]), m[3] !== undefined ? _kids(m[3]) : []);
      if (m[3] !== undefined) el.textContent = m[3].replace(/<[^>]+>/g, '').trim();
      out.push(el);
    }
    return out;
  }
  globalThis.DOMParser = class DOMParser {
    parseFromString(s) {
      const root = new _El('document', {}, _kids(s));
      return { querySelector: sel => root.querySelector(sel) };
    }
  };
}

import {
  AnnotationManager,
  ANNOTATION_TYPES,
  HIGHLIGHT_COLORS,
} from '../../app/modules/pdf-annotations-pro.js';

// ── ANNOTATION_TYPES constant ───────────────────────────────────────────────

describe('ANNOTATION_TYPES', () => {
  it('has all expected annotation types', () => {
    assert.equal(ANNOTATION_TYPES.HIGHLIGHT, 'highlight');
    assert.equal(ANNOTATION_TYPES.UNDERLINE, 'underline');
    assert.equal(ANNOTATION_TYPES.STRIKETHROUGH, 'strikethrough');
    assert.equal(ANNOTATION_TYPES.STICKY_NOTE, 'sticky-note');
    assert.equal(ANNOTATION_TYPES.TEXT_BOX, 'text-box');
    assert.equal(ANNOTATION_TYPES.CALLOUT, 'callout');
    assert.equal(ANNOTATION_TYPES.STAMP, 'stamp');
    assert.equal(ANNOTATION_TYPES.MEASURE, 'measure');
    assert.equal(ANNOTATION_TYPES.PEN, 'pen');
    assert.equal(ANNOTATION_TYPES.RECT, 'rect');
    assert.equal(ANNOTATION_TYPES.CIRCLE, 'circle');
    assert.equal(ANNOTATION_TYPES.ARROW, 'arrow');
    assert.equal(ANNOTATION_TYPES.LINE, 'line');
    assert.equal(ANNOTATION_TYPES.LINK, 'link');
    assert.equal(ANNOTATION_TYPES.CLOUD, 'cloud');
  });
});

// ── HIGHLIGHT_COLORS ────────────────────────────────────────────────────────

describe('HIGHLIGHT_COLORS', () => {
  it('has yellow, green, blue, pink, orange', () => {
    assert.ok(HIGHLIGHT_COLORS.yellow);
    assert.ok(HIGHLIGHT_COLORS.green);
    assert.ok(HIGHLIGHT_COLORS.blue);
    assert.ok(HIGHLIGHT_COLORS.pink);
    assert.ok(HIGHLIGHT_COLORS.orange);
  });

  it('each color has r, g, b properties', () => {
    for (const [, c] of Object.entries(HIGHLIGHT_COLORS)) {
      assert.equal(typeof c.r, 'number');
      assert.equal(typeof c.g, 'number');
      assert.equal(typeof c.b, 'number');
    }
  });
});

// ── AnnotationManager ───────────────────────────────────────────────────────

describe('AnnotationManager', () => {
  /** @type {AnnotationManager} */
  let mgr;

  beforeEach(() => {
    mgr = new AnnotationManager();
  });

  describe('add', () => {
    it('adds an annotation and returns it with generated id', () => {
      const ann = mgr.add(1, {
        type: ANNOTATION_TYPES.HIGHLIGHT,
        bounds: { x: 10, y: 20, w: 100, h: 15 },
        color: '#ffd84d',
      });
      assert.ok(ann.id);
      assert.equal(ann.pageNum, 1);
      assert.equal(ann.type, 'highlight');
      assert.equal(ann.color, '#ffd84d');
      assert.deepEqual(ann.bounds, { x: 10, y: 20, w: 100, h: 15 });
    });

    it('defaults opacity to 0.4', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(ann.opacity, 0.4);
    });

    it('defaults author to User', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(ann.author, 'User');
    });

    it('initializes replies as empty and resolved as false', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.deepEqual(ann.replies, []);
      assert.equal(ann.resolved, false);
    });

    it('includes a timestamp', () => {
      const before = Date.now();
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.ok(ann.timestamp >= before);
    });
  });

  describe('getForPage / getAll / count', () => {
    it('getForPage returns empty array for pages with no annotations', () => {
      assert.deepEqual(mgr.getForPage(1), []);
    });

    it('getForPage returns annotations for a specific page', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 20, h: 5 } });
      assert.equal(mgr.getForPage(1).length, 1);
      assert.equal(mgr.getForPage(2).length, 1);
      assert.equal(mgr.getForPage(3).length, 0);
    });

    it('getAll returns all annotations across pages', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 20, h: 5 } });
      mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 5, y: 5, w: 20, h: 20 } });
      assert.equal(mgr.getAll().length, 3);
    });

    it('count returns total annotation count', () => {
      assert.equal(mgr.count, 0);
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(mgr.count, 2);
    });
  });

  describe('remove', () => {
    it('removes an annotation by id', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      const removed = mgr.remove(ann.id);
      assert.ok(removed);
      assert.equal(removed.id, ann.id);
      assert.equal(mgr.count, 0);
    });

    it('returns null for non-existent id', () => {
      assert.equal(mgr.remove('nonexistent'), null);
    });

    it('cleans up page entry when last annotation removed', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.remove(ann.id);
      assert.deepEqual(mgr.getForPage(1), []);
    });
  });

  describe('addReply', () => {
    it('adds a reply to an existing annotation', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      const reply = mgr.addReply(ann.id, 'Great point!', 'Alice');
      assert.ok(reply);
      assert.equal(reply.text, 'Great point!');
      assert.equal(reply.author, 'Alice');
      assert.ok(reply.id);
      assert.ok(reply.timestamp);
    });

    it('reply is attached to the annotation', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.addReply(ann.id, 'Reply 1');
      mgr.addReply(ann.id, 'Reply 2');
      const updated = mgr.getForPage(1)[0];
      assert.equal(updated.replies.length, 2);
      assert.equal(updated.replies[0].text, 'Reply 1');
      assert.equal(updated.replies[1].text, 'Reply 2');
    });

    it('returns null for non-existent annotation', () => {
      assert.equal(mgr.addReply('nonexistent', 'text'), null);
    });

    it('defaults author to User', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      const reply = mgr.addReply(ann.id, 'text');
      assert.equal(reply.author, 'User');
    });
  });

  describe('toggleResolved', () => {
    it('toggles resolved state', () => {
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(ann.resolved, false);
      const result1 = mgr.toggleResolved(ann.id);
      assert.equal(result1, true);
      const result2 = mgr.toggleResolved(ann.id);
      assert.equal(result2, false);
    });

    it('returns null for non-existent id', () => {
      assert.equal(mgr.toggleResolved('nonexistent'), null);
    });
  });

  describe('clearAll', () => {
    it('removes all annotations', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.clearAll();
      assert.equal(mgr.count, 0);
      assert.deepEqual(mgr.getAll(), []);
    });
  });

  describe('onChange', () => {
    it('notifies listener on add', () => {
      const events = [];
      mgr.onChange((event, data) => events.push({ event, data }));
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'add');
    });

    it('notifies listener on remove', () => {
      const events = [];
      const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.onChange((event) => events.push(event));
      mgr.remove(ann.id);
      assert.ok(events.includes('remove'));
    });

    it('unsubscribe function stops notifications', () => {
      const events = [];
      const unsub = mgr.onChange((event) => events.push(event));
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(events.length, 1);
      unsub();
      mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(events.length, 1); // no new event
    });
  });

  describe('toJSON / fromJSON', () => {
    it('round-trips annotations through JSON', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 15 }, text: 'Test' });
      mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 5, y: 10, w: 50, h: 5 } });
      const json = mgr.toJSON();
      assert.ok(json[1]);
      assert.ok(json[2]);
      assert.equal(json[1].length, 1);
      assert.equal(json[2].length, 1);

      const mgr2 = new AnnotationManager();
      mgr2.fromJSON(json);
      assert.equal(mgr2.count, 2);
      assert.equal(mgr2.getForPage(1).length, 1);
      assert.equal(mgr2.getForPage(2).length, 1);
    });

    it('fromJSON clears existing annotations first', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      assert.equal(mgr.count, 2);

      mgr.fromJSON({ 3: [{ type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 5, y: 5, w: 20, h: 20 }, text: 'Note' }] });
      // Old annotations on page 1 are cleared; only page 3 now
      assert.equal(mgr.getForPage(1).length, 0);
      assert.equal(mgr.getForPage(3).length, 1);
    });
  });

  describe('exportAsXFDF', () => {
    it('produces valid XFDF XML', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 15 }, color: '#ffd84d' });
      const xml = mgr.exportAsXFDF('test.pdf');
      assert.ok(xml.includes('<?xml'));
      assert.ok(xml.includes('<xfdf'));
      assert.ok(xml.includes('<highlight'));
      assert.ok(xml.includes('test.pdf'));
    });

    it('exports underline as underline tag', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 50, h: 5 }, color: '#ff0000' });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('<underline'));
    });

    it('exports strikethrough as strikeout tag', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 0, y: 0, w: 50, h: 5 } });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('<strikeout'));
    });

    it('exports sticky note as text tag with contents', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 0, y: 0, w: 20, h: 20 }, text: 'Hello' });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('<text'));
      assert.ok(xml.includes('<contents>Hello</contents>'));
    });

    it('exports text box as freetext tag', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.TEXT_BOX, bounds: { x: 0, y: 0, w: 100, h: 50 }, text: 'Box' });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('<freetext'));
      assert.ok(xml.includes('Box'));
    });

    it('escapes XML special characters in text', () => {
      mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 0, y: 0, w: 20, h: 20 }, text: 'a < b & c > d' });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('&lt;'));
      assert.ok(xml.includes('&amp;'));
      assert.ok(xml.includes('&gt;'));
    });

    it('uses page-1 for 0-indexed XFDF page attribute', () => {
      mgr.add(3, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
      const xml = mgr.exportAsXFDF();
      assert.ok(xml.includes('page="2"'));
    });
  });

  describe('_escapeXml', () => {
    it('escapes all special XML characters', () => {
      const result = mgr._escapeXml('a & b < c > d " e \' f');
      assert.ok(result.includes('&amp;'));
      assert.ok(result.includes('&lt;'));
      assert.ok(result.includes('&gt;'));
      assert.ok(result.includes('&quot;'));
      assert.ok(result.includes('&apos;'));
    });

    it('handles null/undefined', () => {
      assert.equal(mgr._escapeXml(null), '');
      assert.equal(mgr._escapeXml(undefined), '');
    });
  });

  describe('_parseColor', () => {
    it('parses hex color string', () => {
      const c = mgr._parseColor('#ff0000');
      assert.equal(typeof c, 'object');
    });

    it('parses named highlight color', () => {
      const c = mgr._parseColor('yellow');
      assert.equal(typeof c, 'object');
    });

    it('returns default for null/empty', () => {
      const c = mgr._parseColor(null);
      assert.equal(typeof c, 'object');
      const c2 = mgr._parseColor('');
      assert.equal(typeof c2, 'object');
    });
  });

  describe('drawOnCanvas', () => {
    it('does not throw for page with no annotations', () => {
      const ctx = {
        save() {}, restore() {}, fillRect() {}, strokeRect() {},
        fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
        fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
        arc() {}, fill() {}, closePath() {}, font: '', textAlign: '', textBaseline: '',
        setLineDash() {},
      };
      // Should not throw
      mgr.drawOnCanvas(ctx, 1, 1);
    });

    it('calls canvas methods for highlight annotation', () => {
      const calls = [];
      const ctx = {
        save() { calls.push('save'); },
        restore() { calls.push('restore'); },
        fillRect(...args) { calls.push(['fillRect', ...args]); },
        strokeRect() {}, fillStyle: '', strokeStyle: '', lineWidth: 0,
        globalAlpha: 1, fillText() {}, beginPath() {}, moveTo() {},
        lineTo() {}, stroke() {}, arc() {}, fill() {}, closePath() {},
        font: '', textAlign: '', textBaseline: '', setLineDash() {},
      };
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 15 }, color: '#ffd84d' });
      mgr.drawOnCanvas(ctx, 1, 1);
      assert.ok(calls.includes('save'));
      assert.ok(calls.includes('restore'));
      assert.ok(calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
    });
  });

  describe('embedIntoPdf', () => {
    async function makeOnePage() {
      const doc = await PDFDocument.create();
      doc.addPage([612, 792]);
      return new Uint8Array(await doc.save());
    }

    it('returns a Blob with PDF type for highlight annotation', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 50, y: 100, w: 200, h: 20 }, color: '#ffd84d' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
      assert.equal(blob.type, 'application/pdf');
    });

    it('embeds underline annotation without throwing', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 50, y: 200, w: 200, h: 10 }, color: '#ff0000' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('embeds strikethrough annotation without throwing', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 50, y: 300, w: 200, h: 10 }, color: '#0000ff' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('embeds text-box annotation with text', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.TEXT_BOX, bounds: { x: 50, y: 400, w: 150, h: 40 }, color: '#000000', text: 'Box text' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('embeds text-box annotation without text', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.TEXT_BOX, bounds: { x: 50, y: 400, w: 150, h: 40 }, color: '#000000' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('embeds sticky-note annotation without throwing', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 50, y: 500, w: 20, h: 20 }, color: '#ffff00', text: 'Note' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('skips annotations with missing bounds', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: null });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
    });

    it('embeds multiple annotation types on one page', async () => {
      const bytes = await makeOnePage();
      mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 50, y: 700, w: 200, h: 15 }, color: '#ffd84d' });
      mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 50, y: 670, w: 200, h: 10 }, color: '#ff0000' });
      mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 50, y: 640, w: 200, h: 10 } });
      mgr.add(1, { type: ANNOTATION_TYPES.TEXT_BOX, bounds: { x: 50, y: 580, w: 150, h: 40 }, text: 'Hi' });
      mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 50, y: 540, w: 20, h: 20 }, text: 'Note' });
      const blob = await mgr.embedIntoPdf(bytes);
      assert.ok(blob instanceof Blob);
      assert.equal(blob.type, 'application/pdf');
    });
  });

  describe('importFromXFDF', () => {
    it('imports highlights from XFDF and returns count', () => {
      const xfdf = `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <annots>
    <highlight page="0" rect="50,100,250,120" color="#ffd84d" date="2024-01-01T00:00:00Z" name="ann-1">
      <contents>Selected text</contents>
    </highlight>
  </annots>
  <f href="doc.pdf" />
</xfdf>`;
      const count = mgr.importFromXFDF(xfdf);
      assert.equal(count, 1);
      assert.equal(mgr.count, 1);
      const ann = mgr.getForPage(1)[0];
      assert.equal(ann.type, ANNOTATION_TYPES.HIGHLIGHT);
      assert.equal(ann.color, '#ffd84d');
    });

    it('imports multiple annotation types from XFDF', () => {
      const xfdf = `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <annots>
    <highlight page="0" rect="50,100,250,120" color="#ffd84d" date="2024-01-01T00:00:00Z" name="h1" />
    <underline page="0" rect="50,200,250,215" color="#ff0000" date="2024-01-01T00:00:00Z" name="u1" />
    <strikeout page="0" rect="50,300,250,315" color="#0000ff" date="2024-01-01T00:00:00Z" name="s1" />
    <text page="1" rect="50,400,250,420" color="#ffff00" date="2024-01-01T00:00:00Z" name="t1" icon="Comment">
      <contents>Sticky note text</contents>
    </text>
    <freetext page="1" rect="50,500,200,540" color="#000000" date="2024-01-01T00:00:00Z" name="f1">
      <contents>Free text</contents>
    </freetext>
    <square page="2" rect="50,600,200,650" color="#008000" date="2024-01-01T00:00:00Z" name="sq1" />
  </annots>
  <f href="doc.pdf" />
</xfdf>`;
      const count = mgr.importFromXFDF(xfdf);
      assert.equal(count, 6);
      assert.equal(mgr.getForPage(1).length, 3);
      assert.equal(mgr.getForPage(2).length, 2);
      assert.equal(mgr.getForPage(3).length, 1);
    });

    it('returns 0 and does not add annotations when annots element is missing', () => {
      const xfdf = `<?xml version="1.0"?><xfdf><f href="doc.pdf" /></xfdf>`;
      const count = mgr.importFromXFDF(xfdf);
      assert.equal(count, 0);
      assert.equal(mgr.count, 0);
    });

    it('skips unknown tag types', () => {
      const xfdf = `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <annots>
    <unknowntag page="0" rect="0,0,100,100" color="#ff0000" date="2024-01-01T00:00:00Z" name="x1" />
  </annots>
</xfdf>`;
      const count = mgr.importFromXFDF(xfdf);
      assert.equal(count, 0);
    });
  });
});
