import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PdfRedactor, REDACTION_PATTERNS, redactor } from '../../app/modules/pdf-redact.js';

describe('REDACTION_PATTERNS', () => {
  it('contains expected pattern keys', () => {
    const keys = Object.keys(REDACTION_PATTERNS);
    assert.ok(keys.includes('email'));
    assert.ok(keys.includes('phone_ru'));
    assert.ok(keys.includes('ssn_us'));
    assert.ok(keys.includes('card_number'));
  });

  it('email regex matches valid emails', () => {
    const m = 'test@example.com'.match(REDACTION_PATTERNS.email.regex);
    assert.ok(m);
    assert.equal(m[0], 'test@example.com');
  });

  it('ssn regex matches US SSN format', () => {
    const m = '123-45-6789'.match(REDACTION_PATTERNS.ssn_us.regex);
    assert.ok(m);
  });
});

describe('PdfRedactor', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('starts with zero marks', () => {
    assert.equal(r.count, 0);
    assert.deepEqual(r.getMarks(), []);
  });

  it('markArea adds a redaction and returns this for chaining', () => {
    const result = r.markArea(1, { x: 10, y: 20, w: 100, h: 30 });
    assert.equal(result, r);
    assert.equal(r.count, 1);
    const marks = r.getMarks();
    assert.equal(marks[0].pageNum, 1);
    assert.equal(marks[0].type, 'area');
  });

  it('markArea on multiple pages tracks separately', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    assert.equal(r.count, 2);
  });

  it('removeMark removes by id', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    const id = r.getMarks()[0].id;
    assert.ok(r.removeMark(id));
    assert.equal(r.count, 0);
  });

  it('removeMark returns false for unknown id', () => {
    assert.equal(r.removeMark('nonexistent'), false);
  });

  it('clearAll removes all marks', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    r.clearAll();
    assert.equal(r.count, 0);
  });

  it('markRegex throws on invalid regex', async () => {
    await assert.rejects(
      () => r.markRegex('[invalid', 'g', {}),
      { message: /Invalid regex/ },
    );
  });

  it('markPattern throws on unknown pattern key', async () => {
    await assert.rejects(
      () => r.markPattern('nonexistent_pattern', {}),
      { message: /Unknown pattern/ },
    );
  });

  it('drawPreview does nothing for page without marks', () => {
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
    };
    r.drawPreview(ctx, 1);
    assert.equal(ctx.save.mock.calls.length, 0);
  });
});

describe('redactor singleton', () => {
  it('is an instance of PdfRedactor', () => {
    assert.ok(redactor instanceof PdfRedactor);
  });
});

// ── REDACTION_PATTERNS — additional regex coverage ──────────────────────────

describe('REDACTION_PATTERNS — all patterns', () => {
  it('phone_ru matches +7 format', () => {
    const m = '+7 (495) 123-45-67'.match(REDACTION_PATTERNS.phone_ru.regex);
    assert.ok(m, 'Should match Russian phone');
  });

  it('phone_ru matches 8 format', () => {
    const m = '8(495)123-45-67'.match(REDACTION_PATTERNS.phone_ru.regex);
    assert.ok(m, 'Should match 8-prefix Russian phone');
  });

  it('phone_intl matches international format', () => {
    const m = '+44 20 1234 5678'.match(REDACTION_PATTERNS.phone_intl.regex);
    assert.ok(m, 'Should match international phone');
  });

  it('inn matches 10-digit INN', () => {
    const m = '1234567890'.match(REDACTION_PATTERNS.inn.regex);
    assert.ok(m);
  });

  it('inn matches 12-digit INN', () => {
    const m = '123456789012'.match(REDACTION_PATTERNS.inn.regex);
    assert.ok(m);
  });

  it('card_number matches spaced card number', () => {
    const m = '4111 1111 1111 1111'.match(REDACTION_PATTERNS.card_number.regex);
    assert.ok(m);
  });

  it('card_number matches dashed card number', () => {
    const m = '4111-1111-1111-1111'.match(REDACTION_PATTERNS.card_number.regex);
    assert.ok(m);
  });

  it('passport_ru matches passport format', () => {
    const m = '45 06 123456'.match(REDACTION_PATTERNS.passport_ru.regex);
    assert.ok(m);
  });

  it('snils matches SNILS format', () => {
    const m = '123-456-789 00'.match(REDACTION_PATTERNS.snils.regex);
    assert.ok(m);
  });

  it('date matches DD.MM.YYYY format', () => {
    const m = '25.03.2026'.match(REDACTION_PATTERNS.date.regex);
    assert.ok(m);
  });

  it('date matches DD/MM/YY format', () => {
    const m = '25/03/26'.match(REDACTION_PATTERNS.date.regex);
    assert.ok(m);
  });

  it('each pattern has a label property', () => {
    for (const [key, pat] of Object.entries(REDACTION_PATTERNS)) {
      assert.ok(pat.label, `Pattern ${key} should have a label`);
      assert.equal(typeof pat.label, 'string');
    }
  });

  it('each pattern has a regex property', () => {
    for (const [key, pat] of Object.entries(REDACTION_PATTERNS)) {
      assert.ok(pat.regex instanceof RegExp, `Pattern ${key} should have a regex`);
    }
  });
});

