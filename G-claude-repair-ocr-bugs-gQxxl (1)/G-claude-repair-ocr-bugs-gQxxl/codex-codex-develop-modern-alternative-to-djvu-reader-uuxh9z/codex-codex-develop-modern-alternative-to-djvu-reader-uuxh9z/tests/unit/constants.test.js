// ─── Unit Tests: Constants ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_VERSION,
  APP_BUILD_DATE,
  APP_NAME,
  NOVAREADER_PLAN_PROGRESS_PERCENT,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_PAGE_COUNT,
  RENDER_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
  SEARCH_DEBOUNCE_MS,
  AUTOSAVE_INTERVAL_MS,
  MAX_MEMORY_USAGE_MB,
  MAX_CANVAS_POOL_SIZE,
  MAX_RENDER_CACHE_PAGES,
  MAX_THUMBNAIL_CACHE_PAGES,
  EVENT_LISTENER_WARN_THRESHOLD,
  SUPPORTED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  SIDEBAR_SECTION_CONFIG,
  TOOLBAR_SECTION_CONFIG,
  OCR_MIN_DPI,
  CSS_BASE_DPI,
  OCR_MAX_SIDE_PX,
  OCR_MAX_PIXELS,
  OCR_SLOW_TASK_WARN_MS,
  OCR_HANG_WARN_MS,
  OCR_SOURCE_MAX_PIXELS,
  OCR_SOURCE_CACHE_MAX_PIXELS,
  OCR_SOURCE_CACHE_TTL_MS,
  OCR_MAX_CONCURRENT_WORKERS,
  OCR_CONFIDENCE_THRESHOLD,
} from '../../app/modules/constants.js';

describe('constants – app metadata', () => {
  it('APP_VERSION is a semver-like string', () => {
    assert.equal(typeof APP_VERSION, 'string');
    assert.ok(/^\d+\.\d+\.\d+/.test(APP_VERSION), `unexpected version format: ${APP_VERSION}`);
  });

  it('APP_BUILD_DATE is a date string', () => {
    assert.equal(typeof APP_BUILD_DATE, 'string');
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(APP_BUILD_DATE));
  });

  it('APP_NAME is NovaReader', () => {
    assert.equal(APP_NAME, 'NovaReader');
  });

  it('NOVAREADER_PLAN_PROGRESS_PERCENT is 100', () => {
    assert.equal(NOVAREADER_PLAN_PROGRESS_PERCENT, 100);
  });
});

describe('constants – limits and timeouts', () => {
  it('MAX_FILE_SIZE_MB is a positive number', () => {
    assert.equal(typeof MAX_FILE_SIZE_MB, 'number');
    assert.ok(MAX_FILE_SIZE_MB > 0);
  });

  it('MAX_FILE_SIZE_BYTES equals MAX_FILE_SIZE_MB * 1024 * 1024', () => {
    assert.equal(MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB * 1024 * 1024);
  });

  it('MAX_PAGE_COUNT is a positive number', () => {
    assert.equal(typeof MAX_PAGE_COUNT, 'number');
    assert.ok(MAX_PAGE_COUNT > 0);
  });

  it('timeout values are positive numbers', () => {
    assert.equal(typeof RENDER_TIMEOUT_MS, 'number');
    assert.ok(RENDER_TIMEOUT_MS > 0);
    assert.equal(typeof OCR_TIMEOUT_MS, 'number');
    assert.ok(OCR_TIMEOUT_MS > 0);
    assert.equal(typeof SEARCH_DEBOUNCE_MS, 'number');
    assert.ok(SEARCH_DEBOUNCE_MS > 0);
    assert.equal(typeof AUTOSAVE_INTERVAL_MS, 'number');
    assert.ok(AUTOSAVE_INTERVAL_MS > 0);
  });
});

