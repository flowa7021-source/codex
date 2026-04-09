// ─── Unit Tests: svg-utils ────────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  SVG_NS,
  createSVGElement,
  createSVG,
  createPath,
  createCircle,
  createRect,
  createLine,
  createSVGText,
  setSVGAttrs,
  svgToString,
  createIcon,
} from '../../app/modules/svg-utils.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

before(() => {
  globalThis.document.createElementNS = (ns, tag) => {
    const el = globalThis.document.createElement(tag);
    el.namespaceURI = ns;
    el._attrs = {};
    el.setAttribute = (k, v) => { el._attrs[k] = String(v); };
    el.getAttribute = (k) => el._attrs[k] ?? null;
    el.setAttributeNS = (ns, k, v) => { el._attrs[k] = String(v); };
    el.hasAttribute = (k) => Object.prototype.hasOwnProperty.call(el._attrs, k);
    el.appendChild = (child) => { el.children.push(child); return child; };
    return el;
  };

  globalThis.XMLSerializer = class XMLSerializer {
    serializeToString(el) { return `<${el.tagName}></${el.tagName}>`; }
  };
});

// ─── SVG_NS ───────────────────────────────────────────────────────────────────

describe('SVG_NS', () => {
  it('is the correct SVG namespace string', () => {
    assert.equal(SVG_NS, 'http://www.w3.org/2000/svg');
  });

  it('is a string', () => {
    assert.equal(typeof SVG_NS, 'string');
  });
});

// ─── createSVGElement ─────────────────────────────────────────────────────────

describe('createSVGElement', () => {
  it('creates an element using the SVG namespace', () => {
    const el = createSVGElement('circle');
    assert.equal(el.namespaceURI, SVG_NS);
  });

  it('creates an element with the correct tag', () => {
    const el = createSVGElement('path');
    assert.equal(el.tagName.toLowerCase(), 'path');
  });

  it('sets attributes when provided', () => {
    const el = createSVGElement('rect', { width: 100, height: 50 });
    assert.equal(el.getAttribute('width'), '100');
    assert.equal(el.getAttribute('height'), '50');
  });

  it('converts numeric attributes to strings', () => {
    const el = createSVGElement('circle', { r: 10 });
    assert.equal(typeof el.getAttribute('r'), 'string');
    assert.equal(el.getAttribute('r'), '10');
  });

  it('creates element without attrs when none provided', () => {
    const el = createSVGElement('g');
    assert.ok(el);
    assert.equal(el.tagName.toLowerCase(), 'g');
  });
});

// ─── createSVG ───────────────────────────────────────────────────────────────

describe('createSVG', () => {
  it('creates an SVG element', () => {
    const svg = createSVG('0 0 24 24');
    assert.equal(svg.tagName.toLowerCase(), 'svg');
  });

  it('sets the viewBox attribute', () => {
    const svg = createSVG('0 0 100 100');
    assert.equal(svg.getAttribute('viewBox'), '0 0 100 100');
  });

  it('sets width and height when provided', () => {
    const svg = createSVG('0 0 24 24', 24, 24);
    assert.equal(svg.getAttribute('width'), '24');
    assert.equal(svg.getAttribute('height'), '24');
  });

  it('sets string width and height', () => {
    const svg = createSVG('0 0 100 100', '100%', '100%');
    assert.equal(svg.getAttribute('width'), '100%');
    assert.equal(svg.getAttribute('height'), '100%');
  });

  it('does not set width/height when not provided', () => {
    const svg = createSVG('0 0 24 24');
    // Should only have viewBox and xmlns, not width/height
    assert.equal(svg.getAttribute('width'), null);
    assert.equal(svg.getAttribute('height'), null);
  });

  it('sets the SVG namespace', () => {
    const svg = createSVG('0 0 24 24');
    assert.equal(svg.namespaceURI, SVG_NS);
  });
});

// ─── createPath ───────────────────────────────────────────────────────────────

describe('createPath', () => {
  it('creates a path element', () => {
    const path = createPath('M 0 0 L 10 10');
    assert.equal(path.tagName.toLowerCase(), 'path');
  });

  it('sets the d attribute', () => {
    const d = 'M10 10 H 90 V 90 H 10 Z';
    const path = createPath(d);
    assert.equal(path.getAttribute('d'), d);
  });

  it('applies extra attributes', () => {
    const path = createPath('M 0 0', { fill: 'red', stroke: 'blue' });
    assert.equal(path.getAttribute('fill'), 'red');
    assert.equal(path.getAttribute('stroke'), 'blue');
  });

  it('extra attrs do not override d', () => {
    const path = createPath('M 5 5', { stroke: 'none' });
    assert.equal(path.getAttribute('d'), 'M 5 5');
  });
});

// ─── createCircle ─────────────────────────────────────────────────────────────

describe('createCircle', () => {
  it('creates a circle element', () => {
    const circle = createCircle(50, 50, 25);
    assert.equal(circle.tagName.toLowerCase(), 'circle');
  });

  it('sets cx, cy, and r attributes', () => {
    const circle = createCircle(10, 20, 5);
    assert.equal(circle.getAttribute('cx'), '10');
    assert.equal(circle.getAttribute('cy'), '20');
    assert.equal(circle.getAttribute('r'), '5');
  });

  it('applies extra attributes', () => {
    const circle = createCircle(0, 0, 10, { fill: 'green' });
    assert.equal(circle.getAttribute('fill'), 'green');
  });
});

// ─── createRect ───────────────────────────────────────────────────────────────

