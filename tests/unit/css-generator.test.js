// ─── Unit Tests: css-generator ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  styleToString,
  parseInlineStyle,
  cssVars,
  classNames,
  camelToKebab,
  kebabToCamel,
  mediaQuery,
  keyframes,
  escapeSelector,
  mergeStyles,
} from '../../app/modules/css-generator.js';

// ─── styleToString ───────────────────────────────────────────────────────────

describe('styleToString', () => {
  it('converts a single property', () => {
    assert.equal(styleToString({ color: 'red' }), 'color: red;');
  });

  it('converts camelCase to kebab-case', () => {
    assert.equal(styleToString({ backgroundColor: 'blue' }), 'background-color: blue;');
  });

  it('handles numeric values', () => {
    assert.equal(styleToString({ zIndex: 10 }), 'z-index: 10;');
  });

  it('converts multiple properties', () => {
    const result = styleToString({ color: 'red', fontSize: '16px' });
    assert.ok(result.includes('color: red;'), `Missing color: ${result}`);
    assert.ok(result.includes('font-size: 16px;'), `Missing font-size: ${result}`);
  });

  it('returns empty string for empty object', () => {
    assert.equal(styleToString({}), '');
  });
});

// ─── parseInlineStyle ────────────────────────────────────────────────────────

describe('parseInlineStyle', () => {
  it('parses a single declaration', () => {
    assert.deepEqual(parseInlineStyle('color: red;'), { color: 'red' });
  });

  it('converts kebab-case to camelCase', () => {
    assert.deepEqual(parseInlineStyle('background-color: blue;'), { backgroundColor: 'blue' });
  });

  it('parses multiple declarations', () => {
    const result = parseInlineStyle('color: red; font-size: 16px;');
    assert.equal(result.color, 'red');
    assert.equal(result.fontSize, '16px');
  });

  it('handles trailing semicolons and whitespace', () => {
    const result = parseInlineStyle('  color : red ;  ');
    assert.equal(result.color, 'red');
  });

  it('returns empty object for empty string', () => {
    assert.deepEqual(parseInlineStyle(''), {});
  });

  it('ignores malformed declarations without colon', () => {
    const result = parseInlineStyle('color: red; badentry; margin: 0;');
    assert.equal(result.color, 'red');
    assert.equal(result.margin, '0');
    assert.ok(!('badentry' in result));
  });
});

// ─── cssVars ─────────────────────────────────────────────────────────────────

describe('cssVars', () => {
  it('generates custom property declarations', () => {
    const result = cssVars({ primary: '#ff0000' });
    assert.ok(result.includes('--primary: #ff0000;'), `Result: ${result}`);
  });

  it('uses prefix when provided', () => {
    const result = cssVars({ color: 'blue' }, 'brand');
    assert.ok(result.includes('--brand-color: blue;'), `Result: ${result}`);
  });

  it('handles numeric values', () => {
    const result = cssVars({ spacing: 8 });
    assert.ok(result.includes('--spacing: 8;'), `Result: ${result}`);
  });

  it('returns empty string for empty vars', () => {
    assert.equal(cssVars({}), '');
  });

  it('generates multiple declarations', () => {
    const result = cssVars({ a: '1', b: '2' });
    assert.ok(result.includes('--a: 1;'), `Missing --a: ${result}`);
    assert.ok(result.includes('--b: 2;'), `Missing --b: ${result}`);
  });
});

// ─── classNames ──────────────────────────────────────────────────────────────

describe('classNames', () => {
  it('joins string arguments', () => {
    assert.equal(classNames('foo', 'bar'), 'foo bar');
  });

  it('includes class from object when value is true', () => {
    assert.equal(classNames({ active: true, disabled: false }), 'active');
  });

  it('excludes class from object when value is false', () => {
    const result = classNames({ active: false, hidden: false });
    assert.equal(result, '');
  });

  it('mixes strings and conditional objects', () => {
    const result = classNames('btn', { active: true, disabled: false }, 'large');
    assert.ok(result.includes('btn'), `Missing btn: ${result}`);
    assert.ok(result.includes('active'), `Missing active: ${result}`);
    assert.ok(result.includes('large'), `Missing large: ${result}`);
    assert.ok(!result.includes('disabled'), `Should not include disabled: ${result}`);
  });

  it('ignores null and undefined', () => {
    assert.equal(classNames('foo', null, undefined, 'bar'), 'foo bar');
  });

  it('ignores false', () => {
    assert.equal(classNames('foo', false, 'bar'), 'foo bar');
  });

  it('returns empty string for all falsy args', () => {
    assert.equal(classNames(null, undefined, false), '');
  });

  it('trims whitespace from strings', () => {
    assert.equal(classNames('  foo  '), 'foo');
  });
});

// ─── camelToKebab ────────────────────────────────────────────────────────────

describe('camelToKebab', () => {
  it('converts simple camelCase', () => {
    assert.equal(camelToKebab('backgroundColor'), 'background-color');
  });

  it('converts multiple humps', () => {
    assert.equal(camelToKebab('borderTopLeftRadius'), 'border-top-left-radius');
  });

  it('leaves already-kebab strings unchanged', () => {
    assert.equal(camelToKebab('color'), 'color');
  });

  it('handles single word', () => {
    assert.equal(camelToKebab('margin'), 'margin');
  });

  it('converts zIndex correctly', () => {
    assert.equal(camelToKebab('zIndex'), 'z-index');
  });
});

