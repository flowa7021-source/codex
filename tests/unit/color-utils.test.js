// ─── Unit Tests: color-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseHex,
  parseRgb,
  parseRgba,
  parseColor,
  toHex,
  toRgbString,
  toRgbaString,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  mix,
  lighten,
  darken,
  saturate,
  desaturate,
  invert,
  grayscale,
  opacity,
  luminance,
  contrast,
  isLight,
  isDark,
  complementary,
} from '../../app/modules/color-utils.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Assert two RGB objects are within `tol` of each other per channel. */
function assertRgbClose(a, b, tol = 1, msg = '') {
  assert.ok(
    Math.abs(a.r - b.r) <= tol &&
    Math.abs(a.g - b.g) <= tol &&
    Math.abs(a.b - b.b) <= tol,
    `RGB mismatch ${msg}: got {${a.r},${a.g},${a.b}} expected {${b.r},${b.g},${b.b}}`,
  );
}

// ─── parseHex ────────────────────────────────────────────────────────────────

describe('parseHex', () => {
  it('parses #FF0000 as red', () => {
    assert.deepEqual(parseHex('#FF0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses lowercase #00ff00 as green', () => {
    assert.deepEqual(parseHex('#00ff00'), { r: 0, g: 255, b: 0 });
  });

  it('parses #0000ff as blue', () => {
    assert.deepEqual(parseHex('#0000ff'), { r: 0, g: 0, b: 255 });
  });

  it('parses #ffffff as white', () => {
    assert.deepEqual(parseHex('#ffffff'), { r: 255, g: 255, b: 255 });
  });

  it('parses #000000 as black', () => {
    assert.deepEqual(parseHex('#000000'), { r: 0, g: 0, b: 0 });
  });

  it('parses 3-char shorthand #f00 as red', () => {
    assert.deepEqual(parseHex('#f00'), { r: 255, g: 0, b: 0 });
  });

  it('parses 3-char shorthand #abc correctly', () => {
    assert.deepEqual(parseHex('#abc'), { r: 170, g: 187, b: 204 });
  });

  it('parses without leading #', () => {
    assert.deepEqual(parseHex('ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('parses #fff (white shorthand)', () => {
    assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  });
});

// ─── parseRgb ────────────────────────────────────────────────────────────────

describe('parseRgb', () => {
  it('parses rgb(255, 0, 0) as red', () => {
    assert.deepEqual(parseRgb('rgb(255, 0, 0)'), { r: 255, g: 0, b: 0 });
  });

  it('parses rgb(0, 255, 0) as green', () => {
    assert.deepEqual(parseRgb('rgb(0, 255, 0)'), { r: 0, g: 255, b: 0 });
  });

  it('parses rgb(0, 0, 255) as blue', () => {
    assert.deepEqual(parseRgb('rgb(0, 0, 255)'), { r: 0, g: 0, b: 255 });
  });

  it('tolerates extra spaces', () => {
    assert.deepEqual(parseRgb('rgb( 10 , 20 , 30 )'), { r: 10, g: 20, b: 30 });
  });

  it('throws on invalid format', () => {
    assert.throws(() => parseRgb('not a color'), /parseRgb/);
  });
});

// ─── parseRgba ───────────────────────────────────────────────────────────────

describe('parseRgba', () => {
  it('parses rgba(255, 0, 0, 0.5)', () => {
    assert.deepEqual(parseRgba('rgba(255, 0, 0, 0.5)'), { r: 255, g: 0, b: 0, a: 0.5 });
  });

  it('parses rgba(0, 128, 255, 1)', () => {
    assert.deepEqual(parseRgba('rgba(0, 128, 255, 1)'), { r: 0, g: 128, b: 255, a: 1 });
  });

  it('parses rgba with alpha 0', () => {
    const result = parseRgba('rgba(255, 255, 255, 0)');
    assert.equal(result.a, 0);
  });

  it('throws on invalid format', () => {
    assert.throws(() => parseRgba('rgb(1,2,3)'), /parseRgba/);
  });
});

// ─── parseColor ──────────────────────────────────────────────────────────────

describe('parseColor', () => {
  it('handles hex input', () => {
    assert.deepEqual(parseColor('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('handles rgb() input', () => {
    assert.deepEqual(parseColor('rgb(0, 255, 0)'), { r: 0, g: 255, b: 0 });
  });

  it('handles rgba() input and drops alpha', () => {
    assert.deepEqual(parseColor('rgba(0, 0, 255, 0.5)'), { r: 0, g: 0, b: 255 });
  });

  it('handles hex shorthand', () => {
    assert.deepEqual(parseColor('#0f0'), { r: 0, g: 255, b: 0 });
  });

  it('throws on unsupported format', () => {
    assert.throws(() => parseColor('hsl(120, 100%, 50%)'), /parseColor/);
  });
});

// ─── toHex ───────────────────────────────────────────────────────────────────

describe('toHex', () => {
  it('converts red to #ff0000', () => {
    assert.equal(toHex({ r: 255, g: 0, b: 0 }), '#ff0000');
  });

  it('converts green to #00ff00', () => {
    assert.equal(toHex({ r: 0, g: 255, b: 0 }), '#00ff00');
  });

  it('converts blue to #0000ff', () => {
    assert.equal(toHex({ r: 0, g: 0, b: 255 }), '#0000ff');
  });

  it('converts white to #ffffff', () => {
    assert.equal(toHex({ r: 255, g: 255, b: 255 }), '#ffffff');
  });

  it('converts black to #000000', () => {
    assert.equal(toHex({ r: 0, g: 0, b: 0 }), '#000000');
  });

  it('pads single hex digit components', () => {
    assert.equal(toHex({ r: 0, g: 1, b: 15 }), '#00010f');
  });

  it('clamps values above 255', () => {
    assert.equal(toHex({ r: 300, g: 0, b: 0 }), '#ff0000');
  });

  it('clamps negative values to 0', () => {
    assert.equal(toHex({ r: -10, g: 0, b: 0 }), '#000000');
  });

  it('round-trips with parseHex', () => {
    const rgb = parseHex('#3a7bc8');
    assert.equal(toHex(rgb), '#3a7bc8');
  });
});

// ─── toRgbString ─────────────────────────────────────────────────────────────

describe('toRgbString', () => {
  it('converts red to "rgb(255, 0, 0)"', () => {
    assert.equal(toRgbString({ r: 255, g: 0, b: 0 }), 'rgb(255, 0, 0)');
  });

  it('converts black to "rgb(0, 0, 0)"', () => {
    assert.equal(toRgbString({ r: 0, g: 0, b: 0 }), 'rgb(0, 0, 0)');
  });

  it('produces a string starting with "rgb("', () => {
    assert.ok(toRgbString({ r: 10, g: 20, b: 30 }).startsWith('rgb('));
  });
});

// ─── toRgbaString ────────────────────────────────────────────────────────────

describe('toRgbaString', () => {
  it('includes alpha in output', () => {
    assert.equal(toRgbaString({ r: 255, g: 0, b: 0, a: 0.5 }), 'rgba(255, 0, 0, 0.5)');
  });

  it('handles alpha = 1', () => {
    assert.equal(toRgbaString({ r: 0, g: 0, b: 0, a: 1 }), 'rgba(0, 0, 0, 1)');
  });

  it('handles alpha = 0', () => {
    assert.equal(toRgbaString({ r: 255, g: 255, b: 255, a: 0 }), 'rgba(255, 255, 255, 0)');
  });
});

// ─── rgbToHsl ────────────────────────────────────────────────────────────────

describe('rgbToHsl', () => {
  it('red → h≈0, s≈100, l≈50', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    assert.ok(Math.abs(hsl.h) < 1 || Math.abs(hsl.h - 360) < 1, `h: ${hsl.h}`);
    assert.ok(Math.abs(hsl.s - 100) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 50) < 1, `l: ${hsl.l}`);
  });

  it('white → s≈0, l≈100', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    assert.ok(Math.abs(hsl.s) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 100) < 1, `l: ${hsl.l}`);
  });

  it('black → s≈0, l≈0', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 });
    assert.ok(Math.abs(hsl.s) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l) < 1, `l: ${hsl.l}`);
  });

  it('green (0,255,0) → h≈120', () => {
    const hsl = rgbToHsl({ r: 0, g: 255, b: 0 });
    assert.ok(Math.abs(hsl.h - 120) < 1, `h: ${hsl.h}`);
    assert.ok(Math.abs(hsl.s - 100) < 1, `s: ${hsl.s}`);
    assert.ok(Math.abs(hsl.l - 50) < 1, `l: ${hsl.l}`);
  });

  it('blue (0,0,255) → h≈240', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 255 });
    assert.ok(Math.abs(hsl.h - 240) < 1, `h: ${hsl.h}`);
  });
});

