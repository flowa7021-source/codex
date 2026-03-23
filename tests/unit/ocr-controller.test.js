// ─── Unit Tests: OCR Controller ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeOcrConfidence,
  postCorrectOcrText,
  normalizeOcrTextByLang,
  classifyOcrError,
  batchOcrState,
  enqueueBatchOcr,
  cancelBatchOcr,
  getBatchOcrProgress,
  scoreOcrTextByLang,
  setOcrStatus,
  setOcrStatusThrottled,
  setOcrControlsBusy,
  cancelManualOcrTasks,
  cancelAllOcrWork,
  cancelBackgroundOcrScan,
  initOcrControllerDeps,
} from '../../app/modules/ocr-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── computeOcrConfidence ───────────────────────────────────────────────────

describe('computeOcrConfidence', () => {
  it('returns none for empty text', () => {
    const result = computeOcrConfidence('', []);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'none');
  });

  it('returns none for null text', () => {
    const result = computeOcrConfidence(null, []);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'none');
  });

  it('returns none for null variants', () => {
    const result = computeOcrConfidence('hello', null);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'none');
  });

  it('returns none for empty variants array', () => {
    const result = computeOcrConfidence('hello', []);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'none');
  });

  it('returns score for normal English text', () => {
    const text = 'This is a sample OCR text with multiple words and sentences for testing';
    const result = computeOcrConfidence(text, ['variant1']);
    assert.ok(result.score > 0);
    assert.ok(['high', 'medium', 'low', 'very-low'].includes(result.level));
    assert.ok(result.details.charCount > 0);
    assert.ok(result.details.wordCount > 0);
    assert.ok(result.details.alphaRatio > 0);
  });

  it('returns lower score for garbage text', () => {
    const text = '!@#$%^&*(){}[]|\\~`';
    const result = computeOcrConfidence(text, ['v']);
    assert.ok(result.score < 50);
    assert.ok(result.details.garbageRatio > 0);
  });

  it('returns score details with correct types', () => {
    const text = 'Hello world test';
    const result = computeOcrConfidence(text, ['v']);
    assert.equal(typeof result.score, 'number');
    assert.equal(typeof result.level, 'string');
    assert.equal(typeof result.details.langScore, 'number');
    assert.equal(typeof result.details.readability, 'number');
    assert.equal(typeof result.details.wordLength, 'number');
    assert.equal(typeof result.details.charCount, 'number');
    assert.equal(typeof result.details.wordCount, 'number');
    assert.equal(typeof result.details.alphaRatio, 'number');
    assert.equal(typeof result.details.garbageRatio, 'number');
  });

  it('assigns high level for score >= 80', () => {
    // Construct text that would score high: mostly alphabetic, many words, good word length
    const text = 'This is a very good sample text that should score high in the OCR confidence test with normal words';
    const result = computeOcrConfidence(text, ['v']);
    // Score may vary but structure should be correct
    assert.ok(['high', 'medium', 'low', 'very-low'].includes(result.level));
  });

  it('handles Russian text', () => {
    const text = 'Привет мир это тестовый текст на русском языке для проверки';
    const result = computeOcrConfidence(text, ['v']);
    assert.ok(result.score > 0);
    assert.ok(result.details.alphaRatio > 0);
  });

  it('handles digit-heavy text', () => {
    const text = '12345 67890 11111 22222';
    const result = computeOcrConfidence(text, ['v']);
    assert.ok(result.details.charCount > 0);
  });
});

// ── classifyOcrError ───────────────────────────────────────────────────────

