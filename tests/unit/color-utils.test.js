// ─── Unit Tests: color-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  mixColors,
  lighten,
  darken,
  luminance,
  contrastRatio,
  meetsWCAGAA,
  invertColor,
  toRgbString,
  parseCssColor,
} from '../../app/modules/color-utils.js';

// ─── hexToRgb ────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses #FF0000 as red', () => {
    assert.deepEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses lowercase #00ff00 as green', () => {
    assert.deepEqual(hexToRgb('#00ff00'), { r: 0, g: 255, b: 0 });
  });

  it('parses #0000FF as blue', () => {
    assert.deepEqual(hexToRgb('#0000FF'), { r: 0, g: 0, b: 255 });
  });

  it('parses #FFFFFF as white', () => {
    assert.deepEqual(hexToRgb('#FFFFFF'), { r: 255, g: 255, b: 255 });
  });

  it('parses #000000 as black', () => {
    assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  });

  it('parses 3-char shorthand #F00 as red', () => {
    assert.deepEqual(hexToRgb('#F00'), { r: 255, g: 0, b: 0 });
  });

  it('parses 3-char shorthand #ABC correctly', () => {
    assert.deepEqual(hexToRgb('#ABC'), { r: 170, g: 187, b: 204 });
  });

  it('parses without leading #', () => {
    assert.deepEqual(hexToRgb('ff0000'), { r: 255, g: 0, b: 0 });
  });
});

// ─── rgbToHex ────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts red to #ff0000', () => {
    assert.equal(rgbToHex({ r: 255, g: 0, b: 0 }), '#ff0000');
  });

  it('converts green to #00ff00', () => {
    assert.equal(rgbToHex({ r: 0, g: 255, b: 0 }), '#00ff00');
  });

  it('converts blue to #0000ff', () => {
    assert.equal(rgbToHex({ r: 0, g: 0, b: 255 }), '#0000ff');
  });

  it('converts white to #ffffff', () => {
    assert.equal(rgbToHex({ r: 255, g: 255, b: 255 }), '#ffffff');
  });

  it('converts black to #000000', () => {
    assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
  });

  it('pads single hex digit components', () => {
    assert.equal(rgbToHex({ r: 0, g: 1, b: 15 }), '#00010f');
  });

  it('clamps values above 255', () => {
    assert.equal(rgbToHex({ r: 300, g: 0, b: 0 }), '#ff0000');
  });

  it('clamps negative values to 0', () => {
    assert.equal(rgbToHex({ r: -10, g: 0, b: 0 }), '#000000');
  });

  it('round-trips with hexToRgb', () => {
    const rgb = hexToRgb('#3a7bc8');
    assert.equal(rgbToHex(rgb), '#3a7bc8');
  });
});

// ─── rgbToHsl ────────────────────────────────────────────────────────────────

describe('rgbToHsl', () => {
  it('converts red to h≈0, s=100, l=50', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    assert.ok(Math.abs(hsl.h) < 1 || Math.abs(hsl.h - 360) < 1, `h: ${hsl.h}`);
    assert.ok(Math.abs(hsl.s - 100) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 50) < 1, `l: ${hsl.l}`);
  });

  it('converts white to s=0, l=100', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    assert.ok(Math.abs(hsl.s) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 100) < 1, `l: ${hsl.l}`);
  });

  it('converts black to s=0, l=0', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 });
    assert.ok(Math.abs(hsl.s) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l) < 1, `l: ${hsl.l}`);
  });

  it('converts green (0,255,0) to h≈120', () => {
    const hsl = rgbToHsl({ r: 0, g: 255, b: 0 });
    assert.ok(Math.abs(hsl.h - 120) < 1, `h: ${hsl.h}`);
    assert.ok(Math.abs(hsl.s - 100) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 50) < 1, `l: ${hsl.l}`);
  });

  it('converts blue (0,0,255) to h≈240', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 255 });
    assert.ok(Math.abs(hsl.h - 240) < 1, `h: ${hsl.h}`);
  });
});

// ─── hslToRgb ────────────────────────────────────────────────────────────────

