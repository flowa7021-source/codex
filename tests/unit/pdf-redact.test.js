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