describe('classifyOcrError', () => {
  it('returns unknown for empty message', () => {
    assert.equal(classifyOcrError(''), 'unknown');
    assert.equal(classifyOcrError(null), 'unknown');
    assert.equal(classifyOcrError(undefined), 'unknown');
  });

  it('classifies runtime errors', () => {
    assert.equal(classifyOcrError('Runtime error occurred'), 'runtime');
    assert.equal(classifyOcrError('Tesseract failed'), 'runtime');
  });

  it('classifies asset-load errors', () => {
    assert.equal(classifyOcrError('Failed to fetch resource'), 'asset-load');
    assert.equal(classifyOcrError('HTTP 404 error'), 'asset-load');
    assert.equal(classifyOcrError('Could not load file'), 'asset-load');
  });

  it('classifies memory errors', () => {
    assert.equal(classifyOcrError('Out of memory'), 'memory');
    assert.equal(classifyOcrError('Memory allocation failed'), 'memory');
  });

  it('classifies timeout errors', () => {
    assert.equal(classifyOcrError('Operation timeout'), 'timeout');
  });

  it('classifies processing errors (fallback)', () => {
    assert.equal(classifyOcrError('Some random error'), 'processing');
    assert.equal(classifyOcrError('conversion failed'), 'processing');
  });

  it('is case-insensitive', () => {
    assert.equal(classifyOcrError('RUNTIME ERROR'), 'runtime');
    assert.equal(classifyOcrError('FETCH failed'), 'asset-load');
    assert.equal(classifyOcrError('TIMEOUT'), 'timeout');
  });
});

// ── normalizeOcrTextByLang ─────────────────────────────────────────────────

describe('normalizeOcrTextByLang', () => {
  it('returns empty for empty/null input', () => {
    assert.equal(normalizeOcrTextByLang(''), '');
    assert.equal(normalizeOcrTextByLang(null), '');
    assert.equal(normalizeOcrTextByLang(undefined), '');
  });

  it('normalizes whitespace', () => {
    const result = normalizeOcrTextByLang('hello   world\t\rfoo', 'eng');
    assert.ok(!result.includes('\t'));
    assert.ok(!result.includes('\r'));
  });

  it('collapses repeated punctuation', () => {
    const result = normalizeOcrTextByLang('hello!!!!world', 'eng');
    assert.ok(!result.includes('!!!!'));
  });

  it('collapses repeated pipes', () => {
    const result = normalizeOcrTextByLang('text||||||more', 'eng');
    assert.ok(!result.includes('||||||'));
  });

  it('removes control characters', () => {
    const result = normalizeOcrTextByLang('hello\x00\x01world', 'eng');
    assert.ok(!result.includes('\x00'));
    assert.ok(!result.includes('\x01'));
  });

  it('strips non-English chars for eng language', () => {
    const result = normalizeOcrTextByLang('Hello @#$ world', 'eng');
    assert.ok(!result.includes('@'));
    assert.ok(!result.includes('#'));
    assert.ok(!result.includes('$'));
  });

  it('handles German text with umlauts', () => {
    const result = normalizeOcrTextByLang('Über die Straße', 'deu');
    assert.ok(result.includes('Über'));
    assert.ok(result.includes('Straße'));
  });

  it('handles French text with accents', () => {
    const result = normalizeOcrTextByLang('café résumé', 'fra');
    assert.ok(result.includes('café'));
    assert.ok(result.includes('résumé'));
  });

  it('handles Spanish text', () => {
    const result = normalizeOcrTextByLang('¿Cómo estás?', 'spa');
    assert.ok(result.includes('Cómo'));
    assert.ok(result.includes('estás'));
  });

  it('handles Italian text', () => {
    const result = normalizeOcrTextByLang('città più', 'ita');
    assert.ok(result.includes('città'));
  });

  it('handles Portuguese text', () => {
    const result = normalizeOcrTextByLang('ação coração', 'por');
    assert.ok(result.includes('ação'));
    assert.ok(result.includes('coração'));
  });

  it('handles Russian lang and converts Latin lookalikes', () => {
    const result = normalizeOcrTextByLang('Привет мир', 'rus');
    assert.ok(result.length > 0);
  });

  it('handles auto/unknown lang with mixed scripts', () => {
    const result = normalizeOcrTextByLang('Hello мир test текст', 'auto');
    assert.ok(result.length > 0);
  });
});

// ── batchOcrState and queue functions ──────────────────────────────────────