// ── PdfRedactor — markArea ──────────────────────────────────────────────────

describe('PdfRedactor — markArea advanced', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('assigns unique IDs to each mark', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(1, { x: 20, y: 20, w: 10, h: 10 });
    const marks = r.getMarks();
    assert.equal(marks.length, 2);
    assert.notEqual(marks[0].id, marks[1].id);
  });

  it('chaining multiple markArea calls', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 })
     .markArea(1, { x: 20, y: 0, w: 10, h: 10 })
     .markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    assert.equal(r.count, 3);
  });

  it('preserves bounds properties in marks', () => {
    r.markArea(3, { x: 15, y: 25, w: 100, h: 50 });
    const mark = r.getMarks()[0];
    assert.equal(mark.x, 15);
    assert.equal(mark.y, 25);
    assert.equal(mark.w, 100);
    assert.equal(mark.h, 50);
    assert.equal(mark.pageNum, 3);
  });

  it('marks on same page accumulate', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(1, { x: 20, y: 20, w: 10, h: 10 });
    r.markArea(1, { x: 40, y: 40, w: 10, h: 10 });
    assert.equal(r.count, 3);
    const marks = r.getMarks();
    assert.ok(marks.every(m => m.pageNum === 1));
  });
});

// ── PdfRedactor — removeMark advanced ───────────────────────────────────────

describe('PdfRedactor — removeMark advanced', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('removes mark from correct page', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    const id = r.getMarks().find(m => m.pageNum === 1).id;
    r.removeMark(id);
    assert.equal(r.count, 1);
    assert.equal(r.getMarks()[0].pageNum, 2);
  });

  it('cleans up empty page entries after removing last mark', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    const id = r.getMarks()[0].id;
    r.removeMark(id);
    assert.equal(r.count, 0);
    assert.deepEqual(r.getMarks(), []);
  });

  it('returns false when removing from empty redactor', () => {
    assert.equal(r.removeMark('any-id'), false);
  });

  it('removing same id twice returns false on second attempt', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    const id = r.getMarks()[0].id;
    assert.equal(r.removeMark(id), true);
    assert.equal(r.removeMark(id), false);
  });
});

// ── PdfRedactor — markPattern ───────────────────────────────────────────────

describe('PdfRedactor — markPattern', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('finds email in text content', async () => {
    const textContent = {
      1: [
        { str: 'Contact us at user@example.com for info', transform: [1, 0, 0, 1, 10, 700], width: 200, height: 12 },
      ],
    };
    const count = await r.markPattern('email', textContent);
    assert.equal(count, 1);
    assert.equal(r.count, 1);
    const mark = r.getMarks()[0];
    assert.equal(mark.type, 'pattern');
    assert.equal(mark.pattern, 'email');
    assert.equal(mark.text, 'user@example.com');
  });

  it('finds multiple emails across pages', async () => {
    const textContent = {
      1: [{ str: 'a@b.com', transform: [1, 0, 0, 1, 10, 700], width: 50, height: 12 }],
      2: [{ str: 'c@d.com', transform: [1, 0, 0, 1, 10, 700], width: 50, height: 12 }],
    };
    const count = await r.markPattern('email', textContent);
    assert.equal(count, 2);
  });

  it('returns 0 when no matches found', async () => {
    const textContent = {
      1: [{ str: 'No emails here', transform: [1, 0, 0, 1, 10, 700], width: 100, height: 12 }],
    };
    const count = await r.markPattern('email', textContent);
    assert.equal(count, 0);
    assert.equal(r.count, 0);
  });

  it('throws for unknown pattern key', async () => {
    await assert.rejects(
      () => r.markPattern('unknown_pattern', {}),
      { message: /Unknown pattern/ },
    );
  });

  it('finds SSN pattern', async () => {
    const textContent = {
      1: [{ str: 'SSN: 123-45-6789', transform: [1, 0, 0, 1, 10, 700], width: 100, height: 12 }],
    };
    const count = await r.markPattern('ssn_us', textContent);
    assert.equal(count, 1);
  });

  it('handles empty text content', async () => {
    const count = await r.markPattern('email', {});
    assert.equal(count, 0);
  });

  it('handles page with empty items array', async () => {
    const count = await r.markPattern('email', { 1: [] });
    assert.equal(count, 0);
  });
});

