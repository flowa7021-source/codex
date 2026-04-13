// ─── Unit Tests: Virtual DOM Diffing ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { h } from '../../app/modules/vdom.js';
import { diff, patch, PatchType } from '../../app/modules/vdom-diff.js';

// ─── diff() ──────────────────────────────────────────────────────────────────

describe('diff() – identical trees', () => {
  it('returns no patches when both trees are null', () => {
    assert.deepEqual(diff(null, null), []);
  });

  it('returns no patches for identical text nodes', () => {
    assert.deepEqual(diff('hello', 'hello'), []);
  });

  it('returns no patches for identical simple elements', () => {
    assert.deepEqual(diff(h('div'), h('div')), []);
  });

  it('returns no patches for identical props', () => {
    assert.deepEqual(diff(h('div', { id: 'x' }), h('div', { id: 'x' })), []);
  });

  it('returns no patches for identical nested trees', () => {
    const tree = h('div', null, h('span', null, 'text'));
    assert.deepEqual(diff(tree, tree), []);
  });
});

describe('diff() – text changes', () => {
  it('emits a TEXT patch when text content changes', () => {
    const patches = diff('old', 'new');
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.TEXT);
    assert.deepEqual(patches[0].path, []);
    assert.equal(patches[0].payload, 'new');
  });
});

describe('diff() – CREATE / DELETE', () => {
  it('emits CREATE when old is null', () => {
    const newNode = h('div');
    const patches = diff(null, newNode);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.CREATE);
    assert.deepEqual(patches[0].path, []);
  });

  it('emits DELETE when new is null', () => {
    const patches = diff(h('div'), null);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.DELETE);
    assert.deepEqual(patches[0].path, []);
  });
});

describe('diff() – REPLACE', () => {
  it('emits REPLACE when element type changes', () => {
    const patches = diff(h('div'), h('span'));
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.REPLACE);
    assert.deepEqual(patches[0].path, []);
    assert.equal(/** @type {any} */ (patches[0].payload).type, 'span');
  });

  it('emits REPLACE when switching from string to element', () => {
    const patches = diff('text', h('span'));
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.REPLACE);
  });

  it('emits REPLACE when switching from element to string', () => {
    const patches = diff(h('span'), 'text');
    assert.equal(patches.length, 1);
    assert.equal(patches[0].type, PatchType.REPLACE);
  });
});

describe('diff() – UPDATE_PROPS', () => {
  it('detects an added prop', () => {
    const patches = diff(h('div'), h('div', { id: 'new' }));
    const propPatch = patches.find((p) => p.type === PatchType.UPDATE_PROPS);
    assert.ok(propPatch);
    assert.deepEqual(/** @type {any} */ (propPatch.payload).added, { id: 'new' });
  });

  it('detects a removed prop', () => {
    const patches = diff(h('div', { id: 'old' }), h('div'));
    const propPatch = patches.find((p) => p.type === PatchType.UPDATE_PROPS);
    assert.ok(propPatch);
    assert.deepEqual(/** @type {any} */ (propPatch.payload).removed, ['id']);
  });

  it('detects an updated prop', () => {
    const patches = diff(h('div', { id: 'a' }), h('div', { id: 'b' }));
    const propPatch = patches.find((p) => p.type === PatchType.UPDATE_PROPS);
    assert.ok(propPatch);
    assert.deepEqual(/** @type {any} */ (propPatch.payload).updated, { id: 'b' });
  });

  it('emits no UPDATE_PROPS patch when props are unchanged', () => {
    const patches = diff(h('div', { id: 'same' }), h('div', { id: 'same' }));
    assert.equal(patches.filter((p) => p.type === PatchType.UPDATE_PROPS).length, 0);
  });
});

describe('diff() – children', () => {
  it('detects an added child', () => {
    const oldTree = h('div');
    const newTree = h('div', null, h('span'));
    const patches = diff(oldTree, newTree);
    const childPatch = patches.find(
      (p) => p.type === PatchType.CREATE && p.path.length > 0,
    );
    assert.ok(childPatch);
  });

  it('detects a removed child', () => {
    const oldTree = h('div', null, h('span'));
    const newTree = h('div');
    const patches = diff(oldTree, newTree);
    const childPatch = patches.find(
      (p) => p.type === PatchType.DELETE && p.path.length > 0,
    );
    assert.ok(childPatch);
  });

  it('detects a changed text child', () => {
    const oldTree = h('p', null, 'old text');
    const newTree = h('p', null, 'new text');
    const patches = diff(oldTree, newTree);
    const textPatch = patches.find(
      (p) => p.type === PatchType.TEXT && p.path.length > 0,
    );
    assert.ok(textPatch);
    assert.equal(textPatch.payload, 'new text');
  });

  it('detects a replaced child (type change)', () => {
    const oldTree = h('div', null, h('span'));
    const newTree = h('div', null, h('strong'));
    const patches = diff(oldTree, newTree);
    const replacePatch = patches.find(
      (p) => p.type === PatchType.REPLACE && p.path.length > 0,
    );
    assert.ok(replacePatch);
    assert.equal(/** @type {any} */ (replacePatch.payload).type, 'strong');
  });

  it('no patches for identical children', () => {
    const tree = h('div', null, h('span', null, 'x'), h('p', null, 'y'));
    const patches = diff(tree, tree);
    assert.deepEqual(patches, []);
  });
});

