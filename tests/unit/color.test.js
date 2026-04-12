// ─── Unit Tests: Color Manipulation & Conversion ──────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseHex,
  parseRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  lighten,
  darken,
  saturate,
  desaturate,
  mix,
  invert,
  grayscale,
  alpha,
  luminance,
  contrast,
  isLight,
  isDark,
} from '../../app/modules/color.js';

// ─── parseHex ─────────────────────────────────────────────────────────────────

describe('parseHex', () => {
  it('parses 6-digit lowercase hex', () => {
    assert.deepEqual(parseHex('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses 6-digit uppercase hex', () => {
    assert.deepEqual(parseHex('#FF8800'), { r: 255, g: 136, b: 0 });
  });

  it('parses 3-digit shorthand hex', () => {
    assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  });

  it('expands 3-digit shorthand correctly (#abc → #aabbcc)', () => {
    assert.deepEqual(parseHex('#abc'), { r: 170, g: 187, b: 204 });
  });

  it('parses black #000000', () => {
    assert.deepEqual(parseHex('#000000'), { r: 0, g: 0, b: 0 });
  });

  it('parses white #ffffff', () => {
    assert.deepEqual(parseHex('#ffffff'), { r: 255, g: 255, b: 255 });
  });

  it('throws for missing # prefix', () => {
    assert.throws(() => parseHex('ff0000'), /invalid/i);
  });

  it('throws for 5-digit hex', () => {
    assert.throws(() => parseHex('#ff000'), /invalid/i);
  });

  it('throws for empty string', () => {
    assert.throws(() => parseHex(''), /invalid/i);
  });

  it('throws for non-hex characters', () => {
    assert.throws(() => parseHex('#gggggg'), /invalid/i);
  });
});

// ─── parseRgb ─────────────────────────────────────────────────────────────────

describe('parseRgb', () => {
  it('parses standard rgb() string', () => {
    assert.deepEqual(parseRgb('rgb(255, 0, 0)'), { r: 255, g: 0, b: 0 });
  });

  it('parses rgb() with no spaces', () => {
    assert.deepEqual(parseRgb('rgb(10,20,30)'), { r: 10, g: 20, b: 30 });
  });

  it('parses rgb() with extra spaces', () => {
    assert.deepEqual(parseRgb('rgb( 100 , 200 , 50 )'), { r: 100, g: 200, b: 50 });
  });

  it('clamps values above 255 to 255', () => {
    const result = parseRgb('rgb(300, 0, 0)');
    assert.equal(result.r, 255);
  });

  it('throws for non-rgb format', () => {
    assert.throws(() => parseRgb('#ff0000'), /invalid/i);
  });

  it('throws for hsl() format', () => {
    assert.throws(() => parseRgb('hsl(0,100%,50%)'), /invalid/i);
  });
});

// ─── parseColor ───────────────────────────────────────────────────────────────

describe('parseColor', () => {
  it('auto-detects hex string', () => {
    assert.deepEqual(parseColor('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('auto-detects 3-digit hex string', () => {
    assert.deepEqual(parseColor('#f00'), { r: 255, g: 0, b: 0 });
  });

  it('auto-detects rgb() string', () => {
    assert.deepEqual(parseColor('rgb(0, 128, 255)'), { r: 0, g: 128, b: 255 });
  });

  it('throws for unrecognised format', () => {
    assert.throws(() => parseColor('red'), /unrecognised/i);
  });

  it('throws for hsl() format', () => {
    assert.throws(() => parseColor('hsl(120,100%,50%)'), /unrecognised/i);
  });
});

// ─── rgbToHex ─────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts red to #ff0000', () => {
    assert.equal(rgbToHex({ r: 255, g: 0, b: 0 }), '#ff0000');
  });

  it('converts black to #000000', () => {
    assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
  });

  it('converts white to #ffffff', () => {
    assert.equal(rgbToHex({ r: 255, g: 255, b: 255 }), '#ffffff');
  });

  it('pads single-digit hex components', () => {
    assert.equal(rgbToHex({ r: 1, g: 2, b: 3 }), '#010203');
  });

  it('round-trips with parseHex', () => {
    const hex = '#4a90e2';
    assert.equal(rgbToHex(parseHex(hex)), hex);
  });
});

// ─── rgbToHsl / hslToRgb ─────────────────────────────────────────────────────

describe('rgbToHsl', () => {
  it('red → hsl(0°, 100%, 50%)', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    assert.equal(hsl.h, 0);
    assert.equal(hsl.s, 100);
    assert.equal(hsl.l, 50);
  });

  it('white → hsl(0°, 0%, 100%)', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    assert.equal(hsl.s, 0);
    assert.equal(hsl.l, 100);
  });

  it('black → hsl(0°, 0%, 0%)', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 });
    assert.equal(hsl.s, 0);
    assert.equal(hsl.l, 0);
  });

  it('achromatic gray has saturation 0', () => {
    const hsl = rgbToHsl({ r: 128, g: 128, b: 128 });
    assert.equal(hsl.s, 0);
  });
});