describe('constants – memory management', () => {
  it('MAX_MEMORY_USAGE_MB is a positive number', () => {
    assert.equal(typeof MAX_MEMORY_USAGE_MB, 'number');
    assert.ok(MAX_MEMORY_USAGE_MB > 0);
  });

  it('MAX_CANVAS_POOL_SIZE is a positive number', () => {
    assert.equal(typeof MAX_CANVAS_POOL_SIZE, 'number');
    assert.ok(MAX_CANVAS_POOL_SIZE > 0);
  });

  it('MAX_RENDER_CACHE_PAGES is a positive number', () => {
    assert.equal(typeof MAX_RENDER_CACHE_PAGES, 'number');
    assert.ok(MAX_RENDER_CACHE_PAGES > 0);
  });

  it('MAX_THUMBNAIL_CACHE_PAGES is a positive number', () => {
    assert.equal(typeof MAX_THUMBNAIL_CACHE_PAGES, 'number');
    assert.ok(MAX_THUMBNAIL_CACHE_PAGES > 0);
  });

  it('EVENT_LISTENER_WARN_THRESHOLD is a positive number', () => {
    assert.equal(typeof EVENT_LISTENER_WARN_THRESHOLD, 'number');
    assert.ok(EVENT_LISTENER_WARN_THRESHOLD > 0);
  });
});

describe('constants – supported formats', () => {
  it('SUPPORTED_EXTENSIONS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(SUPPORTED_EXTENSIONS));
    assert.ok(SUPPORTED_EXTENSIONS.length > 0);
    for (const ext of SUPPORTED_EXTENSIONS) {
      assert.equal(typeof ext, 'string');
      assert.ok(ext.startsWith('.'), `extension should start with dot: ${ext}`);
    }
  });

  it('SUPPORTED_EXTENSIONS includes pdf and djvu', () => {
    assert.ok(SUPPORTED_EXTENSIONS.includes('.pdf'));
    assert.ok(SUPPORTED_EXTENSIONS.includes('.djvu'));
  });

  it('IMAGE_EXTENSIONS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(IMAGE_EXTENSIONS));
    assert.ok(IMAGE_EXTENSIONS.length > 0);
    for (const ext of IMAGE_EXTENSIONS) {
      assert.equal(typeof ext, 'string');
      assert.ok(ext.startsWith('.'));
    }
  });

  it('IMAGE_EXTENSIONS includes common image formats', () => {
    assert.ok(IMAGE_EXTENSIONS.includes('.jpg'));
    assert.ok(IMAGE_EXTENSIONS.includes('.png'));
  });

  it('all IMAGE_EXTENSIONS are in SUPPORTED_EXTENSIONS', () => {
    for (const ext of IMAGE_EXTENSIONS) {
      assert.ok(SUPPORTED_EXTENSIONS.includes(ext), `${ext} missing from SUPPORTED_EXTENSIONS`);
    }
  });
});

describe('constants – sidebar and toolbar configs', () => {
  it('SIDEBAR_SECTION_CONFIG is an array of { key, label } objects', () => {
    assert.ok(Array.isArray(SIDEBAR_SECTION_CONFIG));
    assert.ok(SIDEBAR_SECTION_CONFIG.length > 0);
    for (const item of SIDEBAR_SECTION_CONFIG) {
      assert.equal(typeof item.key, 'string');
      assert.equal(typeof item.label, 'string');
    }
  });

  it('TOOLBAR_SECTION_CONFIG is an array of { key, label } objects', () => {
    assert.ok(Array.isArray(TOOLBAR_SECTION_CONFIG));
    assert.ok(TOOLBAR_SECTION_CONFIG.length > 0);
    for (const item of TOOLBAR_SECTION_CONFIG) {
      assert.equal(typeof item.key, 'string');
      assert.equal(typeof item.label, 'string');
    }
  });
});

describe('constants – OCR configuration', () => {
  it('OCR numeric constants are positive numbers', () => {
    const ocrConstants = [
      OCR_MIN_DPI, CSS_BASE_DPI, OCR_MAX_SIDE_PX, OCR_MAX_PIXELS,
      OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS, OCR_SOURCE_MAX_PIXELS,
      OCR_SOURCE_CACHE_MAX_PIXELS, OCR_SOURCE_CACHE_TTL_MS,
      OCR_MAX_CONCURRENT_WORKERS, OCR_CONFIDENCE_THRESHOLD,
    ];
    for (const val of ocrConstants) {
      assert.equal(typeof val, 'number');
      assert.ok(val > 0, `expected positive number, got ${val}`);
    }
  });

  it('OCR_MIN_DPI is >= CSS_BASE_DPI', () => {
    assert.ok(OCR_MIN_DPI >= CSS_BASE_DPI);
  });

  it('OCR_HANG_WARN_MS > OCR_SLOW_TASK_WARN_MS', () => {
    assert.ok(OCR_HANG_WARN_MS > OCR_SLOW_TASK_WARN_MS);
  });
});