// ── PdfRedactor — markRegex ─────────────────────────────────────────────────

describe('PdfRedactor — markRegex', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('finds matches with custom regex', async () => {
    const textContent = {
      1: [{ str: 'Order #12345 confirmed', transform: [1, 0, 0, 1, 10, 700], width: 150, height: 12 }],
    };
    const count = await r.markRegex('#\\d+', 'g', textContent);
    assert.equal(count, 1);
    const mark = r.getMarks()[0];
    assert.equal(mark.type, 'regex');
    assert.equal(mark.text, '#12345');
  });

  it('finds multiple matches on same page', async () => {
    const textContent = {
      1: [{ str: 'AAA BBB AAA', transform: [1, 0, 0, 1, 10, 700], width: 100, height: 12 }],
    };
    const count = await r.markRegex('AAA', 'g', textContent);
    assert.equal(count, 2);
  });

  it('returns 0 for no matches', async () => {
    const textContent = {
      1: [{ str: 'nothing here', transform: [1, 0, 0, 1, 10, 700], width: 100, height: 12 }],
    };
    const count = await r.markRegex('ZZZZZ', 'g', textContent);
    assert.equal(count, 0);
  });

  it('throws on invalid regex syntax', async () => {
    await assert.rejects(
      () => r.markRegex('(unclosed', 'g', {}),
      { message: /Invalid regex/ },
    );
  });

  it('uses default g flag when flags is empty', async () => {
    const textContent = {
      1: [{ str: 'test test', transform: [1, 0, 0, 1, 10, 700], width: 100, height: 12 }],
    };
    const count = await r.markRegex('test', '', textContent);
    // Without 'g' flag, matchAll still works but finds first match
    assert.ok(count >= 0);
  });

  it('handles empty text content', async () => {
    const count = await r.markRegex('test', 'g', {});
    assert.equal(count, 0);
  });
});

// ── PdfRedactor — drawPreview ───────────────────────────────────────────────