describe('hslToRgb', () => {
  it('hsl(0°, 100%, 50%) → red', () => {
    const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
    assert.equal(rgb.r, 255);
    assert.equal(rgb.g, 0);
    assert.equal(rgb.b, 0);
  });

  it('hsl(0°, 0%, 100%) → white', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 100 });
    assert.equal(rgb.r, 255);
    assert.equal(rgb.g, 255);
    assert.equal(rgb.b, 255);
  });

  it('hsl(0°, 0%, 0%) → black', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 0 });
    assert.equal(rgb.r, 0);
    assert.equal(rgb.g, 0);
    assert.equal(rgb.b, 0);
  });

  it('round-trips through rgbToHsl within rounding tolerance', () => {
    const original = { r: 100, g: 149, b: 237 }; // cornflower blue
    const hsl = rgbToHsl(original);
    const result = hslToRgb(hsl);
    assert.ok(Math.abs(result.r - original.r) <= 2, `r: ${result.r} vs ${original.r}`);
    assert.ok(Math.abs(result.g - original.g) <= 2, `g: ${result.g} vs ${original.g}`);
    assert.ok(Math.abs(result.b - original.b) <= 2, `b: ${result.b} vs ${original.b}`);
  });
});

// ─── rgbToHsv / hsvToRgb ─────────────────────────────────────────────────────

describe('rgbToHsv', () => {
  it('red → hsv(0°, 100%, 100%)', () => {
    const hsv = rgbToHsv({ r: 255, g: 0, b: 0 });
    assert.equal(hsv.h, 0);
    assert.equal(hsv.s, 100);
    assert.equal(hsv.v, 100);
  });

  it('black → hsv(0°, 0%, 0%)', () => {
    const hsv = rgbToHsv({ r: 0, g: 0, b: 0 });
    assert.equal(hsv.s, 0);
    assert.equal(hsv.v, 0);
  });

  it('white → hsv(0°, 0%, 100%)', () => {
    const hsv = rgbToHsv({ r: 255, g: 255, b: 255 });
    assert.equal(hsv.s, 0);
    assert.equal(hsv.v, 100);
  });
});

describe('hsvToRgb', () => {
  it('hsv(0°, 100%, 100%) → red', () => {
    const rgb = hsvToRgb({ h: 0, s: 100, v: 100 });
    assert.equal(rgb.r, 255);
    assert.equal(rgb.g, 0);
    assert.equal(rgb.b, 0);
  });

  it('hsv(120°, 100%, 100%) → green', () => {
    const rgb = hsvToRgb({ h: 120, s: 100, v: 100 });
    assert.equal(rgb.r, 0);
    assert.equal(rgb.g, 255);
    assert.equal(rgb.b, 0);
  });

  it('round-trips through rgbToHsv within rounding tolerance', () => {
    const original = { r: 72, g: 209, b: 204 }; // medium turquoise
    const hsv = rgbToHsv(original);
    const result = hsvToRgb(hsv);
    assert.ok(Math.abs(result.r - original.r) <= 2, `r: ${result.r} vs ${original.r}`);
    assert.ok(Math.abs(result.g - original.g) <= 2, `g: ${result.g} vs ${original.g}`);
    assert.ok(Math.abs(result.b - original.b) <= 2, `b: ${result.b} vs ${original.b}`);
  });
});

// ─── lighten / darken ─────────────────────────────────────────────────────────

