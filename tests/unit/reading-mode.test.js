import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const { ReadingMode } = await import('../../app/modules/reading-mode.js');

describe('ReadingMode', () => {
  let reader;
  let exitCalled;
  let pageChanges;
  let deps;

  beforeEach(() => {
    exitCalled = false;
    pageChanges = [];
    deps = {
      getPageText: mock.fn(async (p) => `Page ${p} text content.\n\nSecond paragraph.`),
      getTotalPages: () => 5,
      getCurrentPage: () => 1,
      onExit: () => { exitCalled = true; },
      onPageChange: (n) => { pageChanges.push(n); },
    };
    reader = new ReadingMode(deps);
  });

  it('constructs with default values', () => {
    assert.equal(reader._theme, 'light');
    assert.equal(reader._fontSize, 18);
    assert.equal(reader._lineHeight, 1.7);
    assert.equal(reader._scrollMode, 'continuous');
    assert.equal(reader._currentPage, 1);
    assert.equal(reader._totalPages, 5);
  });

  it('setTheme changes theme', () => {
    reader.setTheme('dark');
    assert.equal(reader._theme, 'dark');
  });

  it('setTheme ignores invalid theme', () => {
    reader.setTheme('neon');
    assert.equal(reader._theme, 'light');
  });

  it('setFontSize clamps between 10 and 40', () => {
    reader.setFontSize(5);
    assert.equal(reader._fontSize, 10);
    reader.setFontSize(50);
    assert.equal(reader._fontSize, 40);
    reader.setFontSize(24);
    assert.equal(reader._fontSize, 24);
  });

  it('setLineHeight clamps between 1 and 3', () => {
    reader.setLineHeight(0.5);
    assert.equal(reader._lineHeight, 1);
    reader.setLineHeight(5);
    assert.equal(reader._lineHeight, 3);
    reader.setLineHeight(2.0);
    assert.equal(reader._lineHeight, 2.0);
  });

  it('setFont updates font family', () => {
    reader.setFont('Verdana');
    assert.equal(reader._fontFamily, 'Verdana');
  });

  it('enter creates an overlay', async () => {
    await reader.enter();
    assert.ok(reader._overlay !== null);
    reader.exit();
  });

  it('enter does not double-create overlay', async () => {
    await reader.enter();
    const overlay1 = reader._overlay;
    await reader.enter();
    assert.equal(reader._overlay, overlay1);
    reader.exit();
  });

  it('exit removes overlay and calls onExit', async () => {
    await reader.enter();
    reader.exit();
    assert.equal(reader._overlay, null);
    assert.ok(exitCalled);
  });

  it('goToPage ignores out-of-range pages', async () => {
    await reader.enter();
    await reader.goToPage(0);
    assert.equal(reader._currentPage, 1);
    await reader.goToPage(100);
    assert.equal(reader._currentPage, 1);
    reader.exit();
  });

  it('goToPage navigates to valid page', async () => {
    await reader.enter();
    await reader.goToPage(3);
    assert.equal(reader._currentPage, 3);
    assert.ok(pageChanges.includes(3));
    reader.exit();
  });

  it('setTheme applies theme to overlay when active', async () => {
    await reader.enter();
    reader.setTheme('sepia');
    assert.equal(reader._theme, 'sepia');
    assert.ok(reader._overlay.style.background.length > 0);
    reader.exit();
  });
});
