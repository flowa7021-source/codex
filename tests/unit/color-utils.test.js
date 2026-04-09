// ─── Unit Tests: Color Utilities ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  lighten,
  darken,
  mixColors,
  getLuminance,
  getContrastRatio,
  getReadableTextColor,
} from '../../app/modules/color-utils.js';

// ─── hexToRgb ────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses a 6-char hex color', () => {
    assert.deepEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses lowercase 6-char hex', () => {
    assert.deepEqual(hexToRgb('#00ff00'), { r: 0, g: 255, b: 0 });
  });

  it('parses blue', () => {
    assert.deepEqual(hexToRgb('#0000ff'), { r: 0, g: 0, b: 255 });
  });

  it('parses white', () => {
    assert.deepEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 });
  });

  it('parses black', () => {
    assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  });

  it('parses a 3-char hex color', () => {
    assert.deepEqual(hexToRgb('#f00'), { r: 255, g: 0, b: 0 });
  });

  it('parses a 3-char hex shorthand correctly', () => {
    assert.deepEqual(hexToRgb('#abc'), { r: 170, g: 187, b: 204 });
  });

  it('returns null for empty string', () => {
    assert.equal(hexToRgb(''), null);
  });

  it('returns null for a non-hex string', () => {
    assert.equal(hexToRgb('not-a-color'), null);
  });

  it('returns null for 5-char hex', () => {
    assert.equal(hexToRgb('#12345'), null);
  });

  it('returns null for invalid hex digits in 6-char form', () => {
    assert.equal(hexToRgb('#zzzzzz'), null);
  });

  it('returns null for a non-string input', () => {
    assert.equal(hexToRgb(/** @type {any} */ (null)), null);
  });
});

// ─── rgbToHex ────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts red to #ff0000', () => {
    assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  });

  it('converts black to #000000', () => {
    assert.equal(rgbToHex(0, 0, 0), '#000000');
  });

  it('converts white to #ffffff', () => {
    assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  });

  it('pads single hex digit components', () => {
    assert.equal(rgbToHex(0, 1, 15), '#00010f');
  });

  it('round-trips with hexToRgb', () => {
    const original = '#3a7bc8';
    const rgb = hexToRgb(original);
    assert.ok(rgb);
    assert.equal(rgbToHex(rgb.r, rgb.g, rgb.b), original);
  });

  it('clamps values above 255', () => {
    assert.equal(rgbToHex(300, 0, 0), '#ff0000');
  });

  it('clamps negative values to 0', () => {
    assert.equal(rgbToHex(-10, 0, 0), '#000000');
  });
});

// ─── rgbToHsl ────────────────────────────────────────────────────────────────

describe('rgbToHsl', () => {
  it('converts red to h=0, s=100, l=50', () => {
    assert.deepEqual(rgbToHsl(255, 0, 0), { h: 0, s: 100, l: 50 });
  });

  it('converts white to h=0, s=0, l=100', () => {
    assert.deepEqual(rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 100 });
  });

  it('converts black to h=0, s=0, l=0', () => {
    assert.deepEqual(rgbToHsl(0, 0, 0), { h: 0, s: 0, l: 0 });
  });

  it('converts lime green (0,255,0) to h=120', () => {
    const hsl = rgbToHsl(0, 255, 0);
    assert.equal(hsl.h, 120);
    assert.equal(hsl.s, 100);
    assert.equal(hsl.l, 50);
  });

  it('converts blue (0,0,255) to h=240', () => {
    const hsl = rgbToHsl(0, 0, 255);
    assert.equal(hsl.h, 240);
  });

  it('returns l=50 for fully saturated primary colors', () => {
    assert.equal(rgbToHsl(255, 0, 0).l, 50);
    assert.equal(rgbToHsl(0, 255, 0).l, 50);
    assert.equal(rgbToHsl(0, 0, 255).l, 50);
  });
});

// ─── hslToRgb ────────────────────────────────────────────────────────────────

describe('hslToRgb', () => {
  it('converts h=0, s=100, l=50 back to red', () => {
    assert.deepEqual(hslToRgb(0, 100, 50), { r: 255, g: 0, b: 0 });
  });

  it('converts h=0, s=0, l=100 to white', () => {
    assert.deepEqual(hslToRgb(0, 0, 100), { r: 255, g: 255, b: 255 });
  });

  it('converts h=0, s=0, l=0 to black', () => {
    assert.deepEqual(hslToRgb(0, 0, 0), { r: 0, g: 0, b: 0 });
  });

  it('round-trips with rgbToHsl for red', () => {
    const original = { r: 255, g: 0, b: 0 };
    const hsl = rgbToHsl(original.r, original.g, original.b);
    assert.deepEqual(hslToRgb(hsl.h, hsl.s, hsl.l), original);
  });

  it('round-trips with rgbToHsl for a mid-tone color', () => {
    const original = { r: 100, g: 149, b: 237 }; // cornflower blue
    const hsl = rgbToHsl(original.r, original.g, original.b);
    const result = hslToRgb(hsl.h, hsl.s, hsl.l);
    // allow ±1 rounding tolerance
    assert.ok(Math.abs(result.r - original.r) <= 1, `r: ${result.r} vs ${original.r}`);
    assert.ok(Math.abs(result.g - original.g) <= 1, `g: ${result.g} vs ${original.g}`);
    assert.ok(Math.abs(result.b - original.b) <= 1, `b: ${result.b} vs ${original.b}`);
  });

  it('round-trips with rgbToHsl for green', () => {
    const original = { r: 0, g: 128, b: 0 };
    const hsl = rgbToHsl(original.r, original.g, original.b);
    const result = hslToRgb(hsl.h, hsl.s, hsl.l);
    assert.ok(Math.abs(result.r - original.r) <= 1);
    assert.ok(Math.abs(result.g - original.g) <= 1);
    assert.ok(Math.abs(result.b - original.b) <= 1);
  });
});

