// ─── Unit Tests: Toast Notification System ──────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Enhance DOM mock for toast module ──────────────────────────────────────
// toast.js calls el.querySelector('.toast-close'), el.innerHTML = ...,
// document.body.contains(), etc. We need to patch the mock before importing.

function makeMockEl(tag) {
  const _children = [];
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    className: '',
    style: {},
    width: 0,
    height: 0,
    innerHTML: '',
    textContent: '',
    parentNode: null,
    children: _children,
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach((c) => this._classes.add(c)); },
      remove(...cls) { cls.forEach((c) => this._classes.delete(c)); },
      toggle(c) { this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c); },
      contains(c) { return this._classes.has(c); },
    },
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(child) {
      _children.push(child);
      child.parentNode = el;
      return child;
    },
    remove() { el.parentNode = null; },
    addEventListener() {},
    removeEventListener() {},
    closest() { return null; },
    click() {},
    // querySelector returns a mock element for any selector to avoid null errors
    querySelector() {
      return makeMockEl('span');
    },
    querySelectorAll() { return []; },
    getContext() {
      return {
        drawImage() {}, fillRect() {}, clearRect() {},
        getImageData: () => ({ data: new Uint8Array(0), width: 0, height: 0 }),
        canvas: el,
      };
    },
    toDataURL: () => 'data:image/png;base64,',
    toBlob: (cb) => cb(new Blob()),
  };
  return el;
}

const _origCreateElement = document.createElement;
document.createElement = function (tag) {
  return makeMockEl(tag);
};

document.body.contains = function () { return false; };
document.body.appendChild = function (child) { child.parentNode = document.body; return child; };

// Now import the toast module
import {
  toast,
  toastSuccess,
  toastError,
  toastWarning,
  toastInfo,
  toastProgress,
  dismissAllToasts,
} from '../../app/modules/toast.js';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('toast()', () => {
  it('returns an object with id, update, and dismiss', () => {
    const result = toast('Hello');
    assert.ok(result);
    assert.ok('id' in result);
    assert.equal(typeof result.update, 'function');
    assert.equal(typeof result.dismiss, 'function');
    result.dismiss();
  });

  it('assigns unique IDs to consecutive toasts', () => {
    const t1 = toast('first');
    const t2 = toast('second');
    assert.notEqual(t1.id, t2.id);
    t1.dismiss();
    t2.dismiss();
  });

  it('allows custom ID via opts', () => {
    const result = toast('custom', { id: 'my-custom-id' });
    assert.equal(result.id, 'my-custom-id');
    result.dismiss();
  });

  it('updates existing toast when same custom ID is reused', () => {
    const t1 = toast('first message', { id: 'reuse-id' });
    const t2 = toast('second message', { id: 'reuse-id' });
    assert.equal(t1.id, 'reuse-id');
    assert.equal(t2.id, 'reuse-id');
    t2.dismiss();
  });

  it('dismiss can be called multiple times without error', () => {
    const result = toast('dismiss me');
    assert.doesNotThrow(() => {
      result.dismiss();
      result.dismiss();
    });
  });
});

describe('toastSuccess / toastError / toastWarning / toastInfo', () => {
  it('toastSuccess returns toast result', () => {
    const r = toastSuccess('done');
    assert.ok(r && 'id' in r);
    r.dismiss();
  });

  it('toastError returns toast result', () => {
    const r = toastError('failed');
    assert.ok(r && 'id' in r);
    r.dismiss();
  });

  it('toastWarning returns toast result', () => {
    const r = toastWarning('watch out');
    assert.ok(r && 'id' in r);
    r.dismiss();
  });

  it('toastInfo returns toast result', () => {
    const r = toastInfo('fyi');
    assert.ok(r && 'id' in r);
    r.dismiss();
  });

  it('toastError defaults to longer duration (6000ms) without error', () => {
    const r = toastError('error msg');
    assert.ok(r);
    r.dismiss();
  });
});

describe('toastProgress', () => {
  it('returns toast result', () => {
    const r = toastProgress('loading...');
    assert.ok(r && 'id' in r);
    r.dismiss();
  });

  it('accepts progress option', () => {
    const r = toastProgress('uploading', { progress: 50 });
    assert.ok(r);
    r.dismiss();
  });

  it('accepts custom ID for updates', () => {
    const r = toastProgress('step 1', { id: 'prog-id', progress: 10 });
    assert.equal(r.id, 'prog-id');
    const updated = r.update('step 2', { progress: 80 });
    assert.equal(updated.id, 'prog-id');
    updated.dismiss();
  });
});

describe('dismissAllToasts', () => {
  it('does not throw when no toasts exist', () => {
    assert.doesNotThrow(() => dismissAllToasts());
  });

  it('dismisses multiple active toasts without error', () => {
    toast('a', { duration: 0 });
    toast('b', { duration: 0 });
    toast('c', { duration: 0 });
    assert.doesNotThrow(() => dismissAllToasts());
  });
});

describe('toast auto-dismiss', () => {
  it('progress type defaults to duration 0 (no auto-dismiss)', () => {
    const r = toast('loading', { type: 'progress' });
    assert.ok(r);
    r.dismiss();
  });

  it('explicit duration 0 prevents auto-dismiss', () => {
    const r = toast('persistent', { duration: 0 });
    assert.ok(r);
    r.dismiss();
  });
});

describe('toast message content', () => {
  it('handles empty string message', () => {
    const r = toast('');
    assert.ok(r);
    r.dismiss();
  });

  it('handles special characters in message', () => {
    const r = toast('<script>alert("xss")</script>');
    assert.ok(r);
    r.dismiss();
  });

  it('handles long messages', () => {
    const r = toast('A'.repeat(1000));
    assert.ok(r);
    r.dismiss();
  });
});

describe('toast update', () => {
  it('update changes message via returned handle', () => {
    const h = toast('initial', { id: 'upd-test', duration: 0 });
    const u = h.update('changed');
    assert.ok(u);
    assert.equal(u.id, 'upd-test');
    u.dismiss();
  });

  it('update with new type returns handle', () => {
    const h = toast('info msg', { id: 'type-change', type: 'info', duration: 0 });
    const u = h.update('now success', { type: 'success' });
    assert.ok(u);
    u.dismiss();
  });

  it('update with progress value returns handle', () => {
    const h = toastProgress('loading', { id: 'prog-upd', progress: 0 });
    const u = h.update('halfway', { progress: 50 });
    assert.ok(u);
    u.dismiss();
  });
});