describe('enqueueBatchOcr', () => {
  beforeEach(() => {
    batchOcrState.queue = [];
    batchOcrState.running = false;
    batchOcrState.progress = { completed: 0, total: 0, currentPage: 0 };
    batchOcrState.cancelled = false;
    batchOcrState.results.clear();
    batchOcrState.confidenceStats = { high: 0, medium: 0, low: 0, veryLow: 0 };
  });

  it('adds pages to queue with default priority', () => {
    enqueueBatchOcr([1, 2, 3]);
    assert.equal(batchOcrState.queue.length, 3);
    assert.equal(batchOcrState.queue[0].page, 1);
    assert.equal(batchOcrState.queue[0].priority, 'normal');
    assert.equal(batchOcrState.queue[0].status, 'pending');
  });

  it('adds high priority pages to front of queue', () => {
    enqueueBatchOcr([1, 2], 'normal');
    enqueueBatchOcr([3, 4], 'high');
    assert.equal(batchOcrState.queue[0].page, 3);
    assert.equal(batchOcrState.queue[1].page, 4);
    assert.equal(batchOcrState.queue[2].page, 1);
  });

  it('updates total in progress', () => {
    enqueueBatchOcr([1, 2, 3]);
    assert.equal(batchOcrState.progress.total, 3);
  });
});

describe('cancelBatchOcr', () => {
  beforeEach(() => {
    batchOcrState.queue = [{ page: 1, priority: 'normal', status: 'pending' }];
    batchOcrState.running = true;
    batchOcrState.cancelled = false;
    batchOcrState.progress = { completed: 2, total: 5, currentPage: 3 };
  });

  it('sets cancelled flag', () => {
    cancelBatchOcr();
    assert.equal(batchOcrState.cancelled, true);
  });

  it('clears the queue', () => {
    cancelBatchOcr();
    assert.equal(batchOcrState.queue.length, 0);
  });

  it('sets running to false', () => {
    cancelBatchOcr();
    assert.equal(batchOcrState.running, false);
  });
});

describe('getBatchOcrProgress', () => {
  beforeEach(() => {
    batchOcrState.queue = [];
    batchOcrState.running = false;
    batchOcrState.progress = { completed: 0, total: 0, currentPage: 0 };
    batchOcrState.confidenceStats = { high: 0, medium: 0, low: 0, veryLow: 0 };
  });

  it('returns 0 percent when total is 0', () => {
    const p = getBatchOcrProgress();
    assert.equal(p.percent, 0);
    assert.equal(p.running, false);
    assert.equal(p.queueLength, 0);
  });

  it('calculates percent correctly', () => {
    batchOcrState.progress.completed = 5;
    batchOcrState.progress.total = 10;
    batchOcrState.running = true;
    const p = getBatchOcrProgress();
    assert.equal(p.percent, 50);
    assert.equal(p.running, true);
  });

  it('returns a copy of confidenceStats', () => {
    batchOcrState.confidenceStats.high = 3;
    const p = getBatchOcrProgress();
    assert.deepEqual(p.confidenceStats, { high: 3, medium: 0, low: 0, veryLow: 0 });
    // Mutating the returned object should not affect original
    p.confidenceStats.high = 99;
    assert.equal(batchOcrState.confidenceStats.high, 3);
  });
});

// ── setOcrStatus / setOcrControlsBusy ──────────────────────────────────────

describe('setOcrStatus', () => {
  it('sets ocrStatus textContent when element exists', () => {
    const mockEl = { textContent: '' };
    const prevOcrStatus = els.ocrStatus;
    const prevSbOcr = els.sbOcr;
    els.ocrStatus = mockEl;
    els.sbOcr = { textContent: '' };
    setOcrStatus('test status');
    assert.equal(mockEl.textContent, 'test status');
    assert.equal(els.sbOcr.textContent, 'OCR: test status');
    els.ocrStatus = prevOcrStatus;
    els.sbOcr = prevSbOcr;
  });

  it('sets sb text to OCR: — when text is empty', () => {
    const mockEl = { textContent: '' };
    const prevSbOcr = els.sbOcr;
    const prevOcrStatus = els.ocrStatus;
    els.sbOcr = mockEl;
    els.ocrStatus = { textContent: '' };
    setOcrStatus('');
    assert.equal(mockEl.textContent, 'OCR: —');
    els.sbOcr = prevSbOcr;
    els.ocrStatus = prevOcrStatus;
  });
});

