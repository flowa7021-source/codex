// ─── Unit Tests: template-engine ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderTemplate,
  compileTemplate,
  escapeTemplateHTML,
  validateTemplate,
  extractVariables,
} from '../../app/modules/template-engine.js';

// ─── escapeTemplateHTML ───────────────────────────────────────────────────────

describe('escapeTemplateHTML', () => {
  it('escapes < and >', () => {
    assert.equal(escapeTemplateHTML('<b>'), '&lt;b&gt;');
  });

  it('escapes &', () => {
    assert.equal(escapeTemplateHTML('a & b'), 'a &amp; b');
  });

  it('escapes double quotes', () => {
    assert.equal(escapeTemplateHTML('"hello"'), '&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    assert.equal(escapeTemplateHTML("it's"), 'it&#39;s');
  });

  it('leaves unescaped strings unchanged', () => {
    assert.equal(escapeTemplateHTML('hello world'), 'hello world');
  });
});

// ─── renderTemplate – basic variable substitution ────────────────────────────

describe('renderTemplate – variable substitution', () => {
  it('substitutes a simple {{name}} variable', () => {
    const result = renderTemplate('Hello, {{name}}!', { name: 'Alice' });
    assert.equal(result, 'Hello, Alice!');
  });

  it('substitutes multiple variables', () => {
    const result = renderTemplate('{{greeting}}, {{name}}!', { greeting: 'Hi', name: 'Bob' });
    assert.equal(result, 'Hi, Bob!');
  });

  it('leaves unknown variables as empty string', () => {
    const result = renderTemplate('{{missing}}', {});
    assert.equal(result, '');
  });

  it('substitutes numeric values', () => {
    const result = renderTemplate('Count: {{count}}', { count: 42 });
    assert.equal(result, 'Count: 42');
  });
});

// ─── renderTemplate – HTML escaping ──────────────────────────────────────────

describe('renderTemplate – HTML escaping', () => {
  it('escapes < in variable by default', () => {
    const result = renderTemplate('{{value}}', { value: '<script>' });
    assert.equal(result, '&lt;script&gt;');
  });

  it('escapes > in variable by default', () => {
    const result = renderTemplate('{{value}}', { value: 'a > b' });
    assert.equal(result, 'a &gt; b');
  });

  it('escapes & in variable by default', () => {
    const result = renderTemplate('{{value}}', { value: 'a & b' });
    assert.equal(result, 'a &amp; b');
  });
});

// ─── renderTemplate – unescaped triple braces ─────────────────────────────────

describe('renderTemplate – unescaped {{{variable}}}', () => {
  it('does not escape HTML with triple braces', () => {
    const result = renderTemplate('{{{html}}}', { html: '<b>bold</b>' });
    assert.equal(result, '<b>bold</b>');
  });

  it('renders raw value for triple-brace variable', () => {
    const result = renderTemplate('Raw: {{{content}}}', { content: '<em>yes</em>' });
    assert.equal(result, 'Raw: <em>yes</em>');
  });
});

// ─── renderTemplate – sections ────────────────────────────────────────────────

describe('renderTemplate – sections', () => {
  it('renders {{#section}}...{{/section}} when truthy', () => {
    const result = renderTemplate('{{#show}}Hello{{/show}}', { show: true });
    assert.equal(result, 'Hello');
  });

  it('omits {{#section}} block when falsy', () => {
    const result = renderTemplate('{{#show}}Hello{{/show}}', { show: false });
    assert.equal(result, '');
  });

  it('iterates over array in section', () => {
    const result = renderTemplate('{{#items}}[{{name}}]{{/items}}', {
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    assert.equal(result, '[A][B][C]');
  });

  it('renders nothing for empty array', () => {
    const result = renderTemplate('{{#items}}x{{/items}}', { items: [] });
    assert.equal(result, '');
  });
});

// ─── renderTemplate – inverted sections ──────────────────────────────────────

describe('renderTemplate – inverted sections', () => {
  it('renders {{^empty}} when value is falsy', () => {
    const result = renderTemplate('{{^empty}}No items{{/empty}}', { empty: false });
    assert.equal(result, 'No items');
  });

  it('renders {{^empty}} when value is undefined', () => {
    const result = renderTemplate('{{^missing}}fallback{{/missing}}', {});
    assert.equal(result, 'fallback');
  });

  it('omits {{^section}} block when value is truthy', () => {
    const result = renderTemplate('{{^show}}hidden{{/show}}', { show: true });
    assert.equal(result, '');
  });

  it('renders {{^arr}} when array is empty', () => {
    const result = renderTemplate('{{^list}}empty{{/list}}', { list: [] });
    assert.equal(result, 'empty');
  });

  it('omits {{^arr}} when array is non-empty', () => {
    const result = renderTemplate('{{^list}}empty{{/list}}', { list: [1] });
    assert.equal(result, '');
  });
});

// ─── renderTemplate – comments ────────────────────────────────────────────────

describe('renderTemplate – comments', () => {
  it('removes {{! comment }} from output', () => {
    const result = renderTemplate('Hello{{! this is a comment }} World', {});
    assert.equal(result, 'Hello World');
  });

  it('removes multi-word comment', () => {
    const result = renderTemplate('{{! ignore me }}text', {});
    assert.equal(result, 'text');
  });

  it('does not include comment content in output', () => {
    const result = renderTemplate('A{{! secret }}B', {});
    assert.equal(result, 'AB');
  });
});

// ─── compileTemplate ─────────────────────────────────────────────────────────

describe('compileTemplate', () => {
  it('returns a function', () => {
    const fn = compileTemplate('Hello {{name}}');
    assert.equal(typeof fn, 'function');
  });

  it('compiled function produces same result as renderTemplate', () => {
    const template = 'Hello, {{name}}!';
    const ctx = { name: 'World' };
    const compiled = compileTemplate(template);
    assert.equal(compiled(ctx), renderTemplate(template, ctx));
  });

  it('compiled function can be reused with different contexts', () => {
    const fn = compileTemplate('Hi {{name}}');
    assert.equal(fn({ name: 'Alice' }), 'Hi Alice');
    assert.equal(fn({ name: 'Bob' }), 'Hi Bob');
  });

  it('compiled function handles sections', () => {
    const fn = compileTemplate('{{#show}}yes{{/show}}');
    assert.equal(fn({ show: true }), 'yes');
    assert.equal(fn({ show: false }), '');
  });
});

// ─── validateTemplate ────────────────────────────────────────────────────────

describe('validateTemplate', () => {
  it('returns valid:true for a simple valid template', () => {
    const result = validateTemplate('Hello {{name}}');
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('returns valid:true for a template with a closed section', () => {
    const result = validateTemplate('{{#items}}{{name}}{{/items}}');
    assert.equal(result.valid, true);
  });

  it('detects an unclosed section tag', () => {
    const result = validateTemplate('{{#items}}no closing tag');
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0, 'should have errors');
  });

  it('detects unclosed tag in errors array', () => {
    const result = validateTemplate('{{#section}}content');
    assert.ok(result.errors.some((e) => e.includes('section')), `errors: ${result.errors}`);
  });

  it('returns valid:true for empty template', () => {
    const result = validateTemplate('');
    assert.equal(result.valid, true);
  });

  it('validates a template with comments', () => {
    const result = validateTemplate('{{! comment }}{{name}}');
    assert.equal(result.valid, true);
  });
});

// ─── extractVariables ────────────────────────────────────────────────────────

describe('extractVariables', () => {
  it('returns empty array for template with no variables', () => {
    assert.deepEqual(extractVariables('Hello World'), []);
  });

  it('extracts a single variable', () => {
    const vars = extractVariables('{{name}}');
    assert.ok(vars.includes('name'), `vars: ${vars}`);
  });

  it('extracts multiple variables', () => {
    const vars = extractVariables('{{first}} {{last}}');
    assert.ok(vars.includes('first'), `vars: ${vars}`);
    assert.ok(vars.includes('last'), `vars: ${vars}`);
  });

  it('extracts unescaped triple-brace variables', () => {
    const vars = extractVariables('{{{html}}}');
    assert.ok(vars.includes('html'), `vars: ${vars}`);
  });

  it('does not include section tag names as plain variables', () => {
    const vars = extractVariables('{{#items}}{{name}}{{/items}}');
    assert.ok(!vars.includes('items'), `section tag should not be a variable: ${vars}`);
    assert.ok(vars.includes('name'), `inner variable should be extracted: ${vars}`);
  });

  it('does not include comment content as variables', () => {
    const vars = extractVariables('{{! secret }}{{name}}');
    assert.ok(!vars.includes('secret'), `comment should not appear in variables: ${vars}`);
    assert.ok(vars.includes('name'), `vars: ${vars}`);
  });

  it('returns unique variable names', () => {
    const vars = extractVariables('{{name}} {{name}} {{name}}');
    assert.equal(vars.filter((v) => v === 'name').length, 1);
  });
});
