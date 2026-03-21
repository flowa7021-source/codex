// ─── Performance Budgets ─────────────────────────────────────────────────────
// Defines performance budget constants and helpers for checking/reporting
// budget violations through the diagnostics system.

import { novaLog } from './diagnostics.js';

// ─── Budget Constants (milliseconds) ────────────────────────────────────────
export const PAGE_RENDER_BUDGET_MS = 200;
export const OCR_PAGE_BUDGET_MS = 3000;
export const FILE_OPEN_BUDGET_MS = 1000; // for files < 50 MB
export const SEARCH_BUDGET_MS = 500;

/** @type {Record<string, number>} */
const BUDGET_MAP = {
  renderTimes: PAGE_RENDER_BUDGET_MS,
  ocrTimes: OCR_PAGE_BUDGET_MS,
  pageLoadTimes: FILE_OPEN_BUDGET_MS,
  searchTimes: SEARCH_BUDGET_MS,
};

/**
 * Check whether a measured value is within its performance budget.
 * @param {string} metric - One of 'renderTimes', 'ocrTimes', 'pageLoadTimes', 'searchTimes'
 * @param {number} valueMs - Measured duration in milliseconds
 * @returns {{ ok: boolean, budget: number, actual: number, overBy: number }}
 */
export function checkBudget(metric, valueMs) {
  const budget = BUDGET_MAP[metric];
  if (budget === undefined) {
    return { ok: true, budget: 0, actual: valueMs, overBy: 0 };
  }
  const overBy = Math.max(0, valueMs - budget);
  return {
    ok: valueMs <= budget,
    budget,
    actual: valueMs,
    overBy,
  };
}

/**
 * Log a budget violation to the diagnostics system if the measured value
 * exceeds the budget for the given metric.
 * @param {string} metric - One of 'renderTimes', 'ocrTimes', 'pageLoadTimes', 'searchTimes'
 * @param {number} valueMs - Measured duration in milliseconds
 */
export function reportBudgetViolation(metric, valueMs) {
  const result = checkBudget(metric, valueMs);
  if (!result.ok) {
    novaLog('perf', `Budget exceeded: ${metric}`, {
      metric,
      budget: result.budget,
      actual: result.actual,
      overBy: result.overBy,
    }, 'warn');
  }
}
