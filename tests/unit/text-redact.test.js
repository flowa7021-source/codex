import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { REDACTION_PATTERNS, RedactionEditor } from '../../app/modules/text-redact.js';

describe('REDACTION_PATTERNS', () => {
  it('exports predefined patterns', () => {
    assert.ok(REDACTION_PATTERNS.ssn instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.email instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.phone instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.creditCard instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.date instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.ipv4 instanceof RegExp);
  });

  it('ssn pattern matches valid SSNs', () => {
    const matches = '123-45-6789'.match(REDACTION_PATTERNS.ssn);
    assert.ok(matches, 'should match SSN with dashes');
    const matches2 = '123 45 6789'.match(new RegExp(REDACTION_PATTERNS.ssn.source));
    assert.ok(matches2, 'should match SSN with spaces');
  });

  it('email pattern matches valid emails', () => {
    const matches = 'user@example.com'.match(REDACTION_PATTERNS.email);
    assert.ok(matches);
  });

  it('creditCard pattern matches card numbers', () => {
    const matches = '1234-5678-9012-3456'.match(REDACTION_PATTERNS.creditCard);
    assert.ok(matches);
  });

  it('ipv4 pattern matches IP addresses', () => {
    const matches = '192.168.1.100'.match(REDACTION_PATTERNS.ipv4);
    assert.ok(matches);
  });
});

describe('RedactionEditor', () => {
  it('constructor creates instance with container and deps', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
      onCancel: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    assert.ok(editor);
  });

  it('open appends panel to container', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
      onCancel: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('open is idempotent (does not add duplicate panels)', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('close removes the panel', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();
    assert.equal(container.children.length, 1);
    editor.close();
    assert.equal(container.children.length, 0);
  });

  it('close is safe to call when not open', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    assert.doesNotThrow(() => editor.close());
  });
});