// ─── patch() ─────────────────────────────────────────────────────────────────

describe('patch()', () => {
  it('returns the same tree when patches is empty', () => {
    const tree = h('div', { id: 'root' }, h('span', null, 'hello'));
    const result = patch(tree, []);
    assert.equal(result, tree);
  });

  it('applying CREATE on null produces the new node', () => {
    const newNode = h('div', { id: 'created' });
    const result = patch(null, diff(null, newNode));
    assert.ok(result && typeof result !== 'string');
    assert.equal(result.type, 'div');
    assert.equal(result.props['id'], 'created');
  });

  it('applying DELETE produces null', () => {
    const result = patch(h('div'), diff(h('div'), null));
    assert.equal(result, null);
  });

  it('applying REPLACE replaces the root node', () => {
    const oldTree = h('div');
    const newTree = h('span', { class: 'new' });
    const result = patch(oldTree, diff(oldTree, newTree));
    assert.ok(result && typeof result !== 'string');
    assert.equal(result.type, 'span');
    assert.equal(result.props['class'], 'new');
  });

  it('applying TEXT patch updates a text root', () => {
    const result = patch('old', diff('old', 'new'));
    assert.equal(result, 'new');
  });

  it('applying UPDATE_PROPS adds a prop', () => {
    const oldTree = h('div');
    const newTree = h('div', { id: 'box' });
    const result = patch(oldTree, diff(oldTree, newTree));
    assert.ok(result && typeof result !== 'string');
    assert.equal(result.props['id'], 'box');
  });

  it('applying UPDATE_PROPS removes a prop', () => {
    const oldTree = h('div', { id: 'box', class: 'c' });
    const newTree = h('div', { class: 'c' });
    const result = patch(oldTree, diff(oldTree, newTree));
    assert.ok(result && typeof result !== 'string');
    assert.ok(!('id' in result.props));
    assert.equal(result.props['class'], 'c');
  });

  it('applying UPDATE_PROPS updates a prop value', () => {
    const oldTree = h('div', { id: 'old' });
    const newTree = h('div', { id: 'new' });
    const result = patch(oldTree, diff(oldTree, newTree));
    assert.ok(result && typeof result !== 'string');
    assert.equal(result.props['id'], 'new');
  });

  it('diff(old, new) → patch(old, …) produces equivalent tree to new', () => {
    const oldTree = h('div', { id: 'root' },
      h('h1', null, 'Title'),
      h('p', { class: 'body' }, 'Old paragraph'),
    );
    const newTree = h('div', { id: 'root', 'data-v': '2' },
      h('h1', null, 'Title'),
      h('p', { class: 'body' }, 'New paragraph'),
    );

    const patches = diff(oldTree, newTree);
    const result = patch(oldTree, patches);

    assert.ok(result && typeof result !== 'string');
    // Root prop added
    assert.equal(result.props['data-v'], '2');
    // First child unchanged (h1 title)
    const h1 = /** @type {any} */ (result.children[0]);
    assert.equal(h1.type, 'h1');
    // Second child text updated
    const p = /** @type {any} */ (result.children[1]);
    assert.equal(p.type, 'p');
    const pText = /** @type {any} */ (p.children[0]);
    assert.equal(pText, 'New paragraph');
  });

  it('diff(old, new) on added child → patched tree has the new child', () => {
    const oldTree = h('ul', null, h('li', null, 'one'));
    const newTree = h('ul', null, h('li', null, 'one'), h('li', null, 'two'));
    const result = patch(oldTree, diff(oldTree, newTree));

    assert.ok(result && typeof result !== 'string');
    assert.equal(result.children.length, 2);
    assert.equal(/** @type {any} */ (result.children[1]).type, 'li');
  });
});
