// ─── Unit Tests: perf-budgets ────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_RENDER_BUDGET_MS,
  OCR_PAGE_BUDGET_MS,
  FILE_OPEN_BUDGET_MS,
  SEARCH_BUDGET_MS,
  checkBudget,
  reportBudgetViolation,
} from '../../app/modules/perf-budgets.js';

import {
  getLogEntries,
  clearActivityLog,
} from '../../app/modules/diagnostics.js';

// ─── Constants ───────────────────────────────────────────────────────────────

describe('perf-budgets – exported constants', () => {
  it('PAGE_RENDER_BUDGET_MS is 200', () => {
    assert.equal(PAGE_RENDER_BUDGET_MS, 200);
  });

  it('OCR_PAGE_BUDGET_MS is 3000', () => {
    assert.equal(OCR_PAGE_BUDGET_MS, 3000);
  });

  it('FILE_OPEN_BUDGET_MS is 1000', () => {
    assert.equal(FILE_OPEN_BUDGET_MS, 1000);
  });

  it('SEARCH_BUDGET_MS is 500', () => {
    assert.equal(SEARCH_BUDGET_MS, 500);
  });

  it('all constants are positive numbers', () => {
    for (const c of [PAGE_RENDER_BUDGET_MS, OCR_PAGE_BUDGET_MS, FILE_OPEN_BUDGET_MS, SEARCH_BUDGET_MS]) {
      assert.equal(typeof c, 'number');
      assert.ok(c > 0);
    }
  });
});

// ─── checkBudget – within budget ─────────────────────────────────────────────

describe('checkBudget – within budget', () => {
  it('returns ok when render time equals budget exactly', () => {
    const result = checkBudget('renderTimes', 200);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 200);
    assert.equal(result.actual, 200);
    assert.equal(result.overBy, 0);
  });

  it('returns ok when render time is below budget', () => {
    const result = checkBudget('renderTimes', 100);
    assert.equal(result.ok, true);
    assert.equal(result.overBy, 0);
  });

  it('returns ok for zero duration', () => {
    const result = checkBudget('ocrTimes', 0);
    assert.equal(result.ok, true);
    assert.equal(result.overBy, 0);
  });

  it('returns ok for ocrTimes at budget boundary', () => {
    const result = checkBudget('ocrTimes', 3000);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 3000);
  });

  it('returns ok for pageLoadTimes at budget boundary', () => {
    const result = checkBudget('pageLoadTimes', 1000);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 1000);
  });

  it('returns ok for searchTimes at budget boundary', () => {
    const result = checkBudget('searchTimes', 500);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 500);
  });
});

// ─── checkBudget – over budget ───────────────────────────────────────────────

describe('checkBudget – over budget', () => {
  it('returns not-ok when render time exceeds budget', () => {
    const result = checkBudget('renderTimes', 250);
    assert.equal(result.ok, false);
    assert.equal(result.budget, 200);
    assert.equal(result.actual, 250);
    assert.equal(result.overBy, 50);
  });

  it('detects OCR budget violation', () => {
    const result = checkBudget('ocrTimes', 5000);
    assert.equal(result.ok, false);
    assert.equal(result.budget, 3000);
    assert.equal(result.overBy, 2000);
  });

  it('detects pageLoadTimes budget violation', () => {
    const result = checkBudget('pageLoadTimes', 1500);
    assert.equal(result.ok, false);
    assert.equal(result.budget, 1000);
    assert.equal(result.overBy, 500);
  });

  it('detects searchTimes budget violation', () => {
    const result = checkBudget('searchTimes', 750);
    assert.equal(result.ok, false);
    assert.equal(result.budget, 500);
    assert.equal(result.overBy, 250);
  });

  it('overBy is exactly 1 when 1ms over budget', () => {
    const result = checkBudget('renderTimes', 201);
    assert.equal(result.ok, false);
    assert.equal(result.overBy, 1);
  });
});