describe('hslToRgb', () => {
  it('converts h=0, s=100, l=50 to red', () => {
    assert.deepEqual(hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0 });
  });

  it('converts h=120, s=100, l=50 to green', () => {
    const rgb = hslToRgb({ h: 120, s: 100, l: 50 });
    assert.ok(rgb.r < 5, `r: ${rgb.r}`);
    assert.ok(rgb.g > 250, `g: ${rgb.g}`);
    assert.ok(rgb.b < 5, `b: ${rgb.b}`);
  });

  it('converts h=0, s=0, l=100 to white', () => {
    assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 100 }), { r: 255, g: 255, b: 255 });
  });

  it('converts h=0, s=0, l=0 to black', () => {
    assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 0 }), { r: 0, g: 0, b: 0 });
  });

  it('round-trips with rgbToHsl for red', () => {
    const original = { r: 255, g: 0, b: 0 };
    const result = hslToRgb(rgbToHsl(original));
    assert.deepEqual(result, original);
  });

  it('round-trips with rgbToHsl within ±1 for mid-tone color', () => {
    const original = { r: 100, g: 149, b: 237 }; // cornflower blue
    const result = hslToRgb(rgbToHsl(original));
    assert.ok(Math.abs(result.r - original.r) <= 1, `r: ${result.r} vs ${original.r}`);
    assert.ok(Math.abs(result.g - original.g) <= 1, `g: ${result.g} vs ${original.g}`);
    assert.ok(Math.abs(result.b - original.b) <= 1, `b: ${result.b} vs ${original.b}`);
  });
});

// ─── mixColors ───────────────────────────────────────────────────────────────

