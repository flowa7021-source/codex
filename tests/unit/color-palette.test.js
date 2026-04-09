// ─── Unit Tests: color-palette ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePalette,
  monochromaticPalette,
  complementaryPair,
  triadicPalette,
  analogousPalette,
  hslToHex,
  hexToHSL,
  hexToRGB,
  rgbToHex,
  relativeLuminance,
  contrastRatio,
} from '../../app/modules/color-palette.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);

// ─── generatePalette ──────────────────────────────────────────────────────────

describe('generatePalette', () => {
  it('returns the correct number of colors', () => {
    assert.equal(generatePalette(5).length, 5);
    assert.equal(generatePalette(1).length, 1);
    assert.equal(generatePalette(12).length, 12);
  });

  it('returns valid hex strings', () => {
    for (const hex of generatePalette(8)) {
      assert.ok(isHex(hex), `Expected valid hex, got: ${hex}`);
    }
  });

  it('returns empty array for n=0', () => {
    assert.deepEqual(generatePalette(0), []);
  });

  it('accepts custom saturation and lightness', () => {
    const palette = generatePalette(3, 50, 40);
    assert.equal(palette.length, 3);
    assert.ok(palette.every(isHex));
  });
});

// ─── monochromaticPalette ─────────────────────────────────────────────────────

describe('monochromaticPalette', () => {
  it('returns the correct number of colors', () => {
    assert.equal(monochromaticPalette(200, 5).length, 5);
    assert.equal(monochromaticPalette(200, 1).length, 1);
  });

  it('returns valid hex strings', () => {
    for (const hex of monochromaticPalette(120, 6)) {
      assert.ok(isHex(hex), `Expected valid hex, got: ${hex}`);
    }
  });

  it('shades are in the same hue family', () => {
    // All shades of a red (hue=0) monochromatic palette should have hue near 0
    const shades = monochromaticPalette(0, 5);
    for (const hex of shades) {
      const { h } = hexToHSL(hex);
      assert.ok(h < 10 || h > 350, `Hue ${h} not in red family for ${hex}`);
    }
  });

  it('returns empty array for n=0', () => {
    assert.deepEqual(monochromaticPalette(100, 0), []);
  });
});

// ─── complementaryPair ────────────────────────────────────────────────────────

describe('complementaryPair', () => {
  it('returns exactly 2 colors', () => {
    const pair = complementaryPair(180);
    assert.equal(pair.length, 2);
  });

  it('returns valid hex strings', () => {
    const [a, b] = complementaryPair(60);
    assert.ok(isHex(a));
    assert.ok(isHex(b));
  });

  it('the two colors are 180 degrees apart in hue', () => {
    const [a, b] = complementaryPair(60);
    const { h: hA } = hexToHSL(a);
    const { h: hB } = hexToHSL(b);
    const diff = Math.abs(hA - hB);
    const wrapped = Math.min(diff, 360 - diff);
    assert.ok(wrapped > 170 && wrapped <= 180, `Expected ~180° apart, got diff ${wrapped}`);
  });
});

// ─── triadicPalette ───────────────────────────────────────────────────────────

describe('triadicPalette', () => {
  it('returns exactly 3 colors', () => {
    const triadic = triadicPalette(0);
    assert.equal(triadic.length, 3);
  });

  it('returns valid hex strings', () => {
    for (const hex of triadicPalette(30)) {
      assert.ok(isHex(hex));
    }
  });

  it('the three colors are approximately 120 degrees apart', () => {
    const [a, b, c] = triadicPalette(0);
    const { h: hA } = hexToHSL(a);
    const { h: hB } = hexToHSL(b);
    const { h: hC } = hexToHSL(c);
    const abDiff = Math.min(Math.abs(hA - hB), 360 - Math.abs(hA - hB));
    const bcDiff = Math.min(Math.abs(hB - hC), 360 - Math.abs(hB - hC));
    assert.ok(abDiff > 110 && abDiff <= 120, `Expected ~120° apart, got ${abDiff}`);
    assert.ok(bcDiff > 110 && bcDiff <= 120, `Expected ~120° apart, got ${bcDiff}`);
  });
});

// ─── analogousPalette ─────────────────────────────────────────────────────────

describe('analogousPalette', () => {
  it('returns default 5 colors', () => {
    assert.equal(analogousPalette(180).length, 5);
  });

  it('returns n colors when specified', () => {
    assert.equal(analogousPalette(180, 3).length, 3);
    assert.equal(analogousPalette(180, 7).length, 7);
  });

  it('returns valid hex strings', () => {
    for (const hex of analogousPalette(90, 4)) {
      assert.ok(isHex(hex));
    }
  });

  it('returns empty array for n=0', () => {
    assert.deepEqual(analogousPalette(180, 0), []);
  });
});

// ─── hslToHex ─────────────────────────────────────────────────────────────────

