// ─── Deep Unit Tests: OCR Batch ──────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BatchOcrProcessor, autoDetectLanguage } from '../../app/modules/ocr-batch.js';

// ─── BatchOcrProcessor ──────────────────────────────────────────────────────

describe('BatchOcrProcessor processAll', () => {
  let proc;

  beforeEach(() => {
    proc = new BatchOcrProcessor();
  });

  it('processes all pages and returns results', async () => {
    const result = await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'hello', words: [{ text: 'hello' }], confidence: 95 }),
      totalPages: 3,
    });
    assert.equal(result.processed, 3);
    assert.equal(result.total, 3);
    assert.equal(result.cancelled, false);
    assert.ok(result.results);
  });

  it('respects pageRange parameter', async () => {
    const result = await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 10,
      pageRange: [1, 5, 10],
    });
    assert.equal(result.processed, 3);
    assert.equal(result.total, 3);
  });

  it('handles errors on individual pages gracefully', async () => {
    let callCount = 0;
    const result = await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => {
        callCount++;
        if (callCount === 2) throw new Error('OCR failed');
        return { text: 'ok', words: [], confidence: 90 };
      },
      totalPages: 3,
    });
    assert.equal(result.processed, 3);
  });

  it('handles cancel during processing', async () => {
    const result = await proc.processAll({
      renderPage: async (pageNum) => {
        if (pageNum === 2) proc.cancel();
        return { width: 100, height: 100 };
      },
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 5,
    });
    // After page 1, page 2 starts, renderPage cancels, then page 3 sees cancelled=true
    assert.ok(result.cancelled || result.processed < 5);
  });

  it('calls onProgress callback', async () => {
    const progressCalls = [];
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 2,
      onProgress: (page, total, status) => { progressCalls.push({ page, total, status }); },
    });
    assert.ok(progressCalls.length > 0);
  });
});

describe('BatchOcrProcessor getPageResult', () => {
  it('returns result for processed page', async () => {
    const proc = new BatchOcrProcessor();
    await proc.processAll({
      renderPage: async () => ({ width: 200, height: 300 }),
      recognizeFn: async () => ({ text: 'page text', words: [{ text: 'page' }], confidence: 88 }),
      totalPages: 1,
    });
    const result = proc.getPageResult(1);
    assert.ok(result);
    assert.equal(result.text, 'page text');
    assert.equal(result.imageWidth, 200);
    assert.equal(result.imageHeight, 300);
  });

  it('returns undefined for unprocessed page', () => {
    const proc = new BatchOcrProcessor();
    assert.equal(proc.getPageResult(99), undefined);
  });
});

describe('BatchOcrProcessor getFullText', () => {
  it('returns combined text of all pages', async () => {
    const proc = new BatchOcrProcessor();
    let pageNum = 0;
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => {
        pageNum++;
        return { text: `Page ${pageNum} text`, words: [], confidence: 90 };
      },
      totalPages: 3,
    });
    const full = proc.getFullText();
    assert.ok(full.includes('Page 1 text'));
    assert.ok(full.includes('Page 2 text'));
    assert.ok(full.includes('Page 3 text'));
  });

  it('uses custom separator', async () => {
    const proc = new BatchOcrProcessor();
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'txt', words: [], confidence: 90 }),
      totalPages: 2,
    });
    const full = proc.getFullText('\n--- P{{page}} ---\n');
    assert.ok(full.includes('--- P1 ---'));
    assert.ok(full.includes('--- P2 ---'));
  });
});

describe('BatchOcrProcessor events', () => {
  it('emits page-start and page-done events', async () => {
    const proc = new BatchOcrProcessor();
    const events = [];
    proc.on('page-start', (ev, data) => events.push({ ev, data }));
    proc.on('page-done', (ev, data) => events.push({ ev, data }));
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 1,
    });
    const starts = events.filter(e => e.ev === 'page-start');
    const dones = events.filter(e => e.ev === 'page-done');
    assert.equal(starts.length, 1);
    assert.equal(dones.length, 1);
  });

  it('emits done event after all pages', async () => {
    const proc = new BatchOcrProcessor();
    let doneEvent = null;
    proc.on('done', (ev, data) => { doneEvent = data; });
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 2,
    });
    assert.ok(doneEvent);
    assert.equal(doneEvent.processed, 2);
  });

  it('emits page-error on failure', async () => {
    const proc = new BatchOcrProcessor();
    const errors = [];
    proc.on('page-error', (ev, data) => errors.push(data));
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => { throw new Error('fail'); },
      totalPages: 1,
    });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, 'fail');
  });

  it('wildcard listener receives all events', async () => {
    const proc = new BatchOcrProcessor();
    const events = [];
    proc.on('*', (ev) => events.push(ev));
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 1,
    });
    assert.ok(events.includes('page-start'));
    assert.ok(events.includes('page-done'));
    assert.ok(events.includes('done'));
  });

  it('unsubscribe stops event delivery', async () => {
    const proc = new BatchOcrProcessor();
    let count = 0;
    const unsub = proc.on('page-done', () => { count++; });
    unsub(); // immediately unsubscribe
    await proc.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 1,
    });
    assert.equal(count, 0);
  });
});

describe('BatchOcrProcessor cancel', () => {
  it('sets cancelled flag', () => {
    const proc = new BatchOcrProcessor();
    proc.cancel();
    assert.equal(proc.cancelled, true);
  });
});

// ─── autoDetectLanguage ─────────────────────────────────────────────────────

describe('autoDetectLanguage', () => {
  it('returns eng for empty/short text', () => {
    assert.equal(autoDetectLanguage(''), 'eng');
    assert.equal(autoDetectLanguage('hi'), 'eng');
    assert.equal(autoDetectLanguage(null), 'eng');
  });

  it('detects Russian text (Cyrillic)', () => {
    const text = 'Привет мир это тестовый текст на русском языке который достаточно длинный';
    assert.equal(autoDetectLanguage(text), 'rus');
  });

  it('detects CJK text', () => {
    const text = '这是一个测试文本用于检测中文语言的自动识别功能是否正常工作';
    assert.equal(autoDetectLanguage(text), 'chi_sim');
  });

  it('detects Arabic text', () => {
    const text = 'هذا نص اختبار باللغة العربية لاختبار الكشف التلقائي عن اللغة';
    assert.equal(autoDetectLanguage(text), 'ara');
  });

  it('detects German text', () => {
    const text = 'der die und das ist ein nicht für auf mit dem von zu den werden aus';
    assert.equal(autoDetectLanguage(text), 'deu');
  });

  it('detects French text', () => {
    const text = 'le la les de des et un une est pas que dans pour sur avec';
    assert.equal(autoDetectLanguage(text), 'fra');
  });

  it('detects Spanish text', () => {
    const text = 'el la los las de del en un una es que por para con no como';
    assert.equal(autoDetectLanguage(text), 'spa');
  });

  it('returns eng for text with no recognizable script', () => {
    const text = '12345 67890 12345 67890 12345';
    assert.equal(autoDetectLanguage(text), 'eng');
  });
});