describe('mixColors', () => {
  it('t=0 returns color1', () => {
    assert.deepEqual(mixColors({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 0), { r: 255, g: 0, b: 0 });
  });

  it('t=1 returns color2', () => {
    assert.deepEqual(mixColors({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 1), { r: 0, g: 0, b: 255 });
  });

  it('t=0.5 blends evenly', () => {
    const result = mixColors({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5);
    assert.ok(result.r >= 127 && result.r <= 128, `r: ${result.r}`);
    assert.equal(result.r, result.g);
    assert.equal(result.g, result.b);
  });

  it('clamps t below 0 to 0', () => {
    assert.deepEqual(mixColors({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, -1), { r: 255, g: 0, b: 0 });
  });

  it('clamps t above 1 to 1', () => {
    assert.deepEqual(mixColors({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 2), { r: 0, g: 0, b: 255 });
  });
});

// ─── lighten ─────────────────────────────────────────────────────────────────

describe('lighten', () => {
  it('increases lightness', () => {
    const before = rgbToHsl({ r: 51, g: 102, b: 153 });
    const after = rgbToHsl(lighten({ r: 51, g: 102, b: 153 }, 20));
    assert.ok(after.l > before.l, `Expected ${after.l} > ${before.l}`);
  });

  it('does not exceed l=100', () => {
    const result = lighten({ r: 255, g: 255, b: 255 }, 50);
    const hsl = rgbToHsl(result);
    assert.ok(hsl.l <= 100, `l: ${hsl.l}`);
  });

  it('amount=0 returns the same color', () => {
    const color = { r: 51, g: 102, b: 153 };
    const result = lighten(color, 0);
    assert.ok(Math.abs(result.r - color.r) <= 1);
    assert.ok(Math.abs(result.g - color.g) <= 1);
    assert.ok(Math.abs(result.b - color.b) <= 1);
  });
});

// ─── darken ──────────────────────────────────────────────────────────────────

describe('darken', () => {
  it('decreases lightness', () => {
    const before = rgbToHsl({ r: 51, g: 102, b: 153 });
    const after = rgbToHsl(darken({ r: 51, g: 102, b: 153 }, 20));
    assert.ok(after.l < before.l, `Expected ${after.l} < ${before.l}`);
  });

  it('does not go below l=0', () => {
    const result = darken({ r: 0, g: 0, b: 0 }, 50);
    const hsl = rgbToHsl(result);
    assert.ok(hsl.l >= 0, `l: ${hsl.l}`);
  });

  it('amount=0 returns the same color', () => {
    const color = { r: 51, g: 102, b: 153 };
    const result = darken(color, 0);
    assert.ok(Math.abs(result.r - color.r) <= 1);
    assert.ok(Math.abs(result.g - color.g) <= 1);
    assert.ok(Math.abs(result.b - color.b) <= 1);
  });
});

// ─── luminance ───────────────────────────────────────────────────────────────

describe('luminance', () => {
  it('white has luminance 1.0', () => {
    assert.equal(luminance({ r: 255, g: 255, b: 255 }), 1);
  });

  it('black has luminance 0.0', () => {
    assert.equal(luminance({ r: 0, g: 0, b: 0 }), 0);
  });

  it('returns a value between 0 and 1', () => {
    const lum = luminance({ r: 51, g: 102, b: 153 });
    assert.ok(lum >= 0 && lum <= 1, `Expected 0..1, got ${lum}`);
  });

  it('red is less luminant than white', () => {
    assert.ok(luminance({ r: 255, g: 0, b: 0 }) < luminance({ r: 255, g: 255, b: 255 }));
  });

  it('green has higher luminance than blue', () => {
    assert.ok(luminance({ r: 0, g: 255, b: 0 }) > luminance({ r: 0, g: 0, b: 255 }));
  });
});

// ─── contrastRatio ───────────────────────────────────────────────────────────

describe('contrastRatio', () => {
  it('white on black is 21:1', () => {
    assert.equal(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 21);
  });

  it('same color has ratio 1', () => {
    assert.equal(contrastRatio({ r: 51, g: 102, b: 153 }, { r: 51, g: 102, b: 153 }), 1);
  });

  it('returns a value between 1 and 21', () => {
    const ratio = contrastRatio({ r: 51, g: 102, b: 153 }, { r: 255, g: 255, b: 255 });
    assert.ok(ratio >= 1 && ratio <= 21, `Expected 1..21, got ${ratio}`);
  });

  it('is symmetric', () => {
    const white = { r: 255, g: 255, b: 255 };
    const blue = { r: 0, g: 0, b: 255 };
    assert.equal(contrastRatio(white, blue), contrastRatio(blue, white));
  });
});

// ─── meetsWCAGAA ─────────────────────────────────────────────────────────────

describe('meetsWCAGAA', () => {
  it('white on black passes WCAG AA', () => {
    assert.equal(meetsWCAGAA({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), true);
  });

  it('same color fails WCAG AA', () => {
    assert.equal(meetsWCAGAA({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 }), false);
  });

  it('white on light grey fails WCAG AA', () => {
    assert.equal(meetsWCAGAA({ r: 255, g: 255, b: 255 }, { r: 220, g: 220, b: 220 }), false);
  });
});

// ─── invertColor ─────────────────────────────────────────────────────────────

describe('invertColor', () => {
  it('inverts black to white', () => {
    assert.deepEqual(invertColor({ r: 0, g: 0, b: 0 }), { r: 255, g: 255, b: 255 });
  });

  it('inverts white to black', () => {
    assert.deepEqual(invertColor({ r: 255, g: 255, b: 255 }), { r: 0, g: 0, b: 0 });
  });

  it('inverts red to cyan', () => {
    assert.deepEqual(invertColor({ r: 255, g: 0, b: 0 }), { r: 0, g: 255, b: 255 });
  });

  it('double invert returns original', () => {
    const original = { r: 100, g: 150, b: 200 };
    assert.deepEqual(invertColor(invertColor(original)), original);
  });
});

// ─── toRgbString ─────────────────────────────────────────────────────────────

describe('toRgbString', () => {
  it('converts RGB to css rgb() string', () => {
    assert.equal(toRgbString({ r: 255, g: 0, b: 0 }), 'rgb(255, 0, 0)');
  });

  it('converts RGBA to css rgba() string', () => {
    assert.equal(toRgbString({ r: 0, g: 128, b: 255, a: 0.5 }), 'rgba(0, 128, 255, 0.5)');
  });

  it('RGBA with alpha=1 includes alpha in output', () => {
    assert.equal(toRgbString({ r: 0, g: 0, b: 0, a: 1 }), 'rgba(0, 0, 0, 1)');
  });

  it('RGB without alpha produces rgb() not rgba()', () => {
    const result = toRgbString({ r: 10, g: 20, b: 30 });
    assert.ok(result.startsWith('rgb('), `Expected rgb(), got: ${result}`);
    assert.ok(!result.startsWith('rgba('), `Should not be rgba(), got: ${result}`);
  });
});

// ─── parseCssColor ───────────────────────────────────────────────────────────

describe('parseCssColor', () => {
  it('parses #RRGGBB hex', () => {
    assert.deepEqual(parseCssColor('#FF0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses #RGB shorthand hex', () => {
    assert.deepEqual(parseCssColor('#F00'), { r: 255, g: 0, b: 0 });
  });

  it('parses rgb() string', () => {
    assert.deepEqual(parseCssColor('rgb(0, 255, 0)'), { r: 0, g: 255, b: 0 });
  });

  it('parses rgba() string (ignores alpha)', () => {
    assert.deepEqual(parseCssColor('rgba(0, 0, 255, 0.5)'), { r: 0, g: 0, b: 255 });
  });

  it('parses hsl() string', () => {
    const result = parseCssColor('hsl(0, 100%, 50%)');
    assert.ok(result !== null, 'Expected non-null result');
    assert.ok(result.r > 250, `Expected red r>250, got ${result.r}`);
    assert.ok(result.g < 5, `Expected g<5, got ${result.g}`);
    assert.ok(result.b < 5, `Expected b<5, got ${result.b}`);
  });

  it('returns null for invalid input', () => {
    assert.equal(parseCssColor('not-a-color'), null);
  });

  it('returns null for invalid hex length', () => {
    assert.equal(parseCssColor('#12345'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(parseCssColor(''), null);
  });
});
