// ─── Unit Tests: template-engine ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compile,
  render,
  escapeHtml,
  unescapeHtml,
  TemplateEngine,
  createTemplateEngine,
} from '../../app/modules/template-engine.js';

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes <', () => {
    assert.equal(escapeHtml('<'), '&lt;');
  });

  it('escapes >', () => {
    assert.equal(escapeHtml('>'), '&gt;');
  });

  it('escapes &', () => {
    assert.equal(escapeHtml('&'), '&amp;');
  });

  it('escapes double quotes', () => {
    assert.equal(escapeHtml('"'), '&quot;');
  });

  it('escapes single quotes', () => {
    assert.equal(escapeHtml("'"), '&#39;');
  });

  it('escapes all five characters in a mixed string', () => {
    assert.equal(escapeHtml('<a href="x&y">it\'s</a>'), '&lt;a href=&quot;x&amp;y&quot;&gt;it&#39;s&lt;/a&gt;');
  });

  it('leaves a clean string unchanged', () => {
    assert.equal(escapeHtml('hello world'), 'hello world');
  });

  it('handles an empty string', () => {
    assert.equal(escapeHtml(''), '');
  });
});

// ─── unescapeHtml ─────────────────────────────────────────────────────────────

describe('unescapeHtml', () => {
  it('unescapes &amp; back to &', () => {
    assert.equal(unescapeHtml('&amp;'), '&');
  });

  it('unescapes &lt; back to <', () => {
    assert.equal(unescapeHtml('&lt;'), '<');
  });

  it('unescapes &gt; back to >', () => {
    assert.equal(unescapeHtml('&gt;'), '>');
  });

  it('unescapes &quot; back to "', () => {
    assert.equal(unescapeHtml('&quot;'), '"');
  });

  it('unescapes &#39; back to \'', () => {
    assert.equal(unescapeHtml('&#39;'), "'");
  });

  it('round-trips escapeHtml → unescapeHtml', () => {
    const original = '<script>alert("XSS & more")</script>';
    assert.equal(unescapeHtml(escapeHtml(original)), original);
  });

  it('leaves clean strings unchanged', () => {
    assert.equal(unescapeHtml('hello world'), 'hello world');
  });

  it('handles an empty string', () => {
    assert.equal(unescapeHtml(''), '');
  });
});

// ─── render – variable substitution ──────────────────────────────────────────