// ─── lighten ─────────────────────────────────────────────────────────────────

describe('lighten', () => {
  it('returns a lighter color', () => {
    const original = '#336699';
    const lightened = lighten(original, 20);
    const origHsl = rgbToHsl(...Object.values(hexToRgb(original)));
    const newHsl = rgbToHsl(...Object.values(hexToRgb(lightened)));
    assert.ok(newHsl.l > origHsl.l, `Expected l ${newHsl.l} > ${origHsl.l}`);
  });

  it('does not exceed l=100', () => {
    const result = lighten('#ffffff', 50);
    const hsl = rgbToHsl(...Object.values(hexToRgb(result)));
    assert.equal(hsl.l, 100);
  });

  it('returns the same color when amount is 0', () => {
    assert.equal(lighten('#336699', 0), '#336699');
  });

  it('returns the hex unchanged for invalid input', () => {
    assert.equal(lighten('invalid', 10), 'invalid');
  });
});

// ─── darken ──────────────────────────────────────────────────────────────────

describe('darken', () => {
  it('returns a darker color', () => {
    const original = '#336699';
    const darkened = darken(original, 20);
    const origHsl = rgbToHsl(...Object.values(hexToRgb(original)));
    const newHsl = rgbToHsl(...Object.values(hexToRgb(darkened)));
    assert.ok(newHsl.l < origHsl.l, `Expected l ${newHsl.l} < ${origHsl.l}`);
  });

  it('does not go below l=0', () => {
    const result = darken('#000000', 50);
    const hsl = rgbToHsl(...Object.values(hexToRgb(result)));
    assert.equal(hsl.l, 0);
  });

  it('returns the same color when amount is 0', () => {
    assert.equal(darken('#336699', 0), '#336699');
  });

  it('returns the hex unchanged for invalid input', () => {
    assert.equal(darken('invalid', 10), 'invalid');
  });
});

// ─── mixColors ───────────────────────────────────────────────────────────────

describe('mixColors', () => {
  it('ratio 0 returns color1', () => {
    assert.equal(mixColors('#ff0000', '#0000ff', 0), '#ff0000');
  });

  it('ratio 1 returns color2', () => {
    assert.equal(mixColors('#ff0000', '#0000ff', 1), '#0000ff');
  });

  it('ratio 0.5 returns an even mix', () => {
    const result = mixColors('#ff0000', '#0000ff', 0.5);
    const rgb = hexToRgb(result);
    assert.ok(rgb);
    assert.equal(rgb.r, 128);
    assert.equal(rgb.g, 0);
    assert.equal(rgb.b, 128);
  });

  it('mixing black and white at 0.5 gives mid-grey', () => {
    const result = mixColors('#000000', '#ffffff', 0.5);
    const rgb = hexToRgb(result);
    assert.ok(rgb);
    assert.ok(rgb.r >= 127 && rgb.r <= 128, `Expected ~128, got ${rgb.r}`);
    assert.equal(rgb.r, rgb.g);
    assert.equal(rgb.g, rgb.b);
  });

  it('returns hex1 for invalid hex2', () => {
    assert.equal(mixColors('#ff0000', 'invalid', 0.5), '#ff0000');
  });
});

// ─── getLuminance ─────────────────────────────────────────────────────────────

describe('getLuminance', () => {
  it('white has luminance 1.0', () => {
    assert.equal(getLuminance('#ffffff'), 1);
  });

  it('black has luminance 0.0', () => {
    assert.equal(getLuminance('#000000'), 0);
  });

  it('returns a value between 0 and 1', () => {
    const lum = getLuminance('#336699');
    assert.ok(lum >= 0 && lum <= 1, `Expected 0..1, got ${lum}`);
  });

  it('red is less luminant than white', () => {
    assert.ok(getLuminance('#ff0000') < getLuminance('#ffffff'));
  });
});

// ─── getContrastRatio ─────────────────────────────────────────────────────────

describe('getContrastRatio', () => {
  it('white on black is 21:1', () => {
    assert.equal(getContrastRatio('#ffffff', '#000000'), 21);
  });

  it('same color contrast ratio is 1', () => {
    assert.equal(getContrastRatio('#336699', '#336699'), 1);
  });

  it('returns a value between 1 and 21', () => {
    const ratio = getContrastRatio('#336699', '#ffffff');
    assert.ok(ratio >= 1 && ratio <= 21, `Expected 1..21, got ${ratio}`);
  });

  it('is symmetric (order of colors does not matter)', () => {
    const r1 = getContrastRatio('#336699', '#ffffff');
    const r2 = getContrastRatio('#ffffff', '#336699');
    assert.equal(r1, r2);
  });
});

// ─── getReadableTextColor ────────────────────────────────────────────────────

describe('getReadableTextColor', () => {
  it('returns #000000 for a white background', () => {
    assert.equal(getReadableTextColor('#ffffff'), '#000000');
  });

  it('returns #ffffff for a black background', () => {
    assert.equal(getReadableTextColor('#000000'), '#ffffff');
  });

  it('returns a valid color string for any hex', () => {
    const result = getReadableTextColor('#336699');
    assert.ok(result === '#000000' || result === '#ffffff');
  });

  it('returns #ffffff for a dark color', () => {
    assert.equal(getReadableTextColor('#1a1a2e'), '#ffffff');
  });

  it('returns #000000 for a light color', () => {
    assert.equal(getReadableTextColor('#f0f0f0'), '#000000');
  });
});
