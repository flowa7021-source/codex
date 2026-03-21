// ─── Tooltip System ─────────────────────────────────────────────────────────
// Visual tooltips with shortcut hints, replacing browser-default title tooltips.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

const SHOW_DELAY = 500;
const HIDE_DELAY = 100;
const TOOLTIP_OFFSET = 8;

let tooltipEl = null;
let showTimer = null;
let hideTimer = null;
let currentTarget = null;

function ensureTooltipEl() {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'nr-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function positionTooltip(target) {
  const el = ensureTooltipEl();
  const rect = target.getBoundingClientRect();
  const tipRect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Default: below the element, centered
  let top = rect.bottom + TOOLTIP_OFFSET;
  let left = rect.left + (rect.width - tipRect.width) / 2;

  // Flip above if too close to bottom
  if (top + tipRect.height > vh - 8) {
    top = rect.top - tipRect.height - TOOLTIP_OFFSET;
    el.classList.add('nr-tooltip-above');
    el.classList.remove('nr-tooltip-below');
  } else {
    el.classList.add('nr-tooltip-below');
    el.classList.remove('nr-tooltip-above');
  }

  // Clamp horizontally
  if (left < 8) left = 8;
  if (left + tipRect.width > vw - 8) left = vw - tipRect.width - 8;

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function showTooltip(target) {
  const text = target.getAttribute('data-tooltip') || target.getAttribute('title');
  if (!text) return;
  const shortcut = target.getAttribute('data-shortcut');

  // Suppress native title tooltip
  if (target.hasAttribute('title')) {
    target.setAttribute('data-tooltip', target.getAttribute('title'));
    target.removeAttribute('title');
  }

  const el = ensureTooltipEl();
  el.innerHTML = shortcut
    ? `<span class="nr-tooltip-text">${escapeHtml(text)}</span><kbd class="nr-tooltip-kbd">${escapeHtml(shortcut)}</kbd>`
    : `<span class="nr-tooltip-text">${escapeHtml(text)}</span>`;

  el.classList.add('nr-tooltip-visible');
  el.setAttribute('aria-hidden', 'false');
  currentTarget = target;

  // Position after content is set
  requestAnimationFrame(() => positionTooltip(target));
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.classList.remove('nr-tooltip-visible');
  tooltipEl.setAttribute('aria-hidden', 'true');
  currentTarget = null;
}

function onPointerEnter(e) {
  // e.target may be a text node or SVG element — guard against missing .closest()
  const el = e.target instanceof Element ? e.target : e.target?.parentElement;
  if (!el || typeof el.closest !== 'function') return;
  const target = el.closest('[data-tooltip], [title]');
  if (!target) return;
  clearSafeTimeout(hideTimer);
  clearSafeTimeout(showTimer);
  showTimer = safeTimeout(() => showTooltip(target), SHOW_DELAY);
}

function onPointerLeave(e) {
  const el = e.target instanceof Element ? e.target : e.target?.parentElement;
  if (!el || typeof el.closest !== 'function') return;
  const target = el.closest('[data-tooltip], [title]');
  if (!target) return;
  clearSafeTimeout(showTimer);
  hideTimer = safeTimeout(hideTooltip, HIDE_DELAY);
}

function onScroll() {
  if (currentTarget) {
    clearSafeTimeout(showTimer);
    hideTooltip();
  }
}

/**
 * Initialize the tooltip system. Call once on app startup.
 * Automatically handles all elements with `title` or `data-tooltip` attributes.
 */
export function initTooltips() {
  document.addEventListener('pointerenter', onPointerEnter, true);
  document.addEventListener('pointerleave', onPointerLeave, true);
  document.addEventListener('pointerdown', () => { clearSafeTimeout(showTimer); hideTooltip(); }, true);
  document.addEventListener('scroll', onScroll, true);
  document.addEventListener('keydown', () => { clearSafeTimeout(showTimer); hideTooltip(); }, true);

  // Convert existing title attributes on interactive elements
  document.querySelectorAll('[title]').forEach(el => {
    if (!el.getAttribute('data-tooltip')) {
      el.setAttribute('data-tooltip', el.getAttribute('title'));
      el.removeAttribute('title');
    }
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