// ─── hslToRgb ────────────────────────────────────────────────────────────────

describe('hslToRgb', () => {
  it('h=0, s=100, l=50 → red', () => {
    assertRgbClose(hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0 });
  });

  it('h=120, s=100, l=50 → green', () => {
    const rgb = hslToRgb({ h: 120, s: 100, l: 50 });
    assert.ok(rgb.r < 5, `r: ${rgb.r}`);
    assert.ok(rgb.g > 250, `g: ${rgb.g}`);
    assert.ok(rgb.b < 5, `b: ${rgb.b}`);
  });

  it('h=240, s=100, l=50 → blue', () => {
    const rgb = hslToRgb({ h: 240, s: 100, l: 50 });
    assert.ok(rgb.r < 5, `r: ${rgb.r}`);
    assert.ok(rgb.g < 5, `g: ${rgb.g}`);
    assert.ok(rgb.b > 250, `b: ${rgb.b}`);
  });

  it('s=0, l=100 → white', () => {
    assertRgbClose(hslToRgb({ h: 0, s: 0, l: 100 }), { r: 255, g: 255, b: 255 });
  });

  it('s=0, l=0 → black', () => {
    assertRgbClose(hslToRgb({ h: 0, s: 0, l: 0 }), { r: 0, g: 0, b: 0 });
  });

  it('round-trips with rgbToHsl for red', () => {
    const original = { r: 255, g: 0, b: 0 };
    assertRgbClose(hslToRgb(rgbToHsl(original)), original, 1, 'red round-trip');
  });

  it('round-trips with rgbToHsl for cornflower blue ±1', () => {
    const original = { r: 100, g: 149, b: 237 };
    assertRgbClose(hslToRgb(rgbToHsl(original)), original, 1, 'cornflower blue round-trip');
  });
});