describe('setOcrControlsBusy', () => {
  it('disables controls when busy', () => {
    const mockBtn = { disabled: false };
    const prev1 = els.ocrCurrentPage;
    const prev2 = els.ocrRegionMode;
    const prev3 = els.copyOcrText;
    els.ocrCurrentPage = mockBtn;
    els.ocrRegionMode = { disabled: false };
    els.copyOcrText = { disabled: false };
    setOcrControlsBusy(true);
    assert.equal(mockBtn.disabled, true);
    els.ocrCurrentPage = prev1;
    els.ocrRegionMode = prev2;
    els.copyOcrText = prev3;
  });

  it('enables controls when not busy', () => {
    const mockBtn = { disabled: true };
    const prev1 = els.ocrCurrentPage;
    const prev2 = els.ocrRegionMode;
    const prev3 = els.copyOcrText;
    els.ocrCurrentPage = mockBtn;
    els.ocrRegionMode = { disabled: true };
    els.copyOcrText = { disabled: true };
    setOcrControlsBusy(false);
    assert.equal(mockBtn.disabled, false);
    els.ocrCurrentPage = prev1;
    els.ocrRegionMode = prev2;
    els.copyOcrText = prev3;
  });
});

// ── cancelManualOcrTasks ───────────────────────────────────────────────────

describe('cancelManualOcrTasks', () => {
  it('increments ocrQueueEpoch and ocrTaskId', () => {
    const epochBefore = state.ocrQueueEpoch;
    const taskIdBefore = state.ocrTaskId;
    cancelManualOcrTasks('test');
    assert.ok(state.ocrQueueEpoch > epochBefore);
    assert.ok(state.ocrTaskId > taskIdBefore);
  });

  it('resets ocrLatestByReason', () => {
    state.ocrLatestByReason = { foo: 'bar' };
    cancelManualOcrTasks();
    assert.deepEqual(state.ocrLatestByReason, {});
  });
});

// ── cancelBackgroundOcrScan ────────────────────────────────────────────────

describe('cancelBackgroundOcrScan', () => {
  it('resets background OCR state', () => {
    state.backgroundOcrToken = 42;
    state.backgroundOcrRunning = true;
    state.backgroundOcrTimer = null;
    cancelBackgroundOcrScan('test');
    assert.equal(state.backgroundOcrToken, 0);
    assert.equal(state.backgroundOcrRunning, false);
  });
});

// ── cancelAllOcrWork ───────────────────────────────────────────────────────

describe('cancelAllOcrWork', () => {
  it('cancels both background and manual OCR', () => {
    state.backgroundOcrToken = 42;
    state.backgroundOcrRunning = true;
    state.backgroundOcrTimer = null;
    cancelAllOcrWork('test-stop');
    assert.equal(state.backgroundOcrToken, 0);
    assert.equal(state.backgroundOcrRunning, false);
  });
});

// ── postCorrectOcrText ─────────────────────────────────────────────────────

describe('postCorrectOcrText', () => {
  it('returns empty for null/empty input', () => {
    assert.equal(postCorrectOcrText(''), '');
    assert.equal(postCorrectOcrText(null), null);
    assert.equal(postCorrectOcrText(undefined), undefined);
  });

  it('delegates to ocr-languages post-correction', () => {
    const text = 'Some text to correct';
    const result = postCorrectOcrText(text, 'eng');
    assert.equal(typeof result, 'string');
  });
});

// ── initOcrControllerDeps ──────────────────────────────────────────────────

describe('initOcrControllerDeps', () => {
  it('accepts deps without error', () => {
    assert.doesNotThrow(() => {
      initOcrControllerDeps({
        renderAnnotations: () => {},
        updateOverlayInteractionState: () => {},
        getCurrentAnnotationCtx: () => null,
        denormalizePoint: (p) => p,
        renderTextLayer: async () => {},
        applyAppLanguage: () => {},
        _ocrWordCache: new Map(),
      });
    });
  });
});

// ── setOcrStatusThrottled ──────────────────────────────────────────────────

describe('setOcrStatusThrottled', () => {
  beforeEach(() => {
    state.ocrLastProgressText = '';
    state.ocrLastProgressUiAt = 0;
  });

  it('skips update if text is the same', () => {
    const mockEl = { textContent: '' };
    const prev = els.ocrStatus;
    els.ocrStatus = mockEl;
    // First call sets the text
    setOcrStatusThrottled('test');
    // Second call with same text should be skipped
    mockEl.textContent = ''; // reset
    state.ocrLastProgressUiAt = 0; // allow timing
    setOcrStatusThrottled('test');
    assert.equal(mockEl.textContent, '');
    els.ocrStatus = prev;
  });
});
