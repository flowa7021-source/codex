// ─── Unit Tests: OcrBatch ───────────────────────────────────────────────────
// Tests BatchOcrProcessor, autoDetectLanguage, and related helpers
// that work without Workers or the actual Tesseract engine.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  BatchOcrProcessor,
  autoDetectLanguage,
  batchOcr,
} from '../../app/modules/ocr-batch.js';

// ── autoDetectLanguage ──────────────────────────────────────────────────────

describe('autoDetectLanguage', () => {
  it('returns eng for short text', () => {
    assert.equal(autoDetectLanguage('hi'), 'eng');
    assert.equal(autoDetectLanguage(''), 'eng');
    assert.equal(autoDetectLanguage(null), 'eng');
    assert.equal(autoDetectLanguage(undefined), 'eng');
  });

  it('detects Russian (Cyrillic) text', () => {
    const text = 'Это пример текста на русском языке, который содержит достаточно слов';
    assert.equal(autoDetectLanguage(text), 'rus');
  });

  it('detects English text', () => {
    const text = 'This is an example of English text that the function should detect correctly based on common words';
    assert.equal(autoDetectLanguage(text), 'eng');
  });

  it('detects German text', () => {
    const text = 'Dies ist ein Beispiel für deutschen Text mit vielen Wörtern und der Sprache ist Deutsch';
    assert.equal(autoDetectLanguage(text), 'deu');
  });

  it('detects French text', () => {
    const text = 'Ceci est un exemple de texte en français avec les mots et la langue est le français';
    assert.equal(autoDetectLanguage(text), 'fra');
  });

  it('detects Spanish text', () => {
    const text = 'Este es un ejemplo de texto en español con las palabras y el idioma es español';
    assert.equal(autoDetectLanguage(text), 'spa');
  });

  it('detects Chinese (CJK) text', () => {
    const text = '这是一个中文文本的例子包含足够多的字符来让检测器识别语言';
    assert.equal(autoDetectLanguage(text), 'chi_sim');
  });

  it('detects Arabic text', () => {
    const text = 'هذا مثال على نص باللغة العربية يحتوي على كلمات كافية للكشف عن اللغة';
    assert.equal(autoDetectLanguage(text), 'ara');
  });

  it('returns eng when no character patterns match', () => {
    const text = '1234567890 !@#$%^&*() 1234567890';
    assert.equal(autoDetectLanguage(text), 'eng');
  });
});

// ── BatchOcrProcessor ───────────────────────────────────────────────────────

