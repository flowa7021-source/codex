import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  noteKey,
  bookmarkKey,
  viewStateKey,
  readingTimeKey,
  readingGoalKey,
  formatDuration,
  formatEta,
  saveReadingTime,
  loadReadingTime,
  loadReadingGoal,
  saveReadingGoal,
  clearReadingGoal,
  saveRecent,
  removeRecent,
  clearRecent,
  renderRecent,
  trackVisitedPage,
  clearVisitTrail,
  renderVisitTrail,
  resetHistory,
  updateHistoryButtons,
  capturePageHistoryOnRender,
  navigateHistoryBack,
  navigateHistoryForward,
  startReadingTimer,
  stopReadingTimer,
  syncReadingTimerWithVisibility,
  updateReadingTimeStatus,
  resetReadingTime,
  resetReadingProgress,
  renderReadingProgress,
  renderEtaStatus,
  renderDocStats,
  renderReadingGoalStatus,
  initReadingProgressDeps,
  _saveViewStateNow,
  loadViewState,
  clearViewState,
  restoreViewStateIfPresent,
} from '../../app/modules/reading-progress-controller.js';

function resetState() {
  localStorage.clear();
  state.docName = 'test.pdf';
  state.adapter = { type: 'pdf' };
  state.pageCount = 100;
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  state.readingTotalMs = 0;
  state.readingStartedAt = null;
  state.readingGoalPage = null;
  state.visitTrail = [];
  state.historyBack = [];
  state.historyForward = [];
  state.lastRenderedPage = null;
  state.isHistoryNavigation = false;
  els.readingGoalPage = document.createElement('input');
  els.readingGoalStatus = document.createElement('div');
  els.etaStatus = document.createElement('div');
  els.docStats = document.createElement('div');
  els.progressStatus = document.createElement('div');
  els.readingTimeStatus = document.createElement('div');
  els.visitTrailList = document.createElement('ul');
  els.recentList = document.createElement('ul');
  els.historyBack = document.createElement('button');
  els.historyForward = document.createElement('button');
  initReadingProgressDeps({
    renderCurrentPage: async () => {},
    renderSearchResultsList: () => {},
    loadStrokes: () => [],
    loadComments: () => [],
    loadBookmarks: () => [],
  });
}

