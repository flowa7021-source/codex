// ─── Extended Unit Tests: Performance Budgets Module ─────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_RENDER_BUDGET_MS,
  OCR_PAGE_BUDGET_MS,
  FILE_OPEN_BUDGET_MS,
  SEARCH_BUDGET_MS,
  checkBudget,
  reportBudgetViolation,
} from '../../app/modules/perf-budgets.js';

// ─── Budget Constants ───────────────────────────────────────────────────────

describe('Budget Constants', () => {
  it('exports PAGE_RENDER_BUDGET_MS', () => {
    assert.equal(typeof PAGE_RENDER_BUDGET_MS, 'number');
    assert.ok(PAGE_RENDER_BUDGET_MS > 0);
  });

  it('exports OCR_PAGE_BUDGET_MS', () => {
    assert.equal(typeof OCR_PAGE_BUDGET_MS, 'number');
    assert.ok(OCR_PAGE_BUDGET_MS > 0);
  });

  it('exports FILE_OPEN_BUDGET_MS', () => {
    assert.equal(typeof FILE_OPEN_BUDGET_MS, 'number');
    assert.ok(FILE_OPEN_BUDGET_MS > 0);
  });

  it('exports SEARCH_BUDGET_MS', () => {
    assert.equal(typeof SEARCH_BUDGET_MS, 'number');
    assert.ok(SEARCH_BUDGET_MS > 0);
  });
});

// ─── checkBudget ────────────────────────────────────────────────────────────

describe('checkBudget', () => {
  it('returns ok=true when within budget', () => {
    const result = checkBudget('renderTimes', 100);
    assert.equal(result.ok, true);
    assert.equal(result.budget, PAGE_RENDER_BUDGET_MS);
    assert.equal(result.actual, 100);
    assert.equal(result.overBy, 0);
  });

  it('returns ok=false when exceeding budget', () => {
    const result = checkBudget('renderTimes', PAGE_RENDER_BUDGET_MS + 100);
    assert.equal(result.ok, false);
    assert.equal(result.overBy, 100);
  });

  it('returns ok=true at exact budget', () => {
    const result = checkBudget('renderTimes', PAGE_RENDER_BUDGET_MS);
    assert.equal(result.ok, true);
    assert.equal(result.overBy, 0);
  });

  it('checks ocrTimes budget', () => {
    const result = checkBudget('ocrTimes', OCR_PAGE_BUDGET_MS + 500);
    assert.equal(result.ok, false);
    assert.equal(result.budget, OCR_PAGE_BUDGET_MS);
  });

  it('checks searchTimes budget', () => {
    const result = checkBudget('searchTimes', 100);
    assert.equal(result.ok, true);
    assert.equal(result.budget, SEARCH_BUDGET_MS);
  });

  it('checks pageLoadTimes budget', () => {
    const result = checkBudget('pageLoadTimes', FILE_OPEN_BUDGET_MS + 200);
    assert.equal(result.ok, false);
  });

  it('returns ok=true for unknown metric', () => {
    const result = checkBudget('unknownMetric', 99999);
    assert.equal(result.ok, true);
    assert.equal(result.budget, 0);
    assert.equal(result.overBy, 0);
  });
});

// ─── reportBudgetViolation ──────────────────────────────────────────────────

describe('reportBudgetViolation', () => {
  it('does not throw when within budget', () => {
    assert.doesNotThrow(() => reportBudgetViolation('renderTimes', 50));
  });

  it('does not throw when exceeding budget', () => {
    assert.doesNotThrow(() => reportBudgetViolation('renderTimes', PAGE_RENDER_BUDGET_MS + 500));
  });

  it('does not throw for unknown metric', () => {
    assert.doesNotThrow(() => reportBudgetViolation('nonExistent', 99999));
  });
});