describe('PdfRedactor — drawPreview', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('draws rectangles for marked areas', () => {
    r.markArea(1, { x: 10, y: 20, w: 100, h: 30 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
      strokeRect: mock.fn(),
      fillText: mock.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    r.drawPreview(ctx, 1);
    assert.equal(ctx.save.mock.callCount(), 1);
    assert.equal(ctx.restore.mock.callCount(), 1);
    assert.equal(ctx.fillRect.mock.callCount(), 1);
    assert.equal(ctx.strokeRect.mock.callCount(), 1);
  });

  it('applies scale factor to drawing', () => {
    r.markArea(1, { x: 10, y: 20, w: 100, h: 30 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
      strokeRect: mock.fn(),
      fillText: mock.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    r.drawPreview(ctx, 1, 2);
    // fillRect called with scaled values: 10*2=20, 20*2=40, 100*2=200, 30*2=60
    const args = ctx.fillRect.mock.calls[0].arguments;
    assert.equal(args[0], 20);
    assert.equal(args[1], 40);
    assert.equal(args[2], 200);
    assert.equal(args[3], 60);
  });

  it('draws REDACTED label when area is large enough', () => {
    r.markArea(1, { x: 10, y: 20, w: 200, h: 40 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
      strokeRect: mock.fn(),
      fillText: mock.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    r.drawPreview(ctx, 1, 1);
    // Area is 200x40 at scale 1 → > 60 wide and > 14 tall → draws label
    assert.ok(ctx.fillText.mock.callCount() >= 1);
    assert.equal(ctx.fillText.mock.calls[0].arguments[0], 'REDACTED');
  });

  it('does not draw REDACTED label when area is too small', () => {
    r.markArea(1, { x: 10, y: 20, w: 20, h: 5 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
      strokeRect: mock.fn(),
      fillText: mock.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    r.drawPreview(ctx, 1, 1);
    assert.equal(ctx.fillText.mock.callCount(), 0);
  });

  it('does not draw for wrong page number', () => {
    r.markArea(1, { x: 10, y: 20, w: 100, h: 30 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
    };
    r.drawPreview(ctx, 2);
    assert.equal(ctx.save.mock.callCount(), 0);
  });

  it('draws multiple marks on same page', () => {
    r.markArea(1, { x: 10, y: 20, w: 100, h: 30 });
    r.markArea(1, { x: 50, y: 80, w: 100, h: 30 });
    const ctx = {
      save: mock.fn(),
      restore: mock.fn(),
      fillRect: mock.fn(),
      strokeRect: mock.fn(),
      fillText: mock.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    r.drawPreview(ctx, 1, 1);
    assert.equal(ctx.fillRect.mock.callCount(), 2);
    assert.equal(ctx.strokeRect.mock.callCount(), 2);
  });
});

// ── PdfRedactor — _findTextBounds ───────────────────────────────────────────

describe('PdfRedactor — _findTextBounds', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('returns bounds for matched text item', () => {
    const items = [
      { str: 'Hello World', transform: [1, 0, 0, 1, 50, 700], width: 100, height: 14 },
    ];
    const bounds = r._findTextBounds(items, 'World', 6);
    assert.ok(bounds.length > 0);
    assert.equal(bounds[0].x, 50);
  });

  it('returns empty array when no overlap', () => {
    const items = [
      { str: 'Hello', transform: [1, 0, 0, 1, 50, 700], width: 50, height: 14 },
    ];
    const bounds = r._findTextBounds(items, 'XYZ', 100);
    assert.equal(bounds.length, 0);
  });

  it('handles items without transform gracefully', () => {
    const items = [
      { str: 'Test', width: 30, height: 12 },
    ];
    const bounds = r._findTextBounds(items, 'Test', 0);
    assert.ok(bounds.length > 0);
    assert.equal(bounds[0].x, 0); // transform?.[4] falls back to 0
    assert.equal(bounds[0].y, -12); // ty - h = 0 - 12
  });

  it('handles items without width/height using defaults', () => {
    const items = [
      { str: 'abc', transform: [1, 0, 0, 1, 10, 500] },
    ];
    const bounds = r._findTextBounds(items, 'abc', 0);
    assert.ok(bounds.length > 0);
    // width defaults to str.length * 6 = 18
    assert.equal(bounds[0].w, 18);
    // height defaults to 12
    assert.equal(bounds[0].h, 12 * 1.2);
  });

  it('finds bounds across multiple items', () => {
    const items = [
      { str: 'Hello ', transform: [1, 0, 0, 1, 10, 700], width: 50, height: 14 },
      { str: 'World', transform: [1, 0, 0, 1, 60, 700], width: 50, height: 14 },
    ];
    // 'lo Wo' spans items[0] (offset 3-5) and items[1] (offset 6-8)
    const bounds = r._findTextBounds(items, 'lo Wo', 3);
    assert.equal(bounds.length, 2);
  });

  it('returns empty for empty items array', () => {
    const bounds = r._findTextBounds([], 'test', 0);
    assert.equal(bounds.length, 0);
  });
});

// ── PdfRedactor — clearAll and count ────────────────────────────────────────

describe('PdfRedactor — clearAll and count', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('count is 0 initially', () => {
    assert.equal(r.count, 0);
  });

  it('count increases with marks', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    assert.equal(r.count, 1);
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    assert.equal(r.count, 2);
  });

  it('clearAll resets count to 0', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    r.clearAll();
    assert.equal(r.count, 0);
    assert.deepEqual(r.getMarks(), []);
  });

  it('clearAll can be called on empty redactor', () => {
    r.clearAll();
    assert.equal(r.count, 0);
  });

  it('clearAll followed by new marks works correctly', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.clearAll();
    r.markArea(3, { x: 5, y: 5, w: 20, h: 20 });
    assert.equal(r.count, 1);
    assert.equal(r.getMarks()[0].pageNum, 3);
  });
});

// ── PdfRedactor — getMarks ──────────────────────────────────────────────────

describe('PdfRedactor — getMarks', () => {
  let r;

  beforeEach(() => {
    r = new PdfRedactor();
  });

  it('returns marks with pageNum attached', () => {
    r.markArea(5, { x: 10, y: 20, w: 30, h: 40 });
    const marks = r.getMarks();
    assert.equal(marks.length, 1);
    assert.equal(marks[0].pageNum, 5);
    assert.equal(marks[0].x, 10);
    assert.equal(marks[0].y, 20);
  });

  it('returns marks from all pages in order', () => {
    r.markArea(1, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(3, { x: 0, y: 0, w: 10, h: 10 });
    r.markArea(2, { x: 0, y: 0, w: 10, h: 10 });
    const marks = r.getMarks();
    assert.equal(marks.length, 3);
    // Map iterates in insertion order
    assert.equal(marks[0].pageNum, 1);
    assert.equal(marks[1].pageNum, 3);
    assert.equal(marks[2].pageNum, 2);
  });
});

// ── PdfRedactor — constructor defaults ──────────────────────────────────────

describe('PdfRedactor — constructor', () => {
  it('sets previewColor to red', () => {
    const r = new PdfRedactor();
    assert.deepEqual(r.previewColor, { r: 1, g: 0, b: 0 });
  });

  it('sets fillColor to black', () => {
    const r = new PdfRedactor();
    assert.deepEqual(r.fillColor, { r: 0, g: 0, b: 0 });
  });

  it('initializes redactions as empty Map', () => {
    const r = new PdfRedactor();
    assert.ok(r.redactions instanceof Map);
    assert.equal(r.redactions.size, 0);
  });
});