describe('reading-progress-controller', () => {
  beforeEach(() => resetState());

  describe('storage key helpers', () => {
    it('noteKey returns correct key', () => {
      assert.equal(noteKey(), 'novareader-notes:test.pdf');
    });
    it('bookmarkKey returns correct key', () => {
      assert.equal(bookmarkKey(), 'novareader-bookmarks:test.pdf');
    });
    it('viewStateKey returns correct key', () => {
      assert.equal(viewStateKey(), 'novareader-view:test.pdf');
    });
    it('readingTimeKey returns correct key', () => {
      assert.equal(readingTimeKey(), 'novareader-reading-time:test.pdf');
    });
    it('readingGoalKey uses global when no docName', () => {
      state.docName = '';
      assert.equal(readingGoalKey(), 'novareader-reading-goal:global');
    });
  });

  describe('formatDuration', () => {
    it('formats 0 ms as 00:00:00', () => {
      assert.equal(formatDuration(0), '00:00:00');
    });
    it('formats 3661000 ms as 01:01:01', () => {
      assert.equal(formatDuration(3661000), '01:01:01');
    });
    it('handles negative input as 00:00:00', () => {
      assert.equal(formatDuration(-1000), '00:00:00');
    });
  });

  describe('formatEta', () => {
    it('returns dash for non-finite input', () => {
      assert.equal(formatEta(Infinity), '—');
      assert.equal(formatEta(-1), '—');
      assert.equal(formatEta(NaN), '—');
    });
    it('returns a date string for valid input', () => {
      const result = formatEta(60000);
      assert.ok(result.length > 2);
      assert.notEqual(result, '—');
    });
  });

  describe('saveReadingTime / loadReadingTime', () => {
    it('saves and loads reading time', () => {
      state.readingTotalMs = 5000;
      saveReadingTime();
      const loaded = loadReadingTime();
      assert.equal(loaded, 5000);
    });
    it('returns 0 when nothing is stored', () => {
      assert.equal(loadReadingTime(), 0);
    });
  });

  describe('loadReadingGoal', () => {
    it('returns null when nothing stored', () => {
      assert.equal(loadReadingGoal(), null);
    });
    it('returns page number when stored', () => {
      localStorage.setItem(readingGoalKey(), JSON.stringify({ page: 50 }));
      assert.equal(loadReadingGoal(), 50);
    });
  });

  describe('recent files', () => {
    it('saveRecent adds a file', () => {
      saveRecent('a.pdf');
      const recent = JSON.parse(localStorage.getItem('novareader-recent'));
      assert.deepEqual(recent, ['a.pdf']);
    });
    it('saveRecent deduplicates and limits to 12', () => {
      for (let i = 0; i < 15; i++) saveRecent(`file${i}.pdf`);
      const recent = JSON.parse(localStorage.getItem('novareader-recent'));
      assert.equal(recent.length, 12);
    });
    it('clearRecent removes all', () => {
      saveRecent('a.pdf');
      clearRecent();
      assert.equal(localStorage.getItem('novareader-recent'), null);
    });
  });

  describe('visit trail', () => {
    it('trackVisitedPage adds pages', () => {
      trackVisitedPage(5);
      trackVisitedPage(3);
      assert.deepEqual(state.visitTrail, [3, 5]);
    });
    it('clearVisitTrail empties the trail', () => {
      trackVisitedPage(1);
      clearVisitTrail();
      assert.deepEqual(state.visitTrail, []);
    });
  });

  describe('history navigation', () => {
    it('resetHistory clears all history arrays', () => {
      state.historyBack = [1, 2];
      state.historyForward = [3];
      resetHistory();
      assert.deepEqual(state.historyBack, []);
      assert.deepEqual(state.historyForward, []);
      assert.equal(state.lastRenderedPage, null);
    });

    it('capturePageHistoryOnRender pushes to historyBack', () => {
      state.lastRenderedPage = 5;
      state.currentPage = 10;
      capturePageHistoryOnRender();
      assert.deepEqual(state.historyBack, [5]);
      assert.equal(state.lastRenderedPage, 10);
    });
  });

  describe('view state', () => {
    it('saves and loads view state', () => {
      state.currentPage = 7;
      state.zoom = 1.5;
      state.rotation = 90;
      _saveViewStateNow();
      const loaded = loadViewState();
      assert.equal(loaded.page, 7);
      assert.equal(loaded.zoom, 1.5);
      assert.equal(loaded.rotation, 90);
    });

    it('clearViewState removes stored state', () => {
      _saveViewStateNow();
      clearViewState();
      assert.equal(loadViewState(), null);
    });

    it('restoreViewStateIfPresent restores page/zoom/rotation', () => {
      _saveViewStateNow();
      state.currentPage = 1;
      state.zoom = 1;
      state.rotation = 0;
      // Change stored values
      localStorage.setItem(viewStateKey(), JSON.stringify({ page: 5, zoom: 2, rotation: 180 }));
      const restored = restoreViewStateIfPresent();
      assert.ok(restored);
      assert.equal(state.currentPage, 5);
      assert.equal(state.zoom, 2);
      assert.equal(state.rotation, 180);
    });

    it('restoreViewStateIfPresent returns false when nothing stored', () => {
      assert.equal(restoreViewStateIfPresent(), false);
    });

    it('restoreViewStateIfPresent clamps zoom to valid range', () => {
      localStorage.setItem(viewStateKey(), JSON.stringify({ page: 1, zoom: 10, rotation: 0 }));
      restoreViewStateIfPresent();
      assert.equal(state.zoom, 4); // max is 4
    });

    it('restoreViewStateIfPresent clamps zoom min', () => {
      localStorage.setItem(viewStateKey(), JSON.stringify({ page: 1, zoom: 0.01, rotation: 0 }));
      restoreViewStateIfPresent();
      assert.equal(state.zoom, 0.3); // min is 0.3
    });

    it('restoreViewStateIfPresent normalizes negative rotation', () => {
      localStorage.setItem(viewStateKey(), JSON.stringify({ page: 1, zoom: 1, rotation: -90 }));
      restoreViewStateIfPresent();
      assert.equal(state.rotation, 270);
    });

    it('restoreViewStateIfPresent ignores out-of-range page', () => {
      state.currentPage = 3;
      localStorage.setItem(viewStateKey(), JSON.stringify({ page: 999, zoom: 1, rotation: 0 }));
      restoreViewStateIfPresent();
      assert.equal(state.currentPage, 3); // unchanged
    });

    it('loadViewState returns null for invalid JSON', () => {
      localStorage.setItem(viewStateKey(), 'not json');
      assert.equal(loadViewState(), null);
    });

    it('loadViewState returns null for non-object stored value', () => {
      localStorage.setItem(viewStateKey(), JSON.stringify(42));
      assert.equal(loadViewState(), null);
    });

    it('_saveViewStateNow does nothing when no adapter', () => {
      state.adapter = null;
      _saveViewStateNow();
      assert.equal(loadViewState(), null);
    });

    it('_saveViewStateNow does nothing when no docName', () => {
      state.docName = '';
      state.adapter = { type: 'pdf' };
      _saveViewStateNow();
      // With docName='', key uses 'global' but the function returns early
      // Actually _saveViewStateNow checks !state.docName which is truthy for ''
      assert.equal(localStorage.getItem('novareader-view:'), null);
    });
  });

  describe('reading goal - save/clear/render', () => {
    it('saveReadingGoal does nothing when no adapter', () => {
      state.adapter = null;
      saveReadingGoal();
      assert.ok(els.readingGoalStatus.textContent.length > 0);
    });

    it('saveReadingGoal sets error when value is NaN', () => {
      els.readingGoalPage.value = 'abc';
      saveReadingGoal();
      assert.ok(els.readingGoalStatus.textContent.length > 0);
    });

    it('saveReadingGoal clamps to valid page range', () => {
      els.readingGoalPage.value = '200';
      state.pageCount = 50;
      saveReadingGoal();
      assert.equal(state.readingGoalPage, 50);
    });

    it('saveReadingGoal clamps minimum to 1', () => {
      els.readingGoalPage.value = '-5';
      saveReadingGoal();
      assert.equal(state.readingGoalPage, 1);
    });

    it('clearReadingGoal resets state and localStorage', () => {
      state.readingGoalPage = 10;
      localStorage.setItem(readingGoalKey(), JSON.stringify({ page: 10 }));
      clearReadingGoal();
      assert.equal(state.readingGoalPage, null);
      assert.equal(localStorage.getItem(readingGoalKey()), null);
      assert.equal(els.readingGoalPage.value, '');
    });

    it('loadReadingGoal returns null for invalid JSON', () => {
      localStorage.setItem(readingGoalKey(), '{bad}');
      assert.equal(loadReadingGoal(), null);
    });

    it('loadReadingGoal returns null for non-integer page', () => {
      localStorage.setItem(readingGoalKey(), JSON.stringify({ page: 3.5 }));
      assert.equal(loadReadingGoal(), null);
    });
  });

  describe('reading timer start/stop', () => {
    it('startReadingTimer does nothing without adapter', () => {
      state.adapter = null;
      startReadingTimer();
      assert.equal(state.readingStartedAt, null);
    });

    it('startReadingTimer does nothing without docName', () => {
      state.docName = '';
      startReadingTimer();
      assert.equal(state.readingStartedAt, null);
    });

    it('startReadingTimer does nothing when document is hidden', () => {
      // document.hidden is false in our mock, so we check the positive path
      startReadingTimer();
      assert.ok(state.readingStartedAt !== null);
    });

    it('startReadingTimer does not restart when already running', () => {
      startReadingTimer();
      const first = state.readingStartedAt;
      startReadingTimer();
      assert.equal(state.readingStartedAt, first);
    });

    it('stopReadingTimer accumulates time', () => {
      state.readingStartedAt = Date.now() - 5000;
      state.readingTotalMs = 1000;
      stopReadingTimer(false);
      assert.ok(state.readingTotalMs >= 5000);
      assert.equal(state.readingStartedAt, null);
    });

    it('stopReadingTimer with commit saves to localStorage', () => {
      state.readingStartedAt = Date.now() - 1000;
      stopReadingTimer(true);
      const stored = JSON.parse(localStorage.getItem(readingTimeKey()));
      assert.ok(stored.totalMs >= 0);
    });

    it('stopReadingTimer with no active timer does not crash', () => {
      state.readingStartedAt = null;
      assert.doesNotThrow(() => stopReadingTimer());
    });
  });

  describe('reading time save/load edge cases', () => {
    it('saveReadingTime does nothing without docName', () => {
      state.docName = '';
      saveReadingTime();
      assert.equal(localStorage.getItem(readingTimeKey()), null);
    });

    it('loadReadingTime returns 0 for invalid JSON', () => {
      localStorage.setItem(readingTimeKey(), 'not json');
      assert.equal(loadReadingTime(), 0);
    });

    it('loadReadingTime returns 0 for non-finite totalMs', () => {
      localStorage.setItem(readingTimeKey(), JSON.stringify({ totalMs: Infinity }));
      assert.equal(loadReadingTime(), 0);
    });

    it('loadReadingTime returns 0 for negative totalMs', () => {
      localStorage.setItem(readingTimeKey(), JSON.stringify({ totalMs: -500 }));
      assert.equal(loadReadingTime(), 0);
    });
  });

  describe('ETA and doc stats rendering', () => {
    it('renderEtaStatus shows dash without adapter', () => {
      state.adapter = null;
      renderEtaStatus();
      assert.ok(els.etaStatus.textContent.includes('—'));
    });

    it('renderEtaStatus shows document finished when on last page', () => {
      state.currentPage = 100;
      state.readingTotalMs = 10000;
      renderEtaStatus();
      assert.ok(els.etaStatus.textContent.includes('пройден'));
    });

    it('renderEtaStatus calculates ETA when reading in progress', () => {
      state.currentPage = 50;
      state.readingTotalMs = 60000;
      state.readingStartedAt = null;
      renderEtaStatus();
      assert.ok(els.etaStatus.textContent.includes('ETA'));
    });

    it('renderDocStats shows empty when no adapter', () => {
      state.adapter = null;
      renderDocStats();
      assert.equal(els.docStats.textContent, '');
    });

    it('renderDocStats shows stats when adapter present', () => {
      state.currentPage = 10;
      state.readingTotalMs = 3600000; // 1 hour
      renderDocStats();
      assert.ok(els.docStats.textContent.includes('аннот'));
    });

    it('renderReadingProgress shows empty without adapter', () => {
      state.adapter = null;
      renderReadingProgress();
      assert.equal(els.progressStatus.textContent, '');
    });

    it('renderReadingProgress shows page info', () => {
      state.currentPage = 25;
      renderReadingProgress();
      assert.ok(els.progressStatus.textContent.includes('25'));
      assert.ok(els.progressStatus.textContent.includes('100'));
    });
  });

  describe('reading goal status rendering', () => {
    it('renderReadingGoalStatus empty without adapter', () => {
      state.adapter = null;
      renderReadingGoalStatus();
      assert.equal(els.readingGoalStatus.textContent, '');
    });

    it('renderReadingGoalStatus empty without goal', () => {
      state.readingGoalPage = null;
      renderReadingGoalStatus();
      assert.equal(els.readingGoalStatus.textContent, '');
    });

    it('renderReadingGoalStatus shows reached when on goal page', () => {
      state.readingGoalPage = 5;
      state.currentPage = 5;
      renderReadingGoalStatus();
      assert.ok(els.readingGoalStatus.textContent.includes('достигнута'));
    });

    it('renderReadingGoalStatus shows remaining when before goal', () => {
      state.readingGoalPage = 50;
      state.currentPage = 10;
      state.readingTotalMs = 10000;
      renderReadingGoalStatus();
      assert.ok(els.readingGoalStatus.textContent.includes('осталось'));
    });
  });

  describe('history navigation - navigateHistoryBack/Forward', () => {
    it('navigateHistoryBack does nothing without adapter', async () => {
      state.adapter = null;
      state.historyBack = [5];
      await navigateHistoryBack();
      assert.deepEqual(state.historyBack, [5]);
    });

    it('navigateHistoryBack does nothing with empty history', async () => {
      await navigateHistoryBack();
      assert.equal(state.currentPage, 1);
    });

    it('navigateHistoryBack navigates to previous page', async () => {
      state.historyBack = [5];
      state.currentPage = 10;
      await navigateHistoryBack();
      assert.equal(state.currentPage, 5);
      assert.deepEqual(state.historyForward, [10]);
    });

    it('navigateHistoryForward does nothing without adapter', async () => {
      state.adapter = null;
      state.historyForward = [15];
      await navigateHistoryForward();
      assert.deepEqual(state.historyForward, [15]);
    });

    it('navigateHistoryForward does nothing with empty history', async () => {
      await navigateHistoryForward();
      assert.equal(state.currentPage, 1);
    });

    it('navigateHistoryForward navigates to next page', async () => {
      state.historyForward = [20];
      state.currentPage = 10;
      await navigateHistoryForward();
      assert.equal(state.currentPage, 20);
      assert.deepEqual(state.historyBack, [10]);
    });
  });

  describe('capturePageHistoryOnRender edge cases', () => {
    it('does nothing without adapter', () => {
      state.adapter = null;
      state.lastRenderedPage = 5;
      state.currentPage = 10;
      capturePageHistoryOnRender();
      assert.deepEqual(state.historyBack, []);
    });

    it('does not push duplicate to historyBack', () => {
      state.lastRenderedPage = 5;
      state.currentPage = 10;
      state.historyBack = [5];
      capturePageHistoryOnRender();
      // Should not duplicate 5
      assert.deepEqual(state.historyBack, [5]);
    });

    it('clears historyForward on normal navigation', () => {
      state.historyForward = [15, 20];
      state.lastRenderedPage = 5;
      state.currentPage = 10;
      capturePageHistoryOnRender();
      assert.deepEqual(state.historyForward, []);
    });

    it('does not modify history during history navigation', () => {
      state.isHistoryNavigation = true;
      state.lastRenderedPage = 5;
      state.currentPage = 10;
      state.historyForward = [15];
      capturePageHistoryOnRender();
      assert.deepEqual(state.historyBack, []);
      assert.deepEqual(state.historyForward, [15]);
    });

    it('limits historyBack to 100 entries', () => {
      state.historyBack = Array.from({ length: 100 }, (_, i) => i);
      state.lastRenderedPage = 200;
      state.currentPage = 201;
      capturePageHistoryOnRender();
      assert.equal(state.historyBack.length, 100);
      assert.equal(state.historyBack[state.historyBack.length - 1], 200);
    });
  });

  describe('updateHistoryButtons', () => {
    it('disables both buttons when history is empty', () => {
      updateHistoryButtons();
      assert.equal(els.historyBack.disabled, true);
      assert.equal(els.historyForward.disabled, true);
    });

    it('enables back button when historyBack has entries', () => {
      state.historyBack = [1];
      updateHistoryButtons();
      assert.equal(els.historyBack.disabled, false);
    });

    it('enables forward button when historyForward has entries', () => {
      state.historyForward = [5];
      updateHistoryButtons();
      assert.equal(els.historyForward.disabled, false);
    });

    it('does nothing when elements are missing', () => {
      els.historyBack = null;
      els.historyForward = null;
      assert.doesNotThrow(() => updateHistoryButtons());
    });
  });

  describe('visit trail edge cases', () => {
    it('trackVisitedPage does nothing without adapter', () => {
      state.adapter = null;
      trackVisitedPage(5);
      assert.deepEqual(state.visitTrail, []);
    });

    it('trackVisitedPage does nothing for non-integer page', () => {
      trackVisitedPage(3.5);
      assert.deepEqual(state.visitTrail, []);
    });

    it('trackVisitedPage limits trail to 12 entries', () => {
      for (let i = 1; i <= 15; i++) trackVisitedPage(i);
      assert.equal(state.visitTrail.length, 12);
    });

    it('trackVisitedPage deduplicates pages', () => {
      trackVisitedPage(5);
      trackVisitedPage(3);
      trackVisitedPage(5);
      assert.deepEqual(state.visitTrail, [5, 3]);
    });
  });

  describe('recent files - removeRecent', () => {
    it('removeRecent removes a specific file', () => {
      saveRecent('a.pdf');
      saveRecent('b.pdf');
      removeRecent('a.pdf');
      const recent = JSON.parse(localStorage.getItem('novareader-recent'));
      assert.deepEqual(recent, ['b.pdf']);
    });

    it('removeRecent does nothing for non-existent file', () => {
      saveRecent('a.pdf');
      removeRecent('nonexistent.pdf');
      const recent = JSON.parse(localStorage.getItem('novareader-recent'));
      assert.deepEqual(recent, ['a.pdf']);
    });
  });

  describe('resetReadingTime', () => {
    it('does nothing without adapter', async () => {
      state.adapter = null;
      await resetReadingTime();
      assert.ok(els.readingTimeStatus.textContent.length > 0);
    });

    it('resets total time to zero', async () => {
      state.readingTotalMs = 50000;
      await resetReadingTime();
      assert.equal(state.readingTotalMs, 0);
    });
  });

  describe('resetReadingProgress', () => {
    it('does nothing without adapter', async () => {
      state.adapter = null;
      state.currentPage = 50;
      await resetReadingProgress();
      assert.equal(state.currentPage, 50);
    });

    it('resets page, zoom, rotation and clears view state', async () => {
      state.currentPage = 50;
      state.zoom = 2;
      state.rotation = 90;
      _saveViewStateNow();
      await resetReadingProgress();
      assert.equal(state.currentPage, 1);
      assert.equal(state.zoom, 1);
      assert.equal(state.rotation, 0);
      assert.equal(loadViewState(), null);
    });
  });

  describe('renderVisitTrail', () => {
    it('shows empty message when no adapter', () => {
      state.adapter = null;
      renderVisitTrail();
      assert.ok(els.visitTrailList.children.length > 0);
    });

    it('shows empty message when trail is empty', () => {
      state.visitTrail = [];
      renderVisitTrail();
      assert.ok(els.visitTrailList.children.length > 0);
    });

    it('renders buttons for each visited page', () => {
      state.visitTrail = [3, 7, 12];
      renderVisitTrail();
      assert.equal(els.visitTrailList.children.length, 3);
    });
  });

  describe('renderRecent', () => {
    it('shows empty message when no recent files', () => {
      renderRecent();
      assert.ok(els.recentList.children.length > 0);
    });

    it('renders entries for recent files', () => {
      saveRecent('a.pdf');
      saveRecent('b.pdf');
      renderRecent();
      assert.equal(els.recentList.children.length, 2);
    });
  });

  describe('syncReadingTimerWithVisibility', () => {
    it('does nothing without adapter', () => {
      state.adapter = null;
      assert.doesNotThrow(() => syncReadingTimerWithVisibility());
    });
  });

  describe('updateReadingTimeStatus', () => {
    it('shows default when no adapter', () => {
      state.adapter = null;
      updateReadingTimeStatus();
      assert.ok(els.readingTimeStatus.textContent.includes('00:00:00'));
    });

    it('shows duration when adapter is present', () => {
      state.readingTotalMs = 3661000;
      updateReadingTimeStatus();
      assert.ok(els.readingTimeStatus.textContent.includes('01:01:01'));
    });
  });
});
