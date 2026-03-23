import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initPdfProHandlersDeps, initPdfProHandlers } from '../../app/modules/pdf-pro-handlers.js';

describe('initPdfProHandlersDeps', () => {
  it('does not throw when called with empty object', () => {
    assert.doesNotThrow(() => initPdfProHandlersDeps({}));
  });

  it('accepts partial dependency overrides', () => {
    assert.doesNotThrow(() => initPdfProHandlersDeps({
      setOcrStatus: () => {},
      nrPrompt: async () => null,
    }));
  });
});

describe('initPdfProHandlers', () => {
  it('does not throw when DOM elements are missing', () => {
    // document.getElementById returns null by default in setup-dom
    assert.doesNotThrow(() => initPdfProHandlers());
  });

  it('registers click handler on pdfOptimize element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'pdfOptimize';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'pdfOptimize' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    // We verify it tried to add a click listener
    assert.ok(listeners.some(l => l.type === 'click'));
  });

  it('registers click handler on pdfFlatten element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'pdfFlatten';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'pdfFlatten' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    assert.ok(listeners.some(l => l.type === 'click'));
  });

  it('registers click handler on pdfRedact element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'pdfRedact';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'pdfRedact' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    assert.ok(listeners.some(l => l.type === 'click'));
  });

  it('registers click handler on pdfHeaderFooter element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'pdfHeaderFooter';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'pdfHeaderFooter' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    assert.ok(listeners.some(l => l.type === 'click'));
  });

  it('registers click handler on pdfBatesNumber element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'pdfBatesNumber';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'pdfBatesNumber' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    assert.ok(listeners.some(l => l.type === 'click'));
  });

  it('registers click handler on orgRotateCW element when present', () => {
    const listeners = [];
    const el = document.createElement('button');
    el.id = 'orgRotateCW';
    el.addEventListener = (type, fn) => listeners.push({ type, fn });

    const origGetById = document.getElementById;
    document.getElementById = (id) => id === 'orgRotateCW' ? el : null;
    try {
      initPdfProHandlers();
    } finally {
      document.getElementById = origGetById;
    }
    assert.ok(listeners.some(l => l.type === 'click'));
  });
});