// ─── checkBudget – unknown metric ────────────────────────────────────────────

describe('checkBudget – unknown metric', () => {
  it('returns ok with budget 0 for unrecognized metric', () => {
    const result = checkBudget('unknownMetric', 9999);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 0);
    assert.equal(result.actual, 9999);
    assert.equal(result.overBy, 0);
  });

  it('returns ok for empty string metric', () => {
    const result = checkBudget('', 100);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 0);
  });
});

// ─── checkBudget – overBy is never negative ──────────────────────────────────

describe('checkBudget – overBy is never negative', () => {
  it('overBy is 0 when well under budget', () => {
    const result = checkBudget('renderTimes', 50);
    assert.equal(result.overBy, 0);
  });

  it('overBy is 0 for unknown metric regardless of value', () => {
    const result = checkBudget('nope', 0);
    assert.equal(result.overBy, 0);
  });
});

// ─── checkBudget – return shape ──────────────────────────────────────────────

describe('checkBudget – return shape', () => {
  it('always returns an object with ok, budget, actual, overBy', () => {
    const result = checkBudget('renderTimes', 150);
    assert.ok('ok' in result);
    assert.ok('budget' in result);
    assert.ok('actual' in result);
    assert.ok('overBy' in result);
    assert.equal(Object.keys(result).length, 4);
  });
});

// ─── reportBudgetViolation ───────────────────────────────────────────────────

describe('reportBudgetViolation', () => {
  beforeEach(() => {
    clearActivityLog();
  });

  it('does NOT log when metric is within budget', () => {
    const countBefore = getLogEntries().length;
    reportBudgetViolation('renderTimes', 100);
    assert.equal(getLogEntries().length, countBefore);
  });

  it('does NOT log when metric equals budget exactly', () => {
    const countBefore = getLogEntries().length;
    reportBudgetViolation('searchTimes', 500);
    assert.equal(getLogEntries().length, countBefore);
  });

  it('logs a warning when metric exceeds budget', () => {
    const countBefore = getLogEntries().length;
    reportBudgetViolation('renderTimes', 350);
    const entries = getLogEntries();
    assert.equal(entries.length, countBefore + 1);

    const entry = entries[entries.length - 1];
    assert.equal(entry.module, 'perf');
    assert.equal(entry.level, 'warn');
    assert.ok(entry.action.includes('Budget exceeded'));
    assert.ok(entry.action.includes('renderTimes'));
    assert.equal(entry.data.metric, 'renderTimes');
    assert.equal(entry.data.budget, 200);
    assert.equal(entry.data.actual, 350);
    assert.equal(entry.data.overBy, 150);
  });

  it('logs correct data for OCR budget violation', () => {
    reportBudgetViolation('ocrTimes', 4000);
    const entries = getLogEntries();
    const entry = entries[entries.length - 1];
    assert.equal(entry.data.budget, 3000);
    assert.equal(entry.data.overBy, 1000);
  });

  it('logs correct data for pageLoadTimes violation', () => {
    reportBudgetViolation('pageLoadTimes', 2000);
    const entries = getLogEntries();
    const entry = entries[entries.length - 1];
    assert.equal(entry.data.metric, 'pageLoadTimes');
    assert.equal(entry.data.budget, 1000);
    assert.equal(entry.data.overBy, 1000);
  });

  it('logs correct data for searchTimes violation', () => {
    reportBudgetViolation('searchTimes', 800);
    const entries = getLogEntries();
    const entry = entries[entries.length - 1];
    assert.equal(entry.data.metric, 'searchTimes');
    assert.equal(entry.data.budget, 500);
    assert.equal(entry.data.overBy, 300);
  });

  it('does NOT log for unknown metric even with large value', () => {
    const countBefore = getLogEntries().length;
    reportBudgetViolation('fooBar', 99999);
    assert.equal(getLogEntries().length, countBefore);
  });
});
