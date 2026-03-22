// ─── Extended Unit Tests: OCR Batch Module ──────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  BatchOcrProcessor,
  autoDetectLanguage,
} from '../../app/modules/ocr-batch.js';

// ─── BatchOcrProcessor ──────────────────────────────────────────────────────

describe('BatchOcrProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new BatchOcrProcessor();
  });

  it('starts with empty results', () => {
    assert.equal(processor.results.size, 0);
    assert.equal(processor.cancelled, false);
  });

  it('processAll processes all pages', async () => {
    const result = await processor.processAll({
      renderPage: async (pageNum) => ({ width: 100, height: 100 }),
      recognizeFn: async (canvas, lang) => ({ text: `Page ${lang}`, words: [{ text: 'hello', confidence: 90, bbox: {} }], confidence: 90 }),
      totalPages: 3,
    });

    assert.equal(result.processed, 3);
    assert.equal(result.total, 3);
    assert.equal(result.cancelled, false);
    assert.equal(processor.results.size, 3);
  });

  it('processAll with pageRange processes specific pages', async () => {
    const result = await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'txt', words: [], confidence: 80 }),
      totalPages: 10,
      pageRange: [2, 5, 8],
    });

    assert.equal(result.processed, 3);
    assert.equal(result.total, 3);
    assert.ok(processor.results.has(2));
    assert.ok(processor.results.has(5));
    assert.ok(processor.results.has(8));
  });

  it('processAll handles recognition errors gracefully', async () => {
    const errors = [];
    processor.on('page-error', (_, data) => errors.push(data));

    const result = await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => { throw new Error('OCR failed'); },
      totalPages: 2,
    });

    assert.equal(result.processed, 2);
    assert.equal(errors.length, 2);
  });

  it('cancel stops processing', async () => {
    let pagesDone = 0;

    const resultPromise = processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => {
        pagesDone++;
        if (pagesDone === 1) processor.cancel();
        return { text: 'ok', words: [], confidence: 90 };
      },
      totalPages: 5,
    });

    const result = await resultPromise;
    assert.equal(result.cancelled, true);
    assert.ok(result.processed < 5);
  });

  it('getPageResult returns result for a processed page', async () => {
    await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'hello world', words: [], confidence: 95 }),
      totalPages: 1,
    });

    const result = processor.getPageResult(1);
    assert.ok(result);
    assert.equal(result.text, 'hello world');
    assert.equal(result.confidence, 95);
  });

  it('getPageResult returns undefined for unprocessed page', () => {
    assert.equal(processor.getPageResult(999), undefined);
  });

  it('getFullText concatenates all page texts', async () => {
    await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async (_, lang) => ({ text: 'text', words: [], confidence: 90 }),
      totalPages: 3,
    });

    const fullText = processor.getFullText();
    assert.ok(fullText.includes('text'));
    assert.ok(fullText.includes('1'));
    assert.ok(fullText.includes('2'));
    assert.ok(fullText.includes('3'));
  });

  it('getFullText with custom separator', async () => {
    await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'content', words: [], confidence: 90 }),
      totalPages: 2,
    });

    const fullText = processor.getFullText('---PAGE {{page}}---');
    assert.ok(fullText.includes('---PAGE 1---'));
    assert.ok(fullText.includes('---PAGE 2---'));
  });

  it('on/off event subscription works', () => {
    let received = null;
    const unsub = processor.on('test-event', (event, data) => {
      received = { event, data };
    });

    processor._emit('test-event', { foo: 'bar' });
    assert.ok(received);
    assert.equal(received.event, 'test-event');
    assert.equal(received.data.foo, 'bar');

    unsub();
    received = null;
    processor._emit('test-event', { foo: 'baz' });
    assert.equal(received, null);
  });

  it('wildcard event listener receives all events', () => {
    const events = [];
    processor.on('*', (event, data) => events.push(event));

    processor._emit('page-start', {});
    processor._emit('page-done', {});

    assert.equal(events.length, 2);
    assert.ok(events.includes('page-start'));
    assert.ok(events.includes('page-done'));
  });

  it('onProgress callback is called for each page', async () => {
    const progressCalls = [];

    await processor.processAll({
      renderPage: async () => ({ width: 100, height: 100 }),
      recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      totalPages: 3,
      onProgress: (pageNum, total, status) => {
        progressCalls.push({ pageNum, total, status });
      },
    });

    // 3 progress calls + 1 final
    assert.ok(progressCalls.length >= 3);
  });
});

// ─── autoDetectLanguage ─────────────────────────────────────────────────────

describe('autoDetectLanguage', () => {
  it('returns eng for short text', () => {
    assert.equal(autoDetectLanguage('hi'), 'eng');
  });

  it('returns eng for empty text', () => {
    assert.equal(autoDetectLanguage(''), 'eng');
  });

  it('detects Russian from Cyrillic characters', () => {
    const russianText = 'Это текст на русском языке с достаточным количеством символов';
    assert.equal(autoDetectLanguage(russianText), 'rus');
  });

  it('detects Chinese from CJK characters', () => {
    const chineseText = '这是一段用中文写的文本，包含足够多的字符来进行检测';
    assert.equal(autoDetectLanguage(chineseText), 'chi_sim');
  });

  it('detects Arabic from Arabic characters', () => {
    const arabicText = 'هذا نص باللغة العربية يحتوي على عدد كافٍ من الأحرف للكشف';
    assert.equal(autoDetectLanguage(arabicText), 'ara');
  });

  it('detects English from common English words', () => {
    const englishText = 'The quick brown fox jumps over the lazy dog and runs for shelter in the barn';
    assert.equal(autoDetectLanguage(englishText), 'eng');
  });

  it('detects German from common German words', () => {
    const germanText = 'Der schnelle braune Fuchs springt und der Hund ist mit von der Partie';
    assert.equal(autoDetectLanguage(germanText), 'deu');
  });

  it('detects French from common French words', () => {
    const frenchText = 'Le petit chat est dans la maison et les enfants sont des amis pour une bonne cause que nous avons';
    assert.equal(autoDetectLanguage(frenchText), 'fra');
  });

  it('detects Spanish from common Spanish words', () => {
    const spanishText = 'El perro corría por el parque de la ciudad en los días de un largo verano que no termina';
    assert.equal(autoDetectLanguage(spanishText), 'spa');
  });

  it('returns eng when no characters match', () => {
    const numbersOnly = '1234567890 1234567890 1234567890 1234567890';
    assert.equal(autoDetectLanguage(numbersOnly), 'eng');
  });
});