describe('createRect', () => {
  it('creates a rect element', () => {
    const rect = createRect(0, 0, 100, 50);
    assert.equal(rect.tagName.toLowerCase(), 'rect');
  });

  it('sets x, y, width, and height attributes', () => {
    const rect = createRect(5, 10, 80, 40);
    assert.equal(rect.getAttribute('x'), '5');
    assert.equal(rect.getAttribute('y'), '10');
    assert.equal(rect.getAttribute('width'), '80');
    assert.equal(rect.getAttribute('height'), '40');
  });

  it('applies extra attributes', () => {
    const rect = createRect(0, 0, 10, 10, { rx: '4', fill: 'blue' });
    assert.equal(rect.getAttribute('rx'), '4');
    assert.equal(rect.getAttribute('fill'), 'blue');
  });
});

// ─── createLine ───────────────────────────────────────────────────────────────

describe('createLine', () => {
  it('creates a line element', () => {
    const line = createLine(0, 0, 100, 100);
    assert.equal(line.tagName.toLowerCase(), 'line');
  });

  it('sets x1, y1, x2, y2 attributes', () => {
    const line = createLine(1, 2, 3, 4);
    assert.equal(line.getAttribute('x1'), '1');
    assert.equal(line.getAttribute('y1'), '2');
    assert.equal(line.getAttribute('x2'), '3');
    assert.equal(line.getAttribute('y2'), '4');
  });

  it('applies extra attributes', () => {
    const line = createLine(0, 0, 10, 10, { stroke: 'black' });
    assert.equal(line.getAttribute('stroke'), 'black');
  });
});

// ─── createSVGText ────────────────────────────────────────────────────────────

describe('createSVGText', () => {
  it('creates a text element', () => {
    const text = createSVGText('Hello', 10, 20);
    assert.equal(text.tagName.toLowerCase(), 'text');
  });

  it('sets the text content', () => {
    const text = createSVGText('Hello SVG', 0, 0);
    assert.equal(text.textContent, 'Hello SVG');
  });

  it('sets x and y attributes', () => {
    const text = createSVGText('Label', 15, 30);
    assert.equal(text.getAttribute('x'), '15');
    assert.equal(text.getAttribute('y'), '30');
  });

  it('applies extra attributes', () => {
    const text = createSVGText('Test', 0, 0, { 'font-size': '14', fill: 'black' });
    assert.equal(text.getAttribute('font-size'), '14');
    assert.equal(text.getAttribute('fill'), 'black');
  });

  it('handles empty string content', () => {
    const text = createSVGText('', 0, 0);
    assert.equal(text.textContent, '');
  });
});

// ─── setSVGAttrs ──────────────────────────────────────────────────────────────

describe('setSVGAttrs', () => {
  it('sets a single attribute', () => {
    const el = createSVGElement('rect');
    setSVGAttrs(el, { fill: 'red' });
    assert.equal(el.getAttribute('fill'), 'red');
  });

  it('sets multiple attributes at once', () => {
    const el = createSVGElement('circle');
    setSVGAttrs(el, { cx: 10, cy: 20, r: 5 });
    assert.equal(el.getAttribute('cx'), '10');
    assert.equal(el.getAttribute('cy'), '20');
    assert.equal(el.getAttribute('r'), '5');
  });

  it('converts numeric values to strings', () => {
    const el = createSVGElement('line');
    setSVGAttrs(el, { 'stroke-width': 2 });
    assert.equal(typeof el.getAttribute('stroke-width'), 'string');
    assert.equal(el.getAttribute('stroke-width'), '2');
  });

  it('overwrites existing attributes', () => {
    const el = createSVGElement('rect');
    setSVGAttrs(el, { fill: 'blue' });
    setSVGAttrs(el, { fill: 'green' });
    assert.equal(el.getAttribute('fill'), 'green');
  });

  it('does not throw on empty attrs object', () => {
    const el = createSVGElement('g');
    assert.doesNotThrow(() => setSVGAttrs(el, {}));
  });
});

// ─── svgToString ──────────────────────────────────────────────────────────────

describe('svgToString', () => {
  it('returns a string', () => {
    const svg = createSVG('0 0 24 24');
    const result = svgToString(svg);
    assert.equal(typeof result, 'string');
  });

  it('returns a non-empty string', () => {
    const svg = createSVG('0 0 24 24');
    const result = svgToString(svg);
    assert.ok(result.length > 0);
  });

  it('includes the tag name in the output', () => {
    const svg = createSVG('0 0 24 24');
    const result = svgToString(svg);
    // Our mock serializer produces <svg></svg>
    assert.ok(result.toLowerCase().includes('svg'));
  });
});

// ─── createIcon ───────────────────────────────────────────────────────────────

describe('createIcon', () => {
  const iconNames = ['chevron-left', 'chevron-right', 'zoom-in', 'zoom-out', 'close', 'menu'];

  for (const name of iconNames) {
    it(`creates an SVG element for icon "${name}"`, () => {
      const icon = createIcon(/** @type {any} */ (name));
      assert.equal(icon.tagName.toLowerCase(), 'svg');
    });

    it(`icon "${name}" has a child path element`, () => {
      const icon = createIcon(/** @type {any} */ (name));
      assert.ok(icon.children.length > 0);
    });
  }

  it('uses default size 24 when not specified', () => {
    const icon = createIcon('close');
    assert.equal(icon.getAttribute('width'), '24');
    assert.equal(icon.getAttribute('height'), '24');
  });

  it('uses custom size when specified', () => {
    const icon = createIcon('menu', 32);
    assert.equal(icon.getAttribute('width'), '32');
    assert.equal(icon.getAttribute('height'), '32');
  });

  it('sets a viewBox attribute', () => {
    const icon = createIcon('zoom-in');
    assert.ok(icon.getAttribute('viewBox'));
  });

  it('sets the SVG namespace on the icon', () => {
    const icon = createIcon('chevron-left');
    assert.equal(icon.namespaceURI, SVG_NS);
  });
});
