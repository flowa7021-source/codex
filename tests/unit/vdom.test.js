// ─── Unit Tests: Virtual DOM ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { h, normalizeChildren, renderToString } from '../../app/modules/vdom.js';

// ─── h() ─────────────────────────────────────────────────────────────────────

describe('h()', () => {
  it('creates a VNode with correct type', () => {
    const node = h('div');
    assert.equal(node.type, 'div');
  });

  it('creates a VNode with correct props', () => {
    const node = h('input', { type: 'text', disabled: true });
    assert.deepEqual(node.props, { type: 'text', disabled: true });
  });

  it('creates a VNode with no props when null is passed', () => {
    const node = h('span', null);
    assert.deepEqual(node.props, {});
  });

  it('creates a VNode with no props when props is omitted', () => {
    const node = h('span');
    assert.deepEqual(node.props, {});
  });

  it('stores raw children (not normalised)', () => {
    const node = h('ul', null, 'a', null, false, 42);
    assert.deepEqual(node.children, ['a', null, false, 42]);
  });

  it('extracts key from props and removes it from props', () => {
    const node = h('li', { key: 'k1', class: 'item' });
    assert.equal(node.key, 'k1');
    assert.ok(!('key' in node.props), 'key should not be in props');
    assert.equal(node.props['class'], 'item');
  });

  it('key is undefined when not provided', () => {
    const node = h('li', { class: 'item' });
    assert.equal(node.key, undefined);
  });

  it('supports numeric key', () => {
    const node = h('li', { key: 0 });
    assert.equal(node.key, 0);
  });

  it('nests child VNodes', () => {
    const child = h('span', null, 'hello');
    const parent = h('div', null, child);
    assert.equal(parent.children.length, 1);
    assert.equal(/** @type {any} */ (parent.children[0]).type, 'span');
  });

  it('accepts multiple children', () => {
    const node = h('div', null, h('p'), h('p'), h('p'));
    assert.equal(node.children.length, 3);
  });
});

// ─── normalizeChildren() ─────────────────────────────────────────────────────

describe('normalizeChildren()', () => {
  it('removes null values', () => {
    assert.deepEqual(normalizeChildren([null, 'a', null]), ['a']);
  });

  it('removes undefined values', () => {
    assert.deepEqual(normalizeChildren([undefined, 'b']), ['b']);
  });

  it('removes boolean true', () => {
    assert.deepEqual(normalizeChildren([true, 'c']), ['c']);
  });

  it('removes boolean false', () => {
    assert.deepEqual(normalizeChildren([false, 'd']), ['d']);
  });

  it('converts numbers to strings', () => {
    assert.deepEqual(normalizeChildren([1, 2, 3]), ['1', '2', '3']);
  });

  it('keeps VNodes intact', () => {
    const vnode = h('span');
    const result = normalizeChildren([vnode]);
    assert.equal(result.length, 1);
    assert.equal(/** @type {any} */ (result[0]).type, 'span');
  });

  it('flattens nested arrays', () => {
    const result = normalizeChildren([[null, 'a'], ['b', false], 'c']);
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('returns an empty array for all-falsy input', () => {
    assert.deepEqual(normalizeChildren([null, undefined, false, true]), []);
  });

  it('handles an empty array', () => {
    assert.deepEqual(normalizeChildren([]), []);
  });

  it('handles mixed content', () => {
    const span = h('span');
    const result = normalizeChildren([null, 'text', 42, false, span]);
    assert.deepEqual(result, ['text', '42', span]);
  });
});

// ─── renderToString() ────────────────────────────────────────────────────────

describe('renderToString()', () => {
  it('renders a plain string (escaped)', () => {
    assert.equal(renderToString('hello'), 'hello');
  });

  it('escapes < > & in text', () => {
    assert.equal(renderToString('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('renders an empty element', () => {
    assert.equal(renderToString(h('div')), '<div></div>');
  });

  it('renders self-closing void elements without a closing tag', () => {
    assert.equal(renderToString(h('br')), '<br>');
    assert.equal(renderToString(h('hr')), '<hr>');
    assert.equal(renderToString(h('input', { type: 'text' })), '<input type="text">');
    assert.equal(renderToString(h('img', { src: 'x.png', alt: 'x' })), '<img src="x.png" alt="x">');
  });

  it('renders string attributes', () => {
    assert.equal(
      renderToString(h('a', { href: 'https://example.com' }, 'click')),
      '<a href="https://example.com">click</a>',
    );
  });

  it('renders boolean true attribute as standalone flag', () => {
    assert.equal(renderToString(h('button', { disabled: true })), '<button disabled></button>');
  });

  it('omits boolean false attributes', () => {
    assert.equal(renderToString(h('button', { disabled: false })), '<button></button>');
  });

  it('omits null/undefined attributes', () => {
    assert.equal(renderToString(h('div', { id: null, class: undefined })), '<div></div>');
  });

  it('escapes attribute values', () => {
    assert.equal(
      renderToString(h('div', { title: '"hello" & <world>' })),
      '<div title="&quot;hello&quot; &amp; &lt;world&gt;"></div>',
    );
  });

  it('renders text content', () => {
    assert.equal(renderToString(h('p', null, 'hello world')), '<p>hello world</p>');
  });

  it('renders number children as strings', () => {
    assert.equal(renderToString(h('span', null, 42)), '<span>42</span>');
  });

  it('renders nested elements', () => {
    const tree = h('ul', null,
      h('li', { class: 'a' }, 'one'),
      h('li', { class: 'b' }, 'two'),
    );
    assert.equal(
      renderToString(tree),
      '<ul><li class="a">one</li><li class="b">two</li></ul>',
    );
  });

  it('omits null/false children', () => {
    assert.equal(renderToString(h('div', null, null, false, 'ok')), '<div>ok</div>');
  });

  it('renders deeply nested structure', () => {
    const tree = h('div', { id: 'root' },
      h('p', null, h('strong', null, 'bold')),
    );
    assert.equal(
      renderToString(tree),
      '<div id="root"><p><strong>bold</strong></p></div>',
    );
  });
});