describe('BatchOcrProcessor', () => {
  /** @type {BatchOcrProcessor} */
  let proc;

  beforeEach(() => {
    proc = new BatchOcrProcessor();
  });

  describe('constructor', () => {
    it('initializes with empty results', () => {
      assert.equal(proc.results.size, 0);
      assert.equal(proc.cancelled, false);
    });
  });

  describe('processAll', () => {
    it('processes all pages and returns results', async () => {
      const result = await proc.processAll({
        totalPages: 3,
        renderPage: async (pageNum) => ({ width: 100, height: 100, pageNum }),
        recognizeFn: async (canvas) => ({
          text: `Text for page ${canvas.pageNum}`,
          words: [{ text: 'word', confidence: 90 }],
          confidence: 90,
        }),
      });

      assert.equal(result.processed, 3);
      assert.equal(result.total, 3);
      assert.equal(result.cancelled, false);
      assert.equal(proc.results.size, 3);
    });

    it('processes only specified page range', async () => {
      const result = await proc.processAll({
        totalPages: 10,
        pageRange: [2, 5, 7],
        renderPage: async () => ({ width: 100, height: 100 }),
        recognizeFn: async () => ({ text: 'text', words: [], confidence: 80 }),
      });

      assert.equal(result.processed, 3);
      assert.equal(result.total, 3);
      assert.ok(proc.results.has(2));
      assert.ok(proc.results.has(5));
      assert.ok(proc.results.has(7));
      assert.ok(!proc.results.has(1));
    });

    it('calls onProgress callback', async () => {
      const progressCalls = [];
      await proc.processAll({
        totalPages: 2,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 95 }),
        onProgress: (pageNum, total, status) => progressCalls.push({ pageNum, total, status }),
      });

      // One per page + final
      assert.ok(progressCalls.length >= 2);
    });

    it('handles recognition errors gracefully', async () => {
      const result = await proc.processAll({
        totalPages: 2,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async (canvas, lang) => {
          throw new Error('OCR engine failed');
        },
      });

      // Even with errors, processed count should reflect attempted pages
      assert.equal(result.processed, 2);
      assert.equal(result.total, 2);
    });

    it('stores image dimensions in results', async () => {
      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 800, height: 600 }),
        recognizeFn: async () => ({ text: 'hello', words: [], confidence: 85 }),
      });

      const pageResult = proc.getPageResult(1);
      assert.ok(pageResult);
      assert.equal(pageResult.imageWidth, 800);
      assert.equal(pageResult.imageHeight, 600);
    });
  });

  describe('cancel', () => {
    it('sets cancelled flag', () => {
      assert.equal(proc.cancelled, false);
      proc.cancel();
      assert.equal(proc.cancelled, true);
    });

    it('stops processing when cancelled', async () => {
      let processed = 0;
      const result = await proc.processAll({
        totalPages: 100,
        renderPage: async (pageNum) => {
          if (pageNum === 3) proc.cancel();
          return { width: 50, height: 50 };
        },
        recognizeFn: async () => {
          processed++;
          return { text: 'ok', words: [], confidence: 90 };
        },
      });

      assert.ok(result.cancelled);
      assert.ok(result.processed < 100);
    });
  });

  describe('getPageResult', () => {
    it('returns undefined for pages not processed', () => {
      assert.equal(proc.getPageResult(1), undefined);
    });

    it('returns result after processing', async () => {
      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 100, height: 100 }),
        recognizeFn: async () => ({ text: 'Hello World', words: [], confidence: 92 }),
      });

      const result = proc.getPageResult(1);
      assert.ok(result);
      assert.equal(result.text, 'Hello World');
      assert.equal(result.confidence, 92);
    });
  });

  describe('getFullText', () => {
    it('returns empty string when no results', () => {
      assert.equal(proc.getFullText(), '');
    });

    it('returns concatenated text of all pages sorted by page number', async () => {
      await proc.processAll({
        totalPages: 3,
        renderPage: async () => ({ width: 100, height: 100 }),
        recognizeFn: async (canvas, lang) => {
          // Simulate different text per page
          const texts = { 1: 'Alpha', 2: 'Beta', 3: 'Gamma' };
          const pageNum = [1, 2, 3][proc.results.size];
          return { text: texts[pageNum] || 'text', words: [], confidence: 90 };
        },
      });

      const fullText = proc.getFullText();
      assert.ok(fullText.includes('Alpha'));
      assert.ok(fullText.includes('Beta'));
      assert.ok(fullText.includes('Gamma'));
    });

    it('uses custom separator', async () => {
      await proc.processAll({
        totalPages: 2,
        renderPage: async () => ({ width: 100, height: 100 }),
        recognizeFn: async () => ({ text: 'Text', words: [], confidence: 90 }),
      });

      const fullText = proc.getFullText('--- Page {{page}} ---');
      assert.ok(fullText.includes('--- Page 1 ---'));
      assert.ok(fullText.includes('--- Page 2 ---'));
    });
  });

  describe('on (event listener)', () => {
    it('fires page-start and page-done events', async () => {
      const events = [];
      proc.on('page-start', (event, data) => events.push({ event, data }));
      proc.on('page-done', (event, data) => events.push({ event, data }));

      await proc.processAll({
        totalPages: 2,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      });

      const starts = events.filter(e => e.event === 'page-start');
      const dones = events.filter(e => e.event === 'page-done');
      assert.equal(starts.length, 2);
      assert.equal(dones.length, 2);
    });

    it('fires done event on completion', async () => {
      const events = [];
      proc.on('done', (event, data) => events.push(data));

      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].processed, 1);
      assert.equal(events[0].total, 1);
    });

    it('fires page-error on recognition failure', async () => {
      const errors = [];
      proc.on('page-error', (event, data) => errors.push(data));

      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => { throw new Error('fail'); },
      });

      assert.equal(errors.length, 1);
      assert.ok(errors[0].error.includes('fail'));
    });

    it('fires cancelled event when cancelled', async () => {
      const events = [];
      proc.on('cancelled', (event, data) => events.push(data));

      await proc.processAll({
        totalPages: 5,
        renderPage: async (pageNum) => {
          if (pageNum === 2) proc.cancel();
          return { width: 50, height: 50 };
        },
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      });

      assert.ok(events.length >= 1);
    });

    it('wildcard listener receives all events', async () => {
      const events = [];
      proc.on('*', (event) => events.push(event));

      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      });

      assert.ok(events.includes('page-start'));
      assert.ok(events.includes('page-done'));
      assert.ok(events.includes('done'));
    });

    it('unsubscribe function works', async () => {
      const events = [];
      const unsub = proc.on('done', (event, data) => events.push(data));
      unsub();

      await proc.processAll({
        totalPages: 1,
        renderPage: async () => ({ width: 50, height: 50 }),
        recognizeFn: async () => ({ text: 'ok', words: [], confidence: 90 }),
      });

      assert.equal(events.length, 0);
    });
  });
});

// ── batchOcr singleton ──────────────────────────────────────────────────────

describe('batchOcr singleton', () => {
  it('is an instance of BatchOcrProcessor', () => {
    assert.ok(batchOcr instanceof BatchOcrProcessor);
  });

  it('has processAll method', () => {
    assert.equal(typeof batchOcr.processAll, 'function');
  });

  it('has cancel method', () => {
    assert.equal(typeof batchOcr.cancel, 'function');
  });

  it('has getFullText method', () => {
    assert.equal(typeof batchOcr.getFullText, 'function');
  });
});

// ── isScannedPage / detectScannedDocument ───────────────────────────────────

describe('isScannedPage', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/ocr-batch.js');
    assert.equal(typeof mod.isScannedPage, 'function');
  });
});

describe('detectScannedDocument', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/ocr-batch.js');
    assert.equal(typeof mod.detectScannedDocument, 'function');
  });
});

// ── createSearchablePdf ─────────────────────────────────────────────────────

describe('createSearchablePdf', () => {
  it('is exported as an async function', async () => {
    const mod = await import('../../app/modules/ocr-batch.js');
    assert.equal(typeof mod.createSearchablePdf, 'function');
  });
});