describe('hslToHex', () => {
  it('converts red (0, 100, 50) to #ff0000', () => {
    assert.equal(hslToHex(0, 100, 50), '#ff0000');
  });

  it('converts green (120, 100, 50) to #00ff00', () => {
    assert.equal(hslToHex(120, 100, 50), '#00ff00');
  });

  it('converts blue (240, 100, 50) to #0000ff', () => {
    assert.equal(hslToHex(240, 100, 50), '#0000ff');
  });

  it('converts white (0, 0, 100) to #ffffff', () => {
    assert.equal(hslToHex(0, 0, 100), '#ffffff');
  });

  it('converts black (0, 0, 0) to #000000', () => {
    assert.equal(hslToHex(0, 0, 0), '#000000');
  });

  it('returns a valid hex string', () => {
    assert.ok(isHex(hslToHex(210, 60, 70)));
  });
});

// ─── hexToHSL ─────────────────────────────────────────────────────────────────

describe('hexToHSL', () => {
  it('converts #ff0000 to red HSL', () => {
    const { h, s, l } = hexToHSL('#ff0000');
    assert.equal(h, 0);
    assert.equal(s, 100);
    assert.equal(l, 50);
  });

  it('converts #ffffff to white HSL', () => {
    const { s, l } = hexToHSL('#ffffff');
    assert.equal(s, 0);
    assert.equal(l, 100);
  });

  it('converts #000000 to black HSL', () => {
    const { s, l } = hexToHSL('#000000');
    assert.equal(s, 0);
    assert.equal(l, 0);
  });

  it('roundtrips with hslToHex', () => {
    const original = hslToHex(210, 65, 55);
    const { h, s, l } = hexToHSL(original);
    const roundtripped = hslToHex(h, s, l);
    assert.equal(roundtripped, original);
  });
});

// ─── hexToRGB ─────────────────────────────────────────────────────────────────

describe('hexToRGB', () => {
  it('converts #ff0000 to {r:255, g:0, b:0}', () => {
    assert.deepEqual(hexToRGB('#ff0000'), { r: 255, g: 0, b: 0 });
  });

  it('converts #00ff00 to {r:0, g:255, b:0}', () => {
    assert.deepEqual(hexToRGB('#00ff00'), { r: 0, g: 255, b: 0 });
  });

  it('converts #0000ff to {r:0, g:0, b:255}', () => {
    assert.deepEqual(hexToRGB('#0000ff'), { r: 0, g: 0, b: 255 });
  });

  it('converts #ffffff to {r:255, g:255, b:255}', () => {
    assert.deepEqual(hexToRGB('#ffffff'), { r: 255, g: 255, b: 255 });
  });

  it('supports shorthand #rgb', () => {
    assert.deepEqual(hexToRGB('#f00'), { r: 255, g: 0, b: 0 });
  });
});

// ─── rgbToHex ─────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts {255, 0, 0} to #ff0000', () => {
    assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  });

  it('converts {0, 255, 0} to #00ff00', () => {
    assert.equal(rgbToHex(0, 255, 0), '#00ff00');
  });

  it('converts {0, 0, 255} to #0000ff', () => {
    assert.equal(rgbToHex(0, 0, 255), '#0000ff');
  });

  it('converts {255, 255, 255} to #ffffff', () => {
    assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  });

  it('converts {0, 0, 0} to #000000', () => {
    assert.equal(rgbToHex(0, 0, 0), '#000000');
  });
});

// ─── relativeLuminance ────────────────────────────────────────────────────────

describe('relativeLuminance', () => {
  it('white has luminance of 1', () => {
    assert.equal(relativeLuminance('#ffffff'), 1);
  });

  it('black has luminance of 0', () => {
    assert.equal(relativeLuminance('#000000'), 0);
  });

  it('returns a value between 0 and 1 for mid-range colors', () => {
    const lum = relativeLuminance('#808080');
    assert.ok(lum > 0 && lum < 1, `Expected 0 < luminance < 1, got ${lum}`);
  });
});

// ─── contrastRatio ────────────────────────────────────────────────────────────

describe('contrastRatio', () => {
  it('white vs black contrast ratio is 21', () => {
    const ratio = contrastRatio('#ffffff', '#000000');
    assert.ok(Math.abs(ratio - 21) < 0.01, `Expected ~21, got ${ratio}`);
  });

  it('same color contrast ratio is 1', () => {
    const ratio = contrastRatio('#ff0000', '#ff0000');
    assert.ok(Math.abs(ratio - 1) < 0.01, `Expected 1, got ${ratio}`);
  });

  it('is symmetric (order does not matter)', () => {
    const r1 = contrastRatio('#ffffff', '#808080');
    const r2 = contrastRatio('#808080', '#ffffff');
    assert.ok(Math.abs(r1 - r2) < 0.0001);
  });
});
