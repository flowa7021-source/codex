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
  saveRecent,
  removeRecent,
  clearRecent,
  trackVisitedPage,
  clearVisitTrail,
  resetHistory,
  updateHistoryButtons,
  capturePageHistoryOnRender,
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
  });
});