// ─── rgbToHsv ────────────────────────────────────────────────────────────────

describe('rgbToHsv', () => {
  it('red → h≈0, s≈100, v≈100', () => {
    const hsv = rgbToHsv({ r: 255, g: 0, b: 0 });
    assert.ok(Math.abs(hsv.h) < 1 || Math.abs(hsv.h - 360) < 1, `h: ${hsv.h}`);
    assert.ok(Math.abs(hsv.s - 100) < 1, `s: ${hsv.s}`);
    assert.ok(Math.abs(hsv.v - 100) < 1, `v: ${hsv.v}`);
  });

  it('white → s≈0, v≈100', () => {
    const hsv = rgbToHsv({ r: 255, g: 255, b: 255 });
    assert.ok(Math.abs(hsv.s) < 1, `s: ${hsv.s}`);
    assert.ok(Math.abs(hsv.v - 100) < 1, `v: ${hsv.v}`);
  });

  it('black → s≈0, v≈0', () => {
    const hsv = rgbToHsv({ r: 0, g: 0, b: 0 });
    assert.ok(Math.abs(hsv.s) < 1, `s: ${hsv.s}`);
    assert.ok(Math.abs(hsv.v) < 1, `v: ${hsv.v}`);
  });

  it('blue → h≈240', () => {
    const hsv = rgbToHsv({ r: 0, g: 0, b: 255 });
    assert.ok(Math.abs(hsv.h - 240) < 1, `h: ${hsv.h}`);
  });
});

