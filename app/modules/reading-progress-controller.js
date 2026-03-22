// @ts-check
// ─── Reading Progress Controller ────────────────────────────────────────────
// Reading progress, reading goal, reading time, visit trail, history navigation,
// view state, recent files, ETA/doc stats, and storage key helpers.
// Extracted from app.js as part of module decomposition.

import { state, els } from './state.js';
import { debounce } from './utils.js';
import { safeInterval, clearSafeInterval } from './safe-timers.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  renderCurrentPage: async () => {},
  renderSearchResultsList: () => {},
  loadStrokes: () => [],
  loadComments: () => [],
  loadBookmarks: () => [],
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any reading-progress functions are used.
 */
export function initReadingProgressDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Storage Key Helpers ────────────────────────────────────────────────────

export function noteKey() {
  return `novareader-notes:${state.docName || 'global'}`;
}

export function bookmarkKey() {
  return `novareader-bookmarks:${state.docName || 'global'}`;
}

export function viewStateKey() {
  return `novareader-view:${state.docName || 'global'}`;
}

export function readingTimeKey() {
  return `novareader-reading-time:${state.docName || 'global'}`;
}

export function readingGoalKey() {
  return `novareader-reading-goal:${state.docName || 'global'}`;
}

// ─── Reading Goal ───────────────────────────────────────────────────────────

export function loadReadingGoal() {
  try {
    const raw = localStorage.getItem(readingGoalKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isInteger(parsed?.page)) return null;
    return parsed.page;
  } catch (err) {
    console.warn('[reading-progress-controller storage] error:', err?.message);
    return null;
  }
}

export function saveReadingGoal() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = 'Сначала откройте документ';
    return;
  }
  const raw = Number.parseInt(/** @type {any} */ (els.readingGoalPage).value, 10);
  if (Number.isNaN(raw)) {
    els.readingGoalStatus.textContent = 'Введите корректный номер страницы';
    return;
  }
  const goal = Math.max(1, Math.min(state.pageCount, raw));
  state.readingGoalPage = goal;
  localStorage.setItem(readingGoalKey(), JSON.stringify({ page: goal }));
  renderReadingGoalStatus();
}

export function clearReadingGoal() {
  state.readingGoalPage = null;
  localStorage.removeItem(readingGoalKey());
  /** @type {any} */ (els.readingGoalPage).value = '';
  renderReadingGoalStatus();
}

export function renderReadingGoalStatus() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = '';
    return;
  }

  const goal = state.readingGoalPage;
  if (!goal) {
    els.readingGoalStatus.textContent = '';
    return;
  }

  /** @type {any} */ (els.readingGoalPage).value = String(goal);
  const remaining = goal - state.currentPage;
  if (remaining <= 0) {
    els.readingGoalStatus.textContent = `Цель достигнута (стр. ${goal})`;
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const goalEta = Number.isFinite(msPerPage) && msPerPage > 0 ? formatEta(msPerPage * remaining) : '—';
  els.readingGoalStatus.textContent = `До цели стр. ${goal}: осталось ${remaining} стр., ETA ${goalEta}`;
}

// ─── ETA & Doc Stats ────────────────────────────────────────────────────────