describe('lighten', () => {
  it('lighten returns a hex string', () => {
    assert.match(lighten('#336699', 10), /^#[0-9a-f]{6}$/);
  });

  it('lightened color has higher luminance', () => {
    const orig = luminance(parseHex('#336699'));
    const lighter = luminance(parseHex(lighten('#336699', 20)));
    assert.ok(lighter > orig, `expected lighter luminance (${lighter}) > original (${orig})`);
  });

  it('lighten by 0 returns same color', () => {
    assert.equal(lighten('#336699', 0), '#336699');
  });

  it('lighten is clamped at white (100%)', () => {
    const result = lighten('#336699', 100);
    assert.deepEqual(parseHex(result), { r: 255, g: 255, b: 255 });
  });
});

describe('darken', () => {
  it('darken returns a hex string', () => {
    assert.match(darken('#336699', 10), /^#[0-9a-f]{6}$/);
  });

  it('darkened color has lower luminance', () => {
    const orig = luminance(parseHex('#336699'));
    const darker = luminance(parseHex(darken('#336699', 20)));
    assert.ok(darker < orig, `expected darker luminance (${darker}) < original (${orig})`);
  });

  it('darken by 0 returns same color', () => {
    assert.equal(darken('#336699', 0), '#336699');
  });

  it('darken is clamped at black (0%)', () => {
    const result = darken('#336699', 100);
    assert.deepEqual(parseHex(result), { r: 0, g: 0, b: 0 });
  });
});

// ─── saturate / desaturate ────────────────────────────────────────────────────

describe('saturate', () => {
  it('saturate returns a hex string', () => {
    assert.match(saturate('#336699', 20), /^#[0-9a-f]{6}$/);
  });

  it('saturation increases after saturate', () => {
    const origS = rgbToHsl(parseHex('#336699')).s;
    const newS = rgbToHsl(parseHex(saturate('#336699', 20))).s;
    assert.ok(newS > origS, `expected higher saturation: ${newS} > ${origS}`);
  });

  it('saturate by 0 returns same color', () => {
    assert.equal(saturate('#336699', 0), '#336699');
  });

  it('saturate is clamped at 100%', () => {
    const hsl = rgbToHsl(parseHex(saturate('#336699', 200)));
    assert.ok(hsl.s <= 100);
  });
});

describe('desaturate', () => {
  it('desaturate returns a hex string', () => {
    assert.match(desaturate('#336699', 20), /^#[0-9a-f]{6}$/);
  });

  it('saturation decreases after desaturate', () => {
    const origS = rgbToHsl(parseHex('#336699')).s;
    const newS = rgbToHsl(parseHex(desaturate('#336699', 20))).s;
    assert.ok(newS < origS, `expected lower saturation: ${newS} < ${origS}`);
  });

  it('fully desaturated color is grayscale (s === 0)', () => {
    const hsl = rgbToHsl(parseHex(desaturate('#336699', 100)));
    assert.equal(hsl.s, 0);
  });
});

// ─── mix ──────────────────────────────────────────────────────────────────────

describe('mix', () => {
  it('mix at 0.5 blends evenly', () => {
    const result = parseHex(mix('#000000', '#ffffff', 0.5));
    assert.ok(Math.abs(result.r - 128) <= 1);
    assert.ok(Math.abs(result.g - 128) <= 1);
    assert.ok(Math.abs(result.b - 128) <= 1);
  });

  it('mix at weight=1 returns first color', () => {
    assert.equal(mix('#ff0000', '#0000ff', 1), '#ff0000');
  });

  it('mix at weight=0 returns second color', () => {
    assert.equal(mix('#ff0000', '#0000ff', 0), '#0000ff');
  });

  it('default weight is 0.5 (even blend)', () => {
    assert.equal(mix('#000000', '#ffffff'), mix('#000000', '#ffffff', 0.5));
  });

  it('returns a valid hex string', () => {
    assert.match(mix('#336699', '#ff6600', 0.3), /^#[0-9a-f]{6}$/);
  });
});

// ─── invert ───────────────────────────────────────────────────────────────────

describe('invert', () => {
  it('inverts black to white', () => {
    assert.equal(invert('#000000'), '#ffffff');
  });

  it('inverts white to black', () => {
    assert.equal(invert('#ffffff'), '#000000');
  });

  it('inverts red to cyan', () => {
    assert.equal(invert('#ff0000'), '#00ffff');
  });

  it('double invert returns original color', () => {
    const hex = '#4a90e2';
    assert.equal(invert(invert(hex)), hex);
  });
});

// ─── grayscale ────────────────────────────────────────────────────────────────

describe('grayscale', () => {
  it('grayscale of white is white', () => {
    assert.equal(grayscale('#ffffff'), '#ffffff');
  });

  it('grayscale of black is black', () => {
    assert.equal(grayscale('#000000'), '#000000');
  });

  it('grayscale of a gray is unchanged (r=g=b)', () => {
    const result = parseHex(grayscale('#808080'));
    assert.equal(result.r, result.g);
    assert.equal(result.g, result.b);
  });

  it('grayscale output has equal r, g, b channels', () => {
    const result = parseHex(grayscale('#4a90e2'));
    assert.equal(result.r, result.g);
    assert.equal(result.g, result.b);
  });

  it('returns a valid hex string', () => {
    assert.match(grayscale('#336699'), /^#[0-9a-f]{6}$/);
  });
});

// ─── alpha ────────────────────────────────────────────────────────────────────

describe('alpha', () => {
  it('returns rgba() string format', () => {
    assert.match(alpha('#ff0000', 0.5), /^rgba\(/);
  });

  it('includes correct rgb channels', () => {
    const result = alpha('#336699', 0.8);
    assert.ok(result.startsWith('rgba(51,102,153,'));
  });

  it('includes the specified alpha value', () => {
    assert.ok(alpha('#ffffff', 0.25).includes('0.25'));
  });

  it('clamps alpha below 0 to 0', () => {
    assert.ok(alpha('#000000', -1).includes(',0)'));
  });

  it('clamps alpha above 1 to 1', () => {
    assert.ok(alpha('#000000', 2).includes(',1)'));
  });
});

// ─── luminance ────────────────────────────────────────────────────────────────

describe('luminance', () => {
  it('black has luminance 0', () => {
    assert.ok(Math.abs(luminance({ r: 0, g: 0, b: 0 })) < 1e-10);
  });

  it('white has luminance 1', () => {
    assert.ok(Math.abs(luminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-10);
  });

  it('luminance is always in [0, 1]', () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 128, g: 128, b: 128 },
    ]) {
      const l = luminance(rgb);
      assert.ok(l >= 0 && l <= 1, `luminance out of range: ${l}`);
    }
  });

  it('green has higher luminance than blue', () => {
    const lGreen = luminance({ r: 0, g: 255, b: 0 });
    const lBlue = luminance({ r: 0, g: 0, b: 255 });
    assert.ok(lGreen > lBlue);
  });
});

// ─── contrast ─────────────────────────────────────────────────────────────────

describe('contrast', () => {
  it('black on white has maximum contrast ratio 21', () => {
    assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
  });

  it('identical colors have contrast ratio 1', () => {
    assert.ok(Math.abs(contrast('#336699', '#336699') - 1) < 0.01);
  });

  it('contrast is symmetric', () => {
    const c1 = contrast('#336699', '#ffffff');
    const c2 = contrast('#ffffff', '#336699');
    assert.ok(Math.abs(c1 - c2) < 0.001);
  });

  it('contrast is always >= 1', () => {
    assert.ok(contrast('#4a90e2', '#ff6600') >= 1);
  });

  it('contrast ratio for WCAG AA-readable pair is >= 4.5', () => {
    // Dark blue on white — well above AA threshold
    assert.ok(contrast('#003366', '#ffffff') >= 4.5);
  });
});

// ─── isLight / isDark ─────────────────────────────────────────────────────────

describe('isLight / isDark', () => {
  it('white is light', () => {
    assert.equal(isLight('#ffffff'), true);
  });

  it('black is dark', () => {
    assert.equal(isDark('#000000'), true);
  });

  it('isLight and isDark are mutually exclusive', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#888888', '#cccccc', '#333333']) {
      assert.notEqual(isLight(hex), isDark(hex), `${hex} should be exclusively light or dark`);
    }
  });

  it('yellow (#ffff00) is light', () => {
    assert.equal(isLight('#ffff00'), true);
  });

  it('dark navy (#001f3f) is dark', () => {
    assert.equal(isDark('#001f3f'), true);
  });
});
