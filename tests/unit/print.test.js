// ─── Unit Tests: Print Module ────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  printPage,
  onBeforePrint,
  onAfterPrint,
  isPrinting,
  applyPrintStyles,
  hideDuringPrint,
} from '../../app/modules/print.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let printCalled;
/** @type {Array<any>} */
let appendedEls;

beforeEach(() => {
  printCalled = false;
  appendedEls = [];
  globalThis.window.print = () => { printCalled = true; };
  globalThis.document.head = {
    appendChild: (el) => { appendedEls.push(el); return el; },
  };
});

afterEach(() => {
  delete globalThis.window.print;
});

// ─── printPage ────────────────────────────────────────────────────────────────

describe('printPage', () => {
  it('calls window.print()', () => {
    printPage();
    assert.equal(printCalled, true);
  });

  it('does not throw when window.print is absent', () => {
    delete globalThis.window.print;
    assert.doesNotThrow(() => printPage());
  });

  it('does not throw when called multiple times', () => {
    assert.doesNotThrow(() => {
      printPage();
      printPage();
    });
    assert.equal(printCalled, true);
  });
});

// ─── onBeforePrint ────────────────────────────────────────────────────────────

describe('onBeforePrint', () => {
  it('returns a function', () => {
    const unsub = onBeforePrint(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('registers a listener for the beforeprint event on window', () => {
    const received = [];
    const unsub = onBeforePrint(() => received.push(true));

    globalThis.window.dispatchEvent(new Event('beforeprint'));

    assert.equal(received.length, 1);
    unsub();
  });

  it('unsubscribe removes the beforeprint listener', () => {
    const received = [];
    const unsub = onBeforePrint(() => received.push(true));
    unsub();

    globalThis.window.dispatchEvent(new Event('beforeprint'));

    assert.equal(received.length, 0, 'listener should not fire after unsubscribe');
  });

  it('calls the callback each time beforeprint fires', () => {
    const received = [];
    const unsub = onBeforePrint(() => received.push(true));

    globalThis.window.dispatchEvent(new Event('beforeprint'));
    globalThis.window.dispatchEvent(new Event('beforeprint'));

    assert.equal(received.length, 2);
    unsub();
  });
});

// ─── onAfterPrint ─────────────────────────────────────────────────────────────

describe('onAfterPrint', () => {
  it('returns a function', () => {
    const unsub = onAfterPrint(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('registers a listener for the afterprint event on window', () => {
    const received = [];
    const unsub = onAfterPrint(() => received.push(true));

    globalThis.window.dispatchEvent(new Event('afterprint'));

    assert.equal(received.length, 1);
    unsub();
  });

  it('unsubscribe removes the afterprint listener', () => {
    const received = [];
    const unsub = onAfterPrint(() => received.push(true));
    unsub();

    globalThis.window.dispatchEvent(new Event('afterprint'));

    assert.equal(received.length, 0, 'listener should not fire after unsubscribe');
  });

  it('calls the callback each time afterprint fires', () => {
    const received = [];
    const unsub = onAfterPrint(() => received.push(true));

    globalThis.window.dispatchEvent(new Event('afterprint'));
    globalThis.window.dispatchEvent(new Event('afterprint'));

    assert.equal(received.length, 2);
    unsub();
  });
});

// ─── isPrinting ───────────────────────────────────────────────────────────────

describe('isPrinting', () => {
  it('returns false initially', () => {
    // Dispatch afterprint to ensure state is reset
    globalThis.window.dispatchEvent(new Event('afterprint'));
    assert.equal(isPrinting(), false);
  });

  it('returns true after beforeprint fires', () => {
    globalThis.window.dispatchEvent(new Event('beforeprint'));
    assert.equal(isPrinting(), true);
    // Clean up — reset state
    globalThis.window.dispatchEvent(new Event('afterprint'));
  });

  it('returns false after afterprint fires', () => {
    globalThis.window.dispatchEvent(new Event('beforeprint'));
    assert.equal(isPrinting(), true);
    globalThis.window.dispatchEvent(new Event('afterprint'));
    assert.equal(isPrinting(), false);
  });

  it('returns a boolean', () => {
    assert.equal(typeof isPrinting(), 'boolean');
  });
});

// ─── applyPrintStyles ─────────────────────────────────────────────────────────

describe('applyPrintStyles', () => {
  it('returns a cleanup function', () => {
    const cleanup = applyPrintStyles('body { color: black; }');
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('appends a style element to document.head', () => {
    appendedEls = [];
    const cleanup = applyPrintStyles('body { color: black; }');
    assert.equal(appendedEls.length, 1);
    cleanup();
  });

  it('the appended element has the css wrapped in @media print', () => {
    appendedEls = [];
    const css = 'body { color: black; }';
    const cleanup = applyPrintStyles(css);
    const el = appendedEls[0];
    assert.ok(el.textContent.includes('@media print'), 'should wrap in @media print');
    assert.ok(el.textContent.includes(css), 'should include the provided css');
    cleanup();
  });

  it('cleanup function calls remove on the style element', () => {
    const removed = [];
    // Patch document.createElement to track remove calls
    const origCreate = globalThis.document.createElement;
    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      el.remove = () => removed.push(tag);
      return el;
    };

    const cleanup = applyPrintStyles('.foo { display: none; }');
    assert.equal(removed.length, 0);
    cleanup();
    assert.equal(removed.length, 1);

    globalThis.document.createElement = origCreate;
  });
});

// ─── hideDuringPrint ──────────────────────────────────────────────────────────

describe('hideDuringPrint', () => {
  it('returns a cleanup function', () => {
    const cleanup = hideDuringPrint('.sidebar');
    assert.equal(typeof cleanup, 'function');
    cleanup();
  });

  it('appends a style element to document.head', () => {
    appendedEls = [];
    const cleanup = hideDuringPrint('.sidebar');
    assert.equal(appendedEls.length, 1);
    cleanup();
  });

  it('generates display:none css for the given selector', () => {
    appendedEls = [];
    const cleanup = hideDuringPrint('.sidebar');
    const el = appendedEls[0];
    assert.ok(el.textContent.includes('.sidebar'), 'should include the selector');
    assert.ok(el.textContent.includes('display: none'), 'should hide the element');
    cleanup();
  });

  it('wraps the generated css in @media print', () => {
    appendedEls = [];
    const cleanup = hideDuringPrint('#toolbar');
    const el = appendedEls[0];
    assert.ok(el.textContent.includes('@media print'), 'should wrap in @media print');
    cleanup();
  });
});
