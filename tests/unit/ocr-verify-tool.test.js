import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OcrVerifyTool } from '../../app/modules/ocr-verify-tool.js';

/** @returns {import('../../app/modules/ocr-verify-tool.js').OcrWord[]} */
function mockWords() {
  return [
    { text: 'Hello', confidence: 0.95, bbox: { x: 0, y: 0, width: 50, height: 12 }, pageNum: 1 },
    { text: 'wrold', confidence: 0.4, bbox: { x: 55, y: 0, width: 50, height: 12 }, pageNum: 1 },
    { text: 'this', confidence: 0.85, bbox: { x: 0, y: 20, width: 40, height: 12 }, pageNum: 1 },
    { text: 'iz', confidence: 0.3, bbox: { x: 45, y: 20, width: 20, height: 12 }, pageNum: 1 },
    { text: 'test', confidence: 0.9, bbox: { x: 70, y: 20, width: 40, height: 12 }, pageNum: 2 },
  ];
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('OcrVerifyTool constructor', () => {
  it('accepts words and options', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    assert.ok(tool);
    assert.equal(tool.allWords.length, 5);
  });

  it('filters review queue to low-confidence words by default', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    // 'wrold' (0.4) and 'iz' (0.3) are below 0.7
    assert.equal(tool.queueLength, 2);
  });

  it('includes all words when showAllWords is true', () => {
    const tool = new OcrVerifyTool(mockWords(), { showAllWords: true });
    assert.equal(tool.queueLength, 5);
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('OcrVerifyTool navigation', () => {
  it('next() advances through the review queue', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    const first = tool.next();
    assert.ok(first);
    assert.equal(first.text, 'wrold');
    const second = tool.next();
    assert.ok(second);
    assert.equal(second.text, 'iz');
  });

  it('next() returns null at end of queue', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next(); // wrold
    tool.next(); // iz
    const result = tool.next();
    assert.equal(result, null);
  });

  it('previous() moves back', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next(); // wrold
    tool.next(); // iz
    const prev = tool.previous();
    assert.ok(prev);
    assert.equal(prev.text, 'wrold');
  });

  it('current() returns null before navigation starts', () => {
    const tool = new OcrVerifyTool(mockWords());
    assert.equal(tool.current(), null);
  });

  it('jumpTo() navigates to a specific index', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    const word = tool.jumpTo(1);
    assert.ok(word);
    assert.equal(word.text, 'iz');
  });

  it('nextUnchecked() skips verified and skipped words', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next(); // wrold at index 0
    tool.accept(); // verify index 0
    // reset to start
    tool.jumpTo(-1); // invalid, stays
    const unchecked = tool.nextUnchecked();
    assert.ok(unchecked);
    assert.equal(unchecked.text, 'iz');
  });
});

// ---------------------------------------------------------------------------
// Actions: correct, accept, skip
// ---------------------------------------------------------------------------

describe('OcrVerifyTool actions', () => {
  it('correct() updates the word text and marks it corrected', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next(); // wrold
    const ok = tool.correct('world');
    assert.equal(ok, true);
    const word = tool.current();
    assert.equal(word.text, 'world');
    assert.equal(word.corrected, true);
    assert.equal(word.originalText, 'wrold');
    assert.equal(word.confidence, 1.0);
  });

  it('accept() marks the current word as verified', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next();
    const ok = tool.accept();
    assert.equal(ok, true);
  });

  it('skip() marks the current word as skipped', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next();
    const ok = tool.skip();
    assert.equal(ok, true);
  });

  it('acceptAll() accepts all remaining unchecked words', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    const count = tool.acceptAll();
    assert.equal(count, 2); // 2 low-confidence words in queue
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe('OcrVerifyTool getStats', () => {
  it('returns correct counts', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    const stats = tool.getStats();
    assert.equal(stats.totalWords, 5);
    assert.equal(stats.lowConfidenceWords, 2);
    assert.equal(stats.correctedWords, 0);
    assert.equal(stats.skippedWords, 0);
    assert.equal(stats.verifiedWords, 0);
    assert.equal(typeof stats.averageConfidence, 'number');
    assert.ok(stats.averageConfidence > 0 && stats.averageConfidence <= 1);
  });

  it('updates stats after corrections', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next();
    tool.correct('world');
    tool.next();
    tool.skip();
    const stats = tool.getStats();
    assert.equal(stats.correctedWords, 1);
    assert.equal(stats.skippedWords, 1);
    assert.equal(stats.verifiedWords, 1); // corrected word counts as verified
  });

  it('isComplete() returns true when all words reviewed', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.acceptAll();
    assert.equal(tool.isComplete(), true);
  });

  it('getProgress() returns 0-100 percentage', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    assert.equal(tool.getProgress(), 0);
    tool.next();
    tool.accept();
    assert.equal(tool.getProgress(), 50);
    tool.next();
    tool.accept();
    assert.equal(tool.getProgress(), 100);
  });
});

// ---------------------------------------------------------------------------
// Reset and other methods
// ---------------------------------------------------------------------------

describe('OcrVerifyTool reset', () => {
  it('reset() clears corrections and navigation state', () => {
    const tool = new OcrVerifyTool(mockWords(), { confidenceThreshold: 0.7 });
    tool.next();
    tool.correct('world');
    tool.reset();
    assert.equal(tool.currentIndex, -1);
    const stats = tool.getStats();
    assert.equal(stats.correctedWords, 0);
    assert.equal(stats.verifiedWords, 0);
  });

  it('getWordsByPage() filters by page number', () => {
    const tool = new OcrVerifyTool(mockWords(), { showAllWords: true });
    const page1 = tool.getWordsByPage(1);
    assert.equal(page1.length, 4);
    const page2 = tool.getWordsByPage(2);
    assert.equal(page2.length, 1);
    assert.equal(page2[0].text, 'test');
  });
});