// ─── hsvToRgb ────────────────────────────────────────────────────────────────

describe('hsvToRgb', () => {
  it('h=0, s=100, v=100 → red', () => {
    assertRgbClose(hsvToRgb({ h: 0, s: 100, v: 100 }), { r: 255, g: 0, b: 0 });
  });

  it('h=120, s=100, v=100 → green', () => {
    const rgb = hsvToRgb({ h: 120, s: 100, v: 100 });
    assert.ok(rgb.r < 5, `r: ${rgb.r}`);
    assert.ok(rgb.g > 250, `g: ${rgb.g}`);
    assert.ok(rgb.b < 5, `b: ${rgb.b}`);
  });

  it('s=0 → grayscale equal channels', () => {
    const rgb = hsvToRgb({ h: 0, s: 0, v: 50 });
    assert.equal(rgb.r, rgb.g);
    assert.equal(rgb.g, rgb.b);
  });

  it('v=0 → black regardless of hue', () => {
    assertRgbClose(hsvToRgb({ h: 180, s: 100, v: 0 }), { r: 0, g: 0, b: 0 });
  });

  it('round-trips with rgbToHsv for blue ±1', () => {
    const original = { r: 0, g: 0, b: 255 };
    assertRgbClose(hsvToRgb(rgbToHsv(original)), original, 1, 'blue HSV round-trip');
  });

  it('round-trips with rgbToHsv for mid-tone color ±1', () => {
    const original = { r: 80, g: 160, b: 200 };
    assertRgbClose(hsvToRgb(rgbToHsv(original)), original, 1, 'mid-tone HSV round-trip');
  });
});

// ─── mix ─────────────────────────────────────────────────────────────────────