export function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(Date.now() + ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function renderEtaStatus() {
  if (!state.adapter || !state.pageCount) {
    els.etaStatus.textContent = 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const remainingPages = Math.max(0, state.pageCount - state.currentPage);

  if (!Number.isFinite(msPerPage) || msPerPage <= 0 || remainingPages === 0) {
    els.etaStatus.textContent = remainingPages === 0 ? 'ETA завершения: документ пройден' : 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const etaMs = msPerPage * remainingPages;
  els.etaStatus.textContent = `ETA завершения: ${formatEta(etaMs)}`;
  renderReadingGoalStatus();
}

export function renderDocStats() {
  if (!state.adapter || !state.pageCount) {
    els.docStats.textContent = '';
    return;
  }

  let totalStrokes = 0;
  let totalComments = 0;
  for (let page = 1; page <= state.pageCount; page += 1) {
    totalStrokes += /** @type {any} */ (_deps).loadStrokes(page).length;
    totalComments += /** @type {any} */ (_deps).loadComments(page).length;
  }

  const bookmarks = _deps.loadBookmarks().length;
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalHours = (state.readingTotalMs + activeMs) / 3600000;
  const pace = totalHours > 0.01 ? `${(state.currentPage / totalHours).toFixed(1)} стр/ч` : '—';

  els.docStats.textContent = `${totalStrokes} аннот. · ${totalComments} комм. · ${bookmarks} закл. · ${pace}`;
}

// ─── Visit Trail & History ──────────────────────────────────────────────────

export function renderVisitTrail() {
  els.visitTrailList.innerHTML = '';

  if (!state.adapter || !state.visitTrail.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История переходов пуста';
    els.visitTrailList.appendChild(li);
    return;
  }

  state.visitTrail.forEach((page) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const btn = document.createElement('button');
    btn.textContent = `Стр. ${page}`;
    btn.addEventListener('click', async () => {
      if (!state.adapter) return;
      state.currentPage = page;
      await _deps.renderCurrentPage();
    });

    li.appendChild(btn);
    els.visitTrailList.appendChild(li);
  });
}

export function trackVisitedPage(page) {
  if (!state.adapter || !Number.isInteger(page)) return;
  state.visitTrail = [page, ...state.visitTrail.filter((x) => x !== page)].slice(0, 12);
  renderVisitTrail();
}

export function clearVisitTrail() {
  state.visitTrail = [];
  renderVisitTrail();
}

export function updateHistoryButtons() {
  if (!els.historyBack || !els.historyForward) return;
  /** @type {any} */ (els.historyBack).disabled = state.historyBack.length === 0;
  /** @type {any} */ (els.historyForward).disabled = state.historyForward.length === 0;
}

export function resetHistory() {
  state.historyBack = [];
  state.historyForward = [];
  state.lastRenderedPage = null;
  updateHistoryButtons();
}

export function capturePageHistoryOnRender() {
  if (!state.adapter) return;
  const prev = state.lastRenderedPage;
  const curr = state.currentPage;
  if (typeof prev === 'number' && prev !== curr && !state.isHistoryNavigation) {
    const top = state.historyBack[state.historyBack.length - 1];
    if (top !== prev) {
      state.historyBack.push(prev);
      if (state.historyBack.length > 100) {
        state.historyBack.shift();
      }
    }
    state.historyForward = [];
  }
  state.lastRenderedPage = curr;
  updateHistoryButtons();
}

export async function navigateHistoryBack() {
  if (!state.adapter || !state.historyBack.length) return;
  const target = state.historyBack.pop();
  if (!Number.isInteger(target)) return;
  state.historyForward.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await _deps.renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}

export async function navigateHistoryForward() {
  if (!state.adapter || !state.historyForward.length) return;
  const target = state.historyForward.pop();
  if (!Number.isInteger(target)) return;
  state.historyBack.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await _deps.renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}

// ─── Reading Time ───────────────────────────────────────────────────────────

let readingTimerId = null;

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function saveReadingTime() {
  if (!state.docName) return;
  localStorage.setItem(readingTimeKey(), JSON.stringify({ totalMs: Math.max(0, Math.floor(state.readingTotalMs)) }));
}

export function loadReadingTime() {
  try {
    const raw = localStorage.getItem(readingTimeKey());
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.totalMs) ? Math.max(0, parsed.totalMs) : 0;
  } catch (err) {
    console.warn('[reading-progress-controller storage] error:', err?.message);
    return 0;
  }
}

export function updateReadingTimeStatus() {
  if (!state.adapter || !state.docName) {
    els.readingTimeStatus.textContent = 'Время чтения: 00:00:00';
    return;
  }
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  els.readingTimeStatus.textContent = formatDuration(state.readingTotalMs + activeMs);
  renderDocStats();
  renderEtaStatus();
}

export function stopReadingTimer(commit = true) {
  if (readingTimerId) {
    clearSafeInterval(readingTimerId);
    readingTimerId = null;
  }
  if (state.readingStartedAt) {
    state.readingTotalMs += Date.now() - state.readingStartedAt;
    state.readingStartedAt = null;
    if (commit) saveReadingTime();
  }
  updateReadingTimeStatus();
}

export function startReadingTimer() {
  if (!state.adapter || !state.docName) return;
  if (document.hidden) return;
  if (state.readingStartedAt) return;

  state.readingStartedAt = Date.now();
  if (!readingTimerId) {
    readingTimerId = safeInterval(updateReadingTimeStatus, 1000);
  }
  updateReadingTimeStatus();
}

export function syncReadingTimerWithVisibility() {
  if (!state.adapter) return;
  if (document.hidden) {
    stopReadingTimer(true);
  } else {
    startReadingTimer();
  }
}

export async function resetReadingTime() {
  if (!state.adapter) {
    els.readingTimeStatus.textContent = 'Сначала откройте документ';
    return;
  }
  stopReadingTimer(false);
  state.readingTotalMs = 0;
  saveReadingTime();
  updateReadingTimeStatus();
  renderEtaStatus();
  startReadingTimer();
}

// ─── View State ─────────────────────────────────────────────────────────────

export function _saveViewStateNow() {
  if (!state.adapter || !state.docName) return;
  const payload = {
    page: state.currentPage,
    zoom: Number(state.zoom.toFixed(3)),
    rotation: state.rotation,
    pageCount: state.pageCount,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(viewStateKey(), JSON.stringify(payload));
}
export const saveViewState = debounce(_saveViewStateNow, 2000);

export function loadViewState() {
  try {
    const raw = localStorage.getItem(viewStateKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn('[reading-progress-controller storage] error:', err?.message);
    return null;
  }
}

export function clearViewState() {
  localStorage.removeItem(viewStateKey());
}

export function renderReadingProgress() {
  if (!state.adapter || !state.pageCount) {
    els.progressStatus.textContent = '';
    return;
  }

  const percent = Math.round((state.currentPage / state.pageCount) * 100);
  els.progressStatus.textContent = `Страница ${state.currentPage} из ${state.pageCount} (${percent}%)`;
  renderEtaStatus();
}

export function restoreViewStateIfPresent() {
  const saved = loadViewState();
  if (!saved) return false;

  if (Number.isInteger(saved.page) && saved.page >= 1 && saved.page <= state.pageCount) {
    state.currentPage = saved.page;
  }
  if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) {
    state.zoom = Math.min(4, Math.max(0.3, saved.zoom));
  }
  if (typeof saved.rotation === 'number' && Number.isFinite(saved.rotation)) {
    state.rotation = ((saved.rotation % 360) + 360) % 360;
  }
  return true;
}

export async function resetReadingProgress() {
  if (!state.adapter) {
    els.progressStatus.textContent = 'Сначала откройте документ';
    return;
  }
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  clearViewState();
  await _deps.renderCurrentPage();
  _deps.renderSearchResultsList();
}

// ─── Recent Files ───────────────────────────────────────────────────────────

export function saveRecent(fileName) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = [fileName, ...recent.filter((x) => x !== fileName)].slice(0, 12);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
}

export function removeRecent(name) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = recent.filter((x) => x !== name);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
  renderRecent();
}

export function clearRecent() {
  localStorage.removeItem('novareader-recent');
  renderRecent();
}

export function renderRecent() {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  els.recentList.innerHTML = '';

  if (!recent.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Список пуст';
    els.recentList.appendChild(li);
    return;
  }

  recent.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const nameEl = document.createElement('div');
    nameEl.textContent = name;

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', () => removeRecent(name));

    actions.appendChild(removeBtn);
    li.appendChild(nameEl);
    li.appendChild(actions);
    els.recentList.appendChild(li);
  });
}