describe('render – variable substitution', () => {
  it('substitutes a simple {{name}} variable', () => {
    assert.equal(render('Hello, {{name}}!', { name: 'Alice' }), 'Hello, Alice!');
  });

  it('substitutes multiple variables', () => {
    assert.equal(render('{{a}} and {{b}}', { a: 'foo', b: 'bar' }), 'foo and bar');
  });

  it('substitutes a numeric value as a string', () => {
    assert.equal(render('Count: {{n}}', { n: 42 }), 'Count: 42');
  });

  it('substitutes a boolean value as a string', () => {
    assert.equal(render('Active: {{flag}}', { flag: true }), 'Active: true');
  });

  it('renders an empty string for a missing variable', () => {
    assert.equal(render('{{missing}}', {}), '');
  });

  it('renders an empty string for null value', () => {
    assert.equal(render('{{x}}', { x: null }), '');
  });

  it('renders an empty string for undefined value', () => {
    assert.equal(render('{{x}}', { x: undefined }), '');
  });

  it('HTML-escapes variable values by default', () => {
    assert.equal(render('{{v}}', { v: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
  });

  it('supports dot-notation paths', () => {
    assert.equal(render('{{user.name}}', { user: { name: 'Eve' } }), 'Eve');
  });

  it('returns empty string for a missing nested path', () => {
    assert.equal(render('{{a.b.c}}', { a: {} }), '');
  });
});

// ─── render – HTML escaping control ──────────────────────────────────────────

describe('render – HTML escaping control', () => {
  it('triple braces {{{name}}} bypass HTML escaping', () => {
    assert.equal(render('{{{html}}}', { html: '<b>bold</b>' }), '<b>bold</b>');
  });

  it('triple braces render missing variable as empty string', () => {
    assert.equal(render('{{{missing}}}', {}), '');
  });

  it('escape:false option disables HTML escaping for {{}}', () => {
    assert.equal(
      render('{{v}}', { v: '<em>hi</em>' }, { escape: false }),
      '<em>hi</em>',
    );
  });

  it('escape:true (explicit) still escapes', () => {
    assert.equal(
      render('{{v}}', { v: '&' }, { escape: true }),
      '&amp;',
    );
  });

  it('triple-brace is raw even when escape:true is set', () => {
    assert.equal(
      render('{{{v}}}', { v: '<raw>' }, { escape: true }),
      '<raw>',
    );
  });
});

// ─── render – comments ────────────────────────────────────────────────────────

describe('render – comments', () => {
  it('strips a single-word comment {{! comment }}', () => {
    assert.equal(render('A{{! comment }}B', {}), 'AB');
  });

  it('strips a multi-word comment', () => {
    assert.equal(render('{{! this is ignored }}text', {}), 'text');
  });

  it('does not include comment content in the output', () => {
    const out = render('start{{! secret stuff }}end', {});
    assert.equal(out, 'startend');
    assert.ok(!out.includes('secret'));
  });

  it('handles multiple comments in one template', () => {
    assert.equal(render('{{! a }}X{{! b }}Y', {}), 'XY');
  });
});

// ─── render – #if conditionals ────────────────────────────────────────────────

describe('render – #if conditionals', () => {
  it('renders block content when condition is truthy', () => {
    assert.equal(render('{{#if show}}yes{{/if}}', { show: true }), 'yes');
  });

  it('omits block content when condition is falsy (false)', () => {
    assert.equal(render('{{#if show}}yes{{/if}}', { show: false }), '');
  });

  it('omits block content when condition is undefined', () => {
    assert.equal(render('{{#if missing}}yes{{/if}}', {}), '');
  });

  it('omits block content when condition is null', () => {
    assert.equal(render('{{#if x}}yes{{/if}}', { x: null }), '');
  });

  it('omits block content when condition is 0', () => {
    assert.equal(render('{{#if x}}yes{{/if}}', { x: 0 }), '');
  });

  it('renders block content when condition is a non-empty string', () => {
    assert.equal(render('{{#if x}}yes{{/if}}', { x: 'hello' }), 'yes');
  });

  it('renders block content when condition is a non-zero number', () => {
    assert.equal(render('{{#if x}}yes{{/if}}', { x: 1 }), 'yes');
  });

  it('renders surrounding text outside the block correctly', () => {
    assert.equal(render('before{{#if x}}mid{{/if}}after', { x: true }), 'beforemidafter');
  });

  it('evaluates variables inside an if block', () => {
    assert.equal(render('{{#if ok}}Hello {{name}}{{/if}}', { ok: true, name: 'World' }), 'Hello World');
  });
});

// ─── render – #each iteration ─────────────────────────────────────────────────

describe('render – #each iteration', () => {
  it('iterates over an array using default {{item}}', () => {
    const out = render('{{#each names}}[{{item}}]{{/each}}', { names: ['Alice', 'Bob'] });
    assert.equal(out, '[Alice][Bob]');
  });

  it('provides {{index}} (zero-based)', () => {
    const out = render('{{#each arr}}{{index}}{{/each}}', { arr: ['a', 'b', 'c'] });
    assert.equal(out, '012');
  });

  it('provides {{@first}} as true for the first element only', () => {
    const out = render('{{#each arr}}{{@first}}|{{/each}}', { arr: [1, 2, 3] });
    assert.equal(out, 'true|false|false|');
  });

  it('provides {{@last}} as true for the last element only', () => {
    const out = render('{{#each arr}}{{@last}}|{{/each}}', { arr: [1, 2, 3] });
    assert.equal(out, 'false|false|true|');
  });

  it('renders nothing for an empty array', () => {
    assert.equal(render('{{#each items}}x{{/each}}', { items: [] }), '');
  });

  it('supports named iteration variable: {{#each arr as el}}', () => {
    const out = render('{{#each arr as el}}({{el}}){{/each}}', { arr: [10, 20] });
    assert.equal(out, '(10)(20)');
  });

  it('named variable is accessible alongside index, @first, @last', () => {
    const out = render(
      '{{#each arr as n}}{{n}}-{{index}}-{{@first}}-{{@last}}|{{/each}}',
      { arr: ['x', 'y'] },
    );
    assert.equal(out, 'x-0-true-false|y-1-false-true|');
  });

  it('renders nothing when the key is not an array', () => {
    assert.equal(render('{{#each notArr}}x{{/each}}', { notArr: 'string' }), '');
  });

  it('renders nothing when the key is missing', () => {
    assert.equal(render('{{#each missing}}x{{/each}}', {}), '');
  });

  it('handles a single-element array correctly for @first and @last', () => {
    const out = render('{{#each arr}}{{@first}}-{{@last}}{{/each}}', { arr: ['only'] });
    assert.equal(out, 'true-true');
  });
});

// ─── compile ──────────────────────────────────────────────────────────────────

describe('compile', () => {
  it('returns a function', () => {
    assert.equal(typeof compile('Hello {{name}}'), 'function');
  });

  it('calling the compiled function renders the template', () => {
    const fn = compile('Hi, {{name}}!');
    assert.equal(fn({ name: 'Carol' }), 'Hi, Carol!');
  });

  it('compiled function is reusable with different data', () => {
    const fn = compile('{{x}} + {{y}}');
    assert.equal(fn({ x: 1, y: 2 }), '1 + 2');
    assert.equal(fn({ x: 'a', y: 'b' }), 'a + b');
  });

  it('compile respects custom delimiters', () => {
    const fn = compile('Hello, [[name]]!', { delimiters: ['[[', ']]'] });
    assert.equal(fn({ name: 'World' }), 'Hello, World!');
  });

  it('compile respects escape:false option', () => {
    const fn = compile('{{v}}', { escape: false });
    assert.equal(fn({ v: '<raw>' }), '<raw>');
  });

  it('matches the result of calling render() with the same args', () => {
    const tmpl = '{{greeting}}, {{name}}!';
    const data = { greeting: 'Hello', name: 'World' };
    assert.equal(compile(tmpl)(data), render(tmpl, data));
  });
});

// ─── TemplateEngine ───────────────────────────────────────────────────────────

describe('TemplateEngine', () => {
  it('can be constructed without options', () => {
    const engine = new TemplateEngine();
    assert.equal(engine.render('{{x}}', { x: 'ok' }), 'ok');
  });

  it('respects escape:false constructor option', () => {
    const engine = new TemplateEngine({ escape: false });
    assert.equal(engine.render('{{x}}', { x: '<b>' }), '<b>');
  });

  it('HTML-escapes by default', () => {
    const engine = new TemplateEngine();
    assert.equal(engine.render('{{x}}', { x: '<b>' }), '&lt;b&gt;');
  });

  it('registerPartial makes a partial available with {{> name}}', () => {
    const engine = new TemplateEngine();
    engine.registerPartial('greeting', 'Hello, {{name}}!');
    assert.equal(engine.render('{{> greeting}}', { name: 'Bob' }), 'Hello, Bob!');
  });

  it('renders nothing when a partial name is not registered', () => {
    const engine = new TemplateEngine();
    assert.equal(engine.render('{{> unknown}}', {}), '');
  });

  it('partials registered after compile() are still available at render time', () => {
    const engine = new TemplateEngine();
    const fn = engine.compile('{{> late}}');
    engine.registerPartial('late', 'late-value');
    assert.equal(fn({}), 'late-value');
  });

  it('compile() returns a reusable function', () => {
    const engine = new TemplateEngine();
    const fn = engine.compile('{{a}}-{{b}}');
    assert.equal(fn({ a: '1', b: '2' }), '1-2');
    assert.equal(fn({ a: 'x', b: 'y' }), 'x-y');
  });

  it('compile() applies the engine escape setting', () => {
    const engine = new TemplateEngine({ escape: false });
    const fn = engine.compile('{{html}}');
    assert.equal(fn({ html: '<b>' }), '<b>');
  });

  it('respects custom delimiters set in constructor', () => {
    const engine = new TemplateEngine({ delimiters: ['<%', '%>'] });
    assert.equal(engine.render('Hello, <%name%>!', { name: 'World' }), 'Hello, World!');
  });

  it('#if works inside engine.render()', () => {
    const engine = new TemplateEngine();
    assert.equal(engine.render('{{#if ok}}yes{{/if}}', { ok: true }), 'yes');
    assert.equal(engine.render('{{#if ok}}yes{{/if}}', { ok: false }), '');
  });

  it('#each works inside engine.render()', () => {
    const engine = new TemplateEngine();
    const out = engine.render('{{#each arr}}{{item}}{{/each}}', { arr: [1, 2, 3] });
    assert.equal(out, '123');
  });
});

// ─── createTemplateEngine ─────────────────────────────────────────────────────

describe('createTemplateEngine', () => {
  it('returns a TemplateEngine instance', () => {
    const engine = createTemplateEngine();
    assert.ok(engine instanceof TemplateEngine);
  });

  it('created engine renders templates correctly', () => {
    const engine = createTemplateEngine();
    assert.equal(engine.render('{{msg}}', { msg: 'hello' }), 'hello');
  });

  it('passes options through to the engine', () => {
    const engine = createTemplateEngine({ escape: false });
    assert.equal(engine.render('{{x}}', { x: '<raw>' }), '<raw>');
  });

  it('supports partial registration on the created engine', () => {
    const engine = createTemplateEngine();
    engine.registerPartial('footer', '-- {{author}}');
    assert.equal(engine.render('Body. {{> footer}}', { author: 'Me' }), 'Body. -- Me');
  });
});

// ─── Edge cases & integration ─────────────────────────────────────────────────

describe('edge cases and integration', () => {
  it('renders a template with no tags as-is', () => {
    assert.equal(render('Hello, World!', {}), 'Hello, World!');
  });

  it('renders an empty template as empty string', () => {
    assert.equal(render('', {}), '');
  });

  it('#each and #if can be nested', () => {
    const tmpl = '{{#each items}}{{#if item}}{{item}}{{/if}}{{/each}}';
    const out = render(tmpl, { items: [0, 1, 2, 0, 3] });
    assert.equal(out, '123');
  });

  it('comment is stripped but surrounding text is preserved', () => {
    assert.equal(render('A{{! drop }}B{{name}}C', { name: 'X' }), 'ABXC');
  });

  it('multiple triple-brace vars in one template', () => {
    assert.equal(
      render('{{{a}}} and {{{b}}}', { a: '<i>a</i>', b: '<i>b</i>' }),
      '<i>a</i> and <i>b</i>',
    );
  });

  it('@first and @last are both true for a single-item array', () => {
    const out = render('{{#each arr as v}}{{@first}},{{@last}}{{/each}}', { arr: ['x'] });
    assert.equal(out, 'true,true');
  });

  it('engine partials can reference outer data', () => {
    const engine = createTemplateEngine();
    engine.registerPartial('name-tag', '{{lastName}}, {{firstName}}');
    const out = engine.render('{{> name-tag}}', { firstName: 'John', lastName: 'Doe' });
    assert.equal(out, 'Doe, John');
  });
});