describe('mix', () => {
  it('t=0 returns color a', () => {
    assert.deepEqual(mix({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 0), { r: 255, g: 0, b: 0 });
  });

  it('t=1 returns color b', () => {
    assert.deepEqual(mix({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 1), { r: 0, g: 0, b: 255 });
  });

  it('default t=0.5 blends evenly', () => {
    const result = mix({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    assert.ok(result.r >= 127 && result.r <= 128, `r: ${result.r}`);
  });

  it('t=0.5 explicit blends evenly', () => {
    const result = mix({ r: 0, g: 0, b: 0 }, { r: 200, g: 100, b: 50 }, 0.5);
    assert.equal(result.r, 100);
    assert.equal(result.g, 50);
    assert.equal(result.b, 25);
  });

  it('default t returns midpoint', () => {
    const result = mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 });
    assert.equal(result.r, 50);
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

  it('amount=0 returns approximately same color', () => {
    const color = { r: 51, g: 102, b: 153 };
    const result = lighten(color, 0);
    assertRgbClose(result, color, 1, 'lighten 0');
  });

  it('lighten by 50 then darken by 50 returns near original', () => {
    const color = { r: 100, g: 100, b: 100 };
    const result = darken(lighten(color, 50), 50);
    assertRgbClose(result, color, 2, 'lighten-darken round-trip');
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

  it('amount=0 returns approximately same color', () => {
    const color = { r: 51, g: 102, b: 153 };
    assertRgbClose(darken(color, 0), color, 1, 'darken 0');
  });
});

// ─── saturate / desaturate ───────────────────────────────────────────────────

describe('saturate', () => {
  it('increases saturation', () => {
    const color = { r: 100, g: 130, b: 100 };
    const before = rgbToHsl(color);
    const after = rgbToHsl(saturate(color, 30));
    assert.ok(after.s > before.s, `Expected ${after.s} > ${before.s}`);
  });

  it('does not exceed s=100', () => {
    const result = saturate({ r: 255, g: 0, b: 0 }, 200);
    const hsl = rgbToHsl(result);
    assert.ok(hsl.s <= 100 + 1, `s: ${hsl.s}`);
  });

  it('amount=0 returns approximately same color', () => {
    const color = { r: 100, g: 130, b: 160 };
    assertRgbClose(saturate(color, 0), color, 1, 'saturate 0');
  });
});

describe('desaturate', () => {
  it('decreases saturation', () => {
    const color = { r: 255, g: 100, b: 0 };
    const before = rgbToHsl(color);
    const after = rgbToHsl(desaturate(color, 30));
    assert.ok(after.s < before.s, `Expected ${after.s} < ${before.s}`);
  });

  it('does not go below s=0', () => {
    const result = desaturate({ r: 128, g: 128, b: 128 }, 200);
    const hsl = rgbToHsl(result);
    assert.ok(hsl.s >= 0, `s: ${hsl.s}`);
  });

  it('full desaturate produces gray with equal channels', () => {
    const result = desaturate({ r: 255, g: 0, b: 0 }, 100);
    assert.ok(Math.abs(result.r - result.g) <= 1 && Math.abs(result.g - result.b) <= 1,
      `Channels should be equal: ${result.r},${result.g},${result.b}`);
  });
});

// ─── invert ──────────────────────────────────────────────────────────────────

describe('invert', () => {
  it('inverts black to white', () => {
    assert.deepEqual(invert({ r: 0, g: 0, b: 0 }), { r: 255, g: 255, b: 255 });
  });

  it('inverts white to black', () => {
    assert.deepEqual(invert({ r: 255, g: 255, b: 255 }), { r: 0, g: 0, b: 0 });
  });

  it('inverts red to cyan', () => {
    assert.deepEqual(invert({ r: 255, g: 0, b: 0 }), { r: 0, g: 255, b: 255 });
  });

  it('double invert returns original', () => {
    const original = { r: 100, g: 150, b: 200 };
    assert.deepEqual(invert(invert(original)), original);
  });
});

// ─── grayscale ───────────────────────────────────────────────────────────────

describe('grayscale', () => {
  it('all channels become equal', () => {
    const result = grayscale({ r: 255, g: 0, b: 0 });
    assert.equal(result.r, result.g);
    assert.equal(result.g, result.b);
  });

  it('grayscale of white is white', () => {
    assert.deepEqual(grayscale({ r: 255, g: 255, b: 255 }), { r: 255, g: 255, b: 255 });
  });

  it('grayscale of black is black', () => {
    assert.deepEqual(grayscale({ r: 0, g: 0, b: 0 }), { r: 0, g: 0, b: 0 });
  });

  it('result channels are non-negative integers', () => {
    const result = grayscale({ r: 123, g: 45, b: 67 });
    assert.ok(Number.isInteger(result.r) && result.r >= 0);
    assert.ok(Number.isInteger(result.g) && result.g >= 0);
    assert.ok(Number.isInteger(result.b) && result.b >= 0);
  });
});

// ─── opacity ─────────────────────────────────────────────────────────────────

describe('opacity', () => {
  it('wraps RGB in RGBA with given alpha', () => {
    const result = opacity({ r: 255, g: 0, b: 0 }, 0.5);
    assert.deepEqual(result, { r: 255, g: 0, b: 0, a: 0.5 });
  });

  it('alpha=1 means fully opaque', () => {
    const result = opacity({ r: 0, g: 128, b: 255 }, 1);
    assert.equal(result.a, 1);
  });

  it('alpha=0 means fully transparent', () => {
    const result = opacity({ r: 0, g: 0, b: 0 }, 0);
    assert.equal(result.a, 0);
  });

  it('preserves RGB channels', () => {
    const color = { r: 10, g: 20, b: 30 };
    const result = opacity(color, 0.75);
    assert.equal(result.r, 10);
    assert.equal(result.g, 20);
    assert.equal(result.b, 30);
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

// ─── contrast ────────────────────────────────────────────────────────────────

describe('contrast', () => {
  it('white on black is 21:1', () => {
    assert.equal(contrast({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 21);
  });

  it('same color has ratio 1', () => {
    assert.equal(contrast({ r: 51, g: 102, b: 153 }, { r: 51, g: 102, b: 153 }), 1);
  });

  it('returns a value between 1 and 21', () => {
    const ratio = contrast({ r: 51, g: 102, b: 153 }, { r: 255, g: 255, b: 255 });
    assert.ok(ratio >= 1 && ratio <= 21, `Expected 1..21, got ${ratio}`);
  });

  it('is symmetric', () => {
    const white = { r: 255, g: 255, b: 255 };
    const blue = { r: 0, g: 0, b: 255 };
    assert.equal(contrast(white, blue), contrast(blue, white));
  });
});

// ─── isLight / isDark ────────────────────────────────────────────────────────

describe('isLight', () => {
  it('white is light', () => {
    assert.equal(isLight({ r: 255, g: 255, b: 255 }), true);
  });

  it('black is not light', () => {
    assert.equal(isLight({ r: 0, g: 0, b: 0 }), false);
  });

  it('yellow is light', () => {
    assert.equal(isLight({ r: 255, g: 255, b: 0 }), true);
  });

  it('dark navy is not light', () => {
    assert.equal(isLight({ r: 0, g: 0, b: 128 }), false);
  });
});

describe('isDark', () => {
  it('black is dark', () => {
    assert.equal(isDark({ r: 0, g: 0, b: 0 }), true);
  });

  it('white is not dark', () => {
    assert.equal(isDark({ r: 255, g: 255, b: 255 }), false);
  });

  it('isDark is opposite of isLight', () => {
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 128, g: 64, b: 32 },
    ];
    for (const c of colors) {
      assert.equal(isDark(c), !isLight(c), `Mismatch for {${c.r},${c.g},${c.b}}`);
    }
  });
});

// ─── complementary ───────────────────────────────────────────────────────────

describe('complementary', () => {
  it('complement of red is cyan-ish', () => {
    const comp = complementary({ r: 255, g: 0, b: 0 });
    // hue rotated 180° from 0 → 180 (cyan)
    const hsl = rgbToHsl(comp);
    assert.ok(Math.abs(hsl.h - 180) < 2, `Expected h≈180, got ${hsl.h}`);
  });

  it('complement of complement returns near-original', () => {
    const original = { r: 100, g: 150, b: 200 };
    const double = complementary(complementary(original));
    assertRgbClose(double, original, 1, 'double complement');
  });

  it('lightness and saturation are preserved', () => {
    const color = { r: 100, g: 150, b: 50 };
    const hslBefore = rgbToHsl(color);
    const hslAfter = rgbToHsl(complementary(color));
    assert.ok(Math.abs(hslBefore.s - hslAfter.s) < 1, `s changed: ${hslBefore.s} vs ${hslAfter.s}`);
    assert.ok(Math.abs(hslBefore.l - hslAfter.l) < 1, `l changed: ${hslBefore.l} vs ${hslAfter.l}`);
  });

  it('hue shifts by 180°', () => {
    const color = { r: 50, g: 200, b: 100 };
    const hslBefore = rgbToHsl(color);
    const hslAfter = rgbToHsl(complementary(color));
    const hueDiff = Math.abs(hslAfter.h - ((hslBefore.h + 180) % 360));
    assert.ok(hueDiff < 2, `Hue diff should be ~180°, got ${hueDiff}`);
  });
});