// ─── kebabToCamel ────────────────────────────────────────────────────────────

describe('kebabToCamel', () => {
  it('converts kebab-case to camelCase', () => {
    assert.equal(kebabToCamel('background-color'), 'backgroundColor');
  });

  it('handles multiple hyphens', () => {
    assert.equal(kebabToCamel('border-top-left-radius'), 'borderTopLeftRadius');
  });

  it('leaves already-camel strings unchanged', () => {
    assert.equal(kebabToCamel('color'), 'color');
  });

  it('round-trips with camelToKebab', () => {
    assert.equal(kebabToCamel(camelToKebab('fontSize')), 'fontSize');
    assert.equal(camelToKebab(kebabToCamel('font-size')), 'font-size');
  });
});

// ─── mediaQuery ──────────────────────────────────────────────────────────────

describe('mediaQuery', () => {
  it('generates a media query string', () => {
    const result = mediaQuery('(max-width: 768px)', { display: 'none' });
    assert.ok(result.startsWith('@media (max-width: 768px)'), `Result: ${result}`);
    assert.ok(result.includes('display: none;'), `Missing style: ${result}`);
  });

  it('includes the condition verbatim', () => {
    const result = mediaQuery('screen and (min-width: 1024px)', { color: 'blue' });
    assert.ok(result.includes('screen and (min-width: 1024px)'), `Result: ${result}`);
  });

  it('handles multiple styles', () => {
    const result = mediaQuery('print', { color: 'black', fontSize: '12px' });
    assert.ok(result.includes('color: black;'), `Missing color: ${result}`);
    assert.ok(result.includes('font-size: 12px;'), `Missing font-size: ${result}`);
  });
});

// ─── keyframes ───────────────────────────────────────────────────────────────

describe('keyframes', () => {
  it('generates an @keyframes rule', () => {
    const result = keyframes('fade', {
      from: { opacity: 0 },
      to: { opacity: 1 },
    });
    assert.ok(result.startsWith('@keyframes fade'), `Result: ${result}`);
    assert.ok(result.includes('from'), `Missing from: ${result}`);
    assert.ok(result.includes('to'), `Missing to: ${result}`);
    assert.ok(result.includes('opacity: 0;'), `Missing opacity 0: ${result}`);
    assert.ok(result.includes('opacity: 1;'), `Missing opacity 1: ${result}`);
  });

  it('includes percentage stops', () => {
    const result = keyframes('slide', {
      '0%': { transform: 'translateX(0)' },
      '100%': { transform: 'translateX(100px)' },
    });
    assert.ok(result.includes('0%'), `Missing 0%: ${result}`);
    assert.ok(result.includes('100%'), `Missing 100%: ${result}`);
  });
});

// ─── escapeSelector ──────────────────────────────────────────────────────────

describe('escapeSelector', () => {
  it('escapes dots', () => {
    const result = escapeSelector('my.class');
    assert.ok(result.includes('\\.'), `Result: ${result}`);
  });

  it('escapes hash symbols', () => {
    const result = escapeSelector('my#id');
    assert.ok(result.includes('\\#'), `Result: ${result}`);
  });

  it('escapes brackets', () => {
    const result = escapeSelector('input[type]');
    assert.ok(result.includes('\\['), `Result: ${result}`);
    assert.ok(result.includes('\\]'), `Result: ${result}`);
  });

  it('leaves simple alphanumeric selectors unchanged', () => {
    assert.equal(escapeSelector('myClass'), 'myClass');
  });

  it('escapes colons', () => {
    const result = escapeSelector('a:hover');
    assert.ok(result.includes('\\:'), `Result: ${result}`);
  });
});

// ─── mergeStyles ─────────────────────────────────────────────────────────────

describe('mergeStyles', () => {
  it('merges two style objects', () => {
    const result = mergeStyles({ color: 'red' }, { fontSize: '16px' });
    assert.equal(result.color, 'red');
    assert.equal(result.fontSize, '16px');
  });

  it('later styles override earlier ones', () => {
    const result = mergeStyles({ color: 'red', margin: '0' }, { color: 'blue' });
    assert.equal(result.color, 'blue');
    assert.equal(result.margin, '0');
  });

  it('handles empty objects', () => {
    assert.deepEqual(mergeStyles({}, { color: 'red' }), { color: 'red' });
    assert.deepEqual(mergeStyles({ color: 'red' }, {}), { color: 'red' });
  });

  it('handles a single style object', () => {
    assert.deepEqual(mergeStyles({ color: 'red' }), { color: 'red' });
  });

  it('merges three or more style objects', () => {
    const result = mergeStyles({ a: '1' }, { b: '2' }, { c: '3', a: '4' });
    assert.equal(result.a, '4');
    assert.equal(result.b, '2');
    assert.equal(result.c, '3');
  });

  it('does not mutate input objects', () => {
    const s1 = { color: 'red' };
    const s2 = { color: 'blue' };
    mergeStyles(s1, s2);
    assert.equal(s1.color, 'red');
  });
});
