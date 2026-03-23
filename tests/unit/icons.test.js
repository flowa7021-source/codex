import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { icons, icon } from '../../app/modules/icons.js';

describe('icons', () => {
  describe('icons map', () => {
    it('exports a non-empty icons object', () => {
      assert.ok(typeof icons === 'object');
      assert.ok(Object.keys(icons).length > 30);
    });

    it('each icon value is a valid SVG string', () => {
      for (const [name, svg] of Object.entries(icons)) {
        assert.ok(svg.startsWith('<svg'), `Icon "${name}" should start with <svg`);
        assert.ok(svg.endsWith('</svg>'), `Icon "${name}" should end with </svg>`);
      }
    });

    it('icons have correct default size attributes (16x16)', () => {
      const svg = icons.search;
      assert.ok(svg.includes('width="16"'));
      assert.ok(svg.includes('height="16"'));
    });

    it('contains commonly expected icon names', () => {
      const expected = ['search', 'save', 'trash', 'settings', 'x', 'zoomIn', 'zoomOut', 'eye'];
      for (const name of expected) {
        assert.ok(name in icons, `Expected icon "${name}" to exist`);
      }
    });
  });

  describe('icon()', () => {
    it('returns the SVG string for a known icon', () => {
      const result = icon('search');
      assert.ok(result.includes('<svg'));
      assert.ok(result.includes('<circle'));
    });

    it('returns empty string for unknown icon', () => {
      assert.strictEqual(icon('nonexistent'), '');
    });

    it('returns default size when no size is given', () => {
      const result = icon('search');
      assert.ok(result.includes('width="16"'));
      assert.ok(result.includes('height="16"'));
    });

    it('overrides size when custom size is given', () => {
      const result = icon('search', 24);
      assert.ok(result.includes('width="24"'));
      assert.ok(result.includes('height="24"'));
    });

    it('returns empty string for unknown icon with custom size', () => {
      assert.strictEqual(icon('nonexistent', 24), '');
    });

    it('returns same as icons map when size is 16', () => {
      assert.strictEqual(icon('search', 16), icons.search);
    });
  });
});
