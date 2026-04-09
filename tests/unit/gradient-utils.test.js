// ─── Unit Tests: gradient-utils ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  linearGradient,
  radialGradient,
  conicGradient,
  interpolateColor,
  colorRange,
  multiStopGradient,
  parseLinearGradient,
} from '../../app/modules/gradient-utils.js';

// ─── linearGradient ───────────────────────────────────────────────────────────

describe('linearGradient', () => {
  it('contains "linear-gradient"', () => {
    const result = linearGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('linear-gradient'), `Got: ${result}`);
  });

  it('uses default angle of 90deg', () => {
    const result = linearGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('90deg'), `Expected 90deg in: ${result}`);
  });

  it('uses custom angle', () => {
    const result = linearGradient([{ color: '#ff0000' }, { color: '#0000ff' }], 45);
    assert.ok(result.includes('45deg'), `Expected 45deg in: ${result}`);
  });

  it('includes stop colors', () => {
    const result = linearGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('#ff0000'));
    assert.ok(result.includes('#0000ff'));
  });

  it('includes position percentages when provided', () => {
    const result = linearGradient([{ color: '#ff0000', position: 20 }, { color: '#0000ff', position: 80 }]);
    assert.ok(result.includes('20%'));
    assert.ok(result.includes('80%'));
  });
});

// ─── radialGradient ───────────────────────────────────────────────────────────

describe('radialGradient', () => {
  it('contains "radial-gradient"', () => {
    const result = radialGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('radial-gradient'), `Got: ${result}`);
  });

  it('uses default ellipse shape', () => {
    const result = radialGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('ellipse'), `Expected ellipse in: ${result}`);
  });

  it('accepts circle shape', () => {
    const result = radialGradient([{ color: '#ff0000' }, { color: '#0000ff' }], 'circle');
    assert.ok(result.includes('circle'), `Expected circle in: ${result}`);
  });

  it('includes stop colors', () => {
    const result = radialGradient([{ color: '#aabbcc' }, { color: '#112233' }]);
    assert.ok(result.includes('#aabbcc'));
    assert.ok(result.includes('#112233'));
  });
});

// ─── conicGradient ────────────────────────────────────────────────────────────

describe('conicGradient', () => {
  it('contains "conic-gradient"', () => {
    const result = conicGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('conic-gradient'), `Got: ${result}`);
  });

  it('uses default starting angle of 0deg', () => {
    const result = conicGradient([{ color: '#ff0000' }, { color: '#0000ff' }]);
    assert.ok(result.includes('0deg'), `Expected 0deg in: ${result}`);
  });

  it('accepts custom starting angle', () => {
    const result = conicGradient([{ color: '#ff0000' }, { color: '#0000ff' }], 45);
    assert.ok(result.includes('45deg'), `Expected 45deg in: ${result}`);
  });

  it('includes stop colors', () => {
    const result = conicGradient([{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }]);
    assert.ok(result.includes('#ff0000'));
    assert.ok(result.includes('#00ff00'));
    assert.ok(result.includes('#0000ff'));
  });
});

// ─── interpolateColor ─────────────────────────────────────────────────────────

describe('interpolateColor', () => {
  it('t=0 returns colorA', () => {
    assert.equal(interpolateColor('#ff0000', '#0000ff', 0), '#ff0000');
  });

  it('t=1 returns colorB', () => {
    assert.equal(interpolateColor('#ff0000', '#0000ff', 1), '#0000ff');
  });

  it('t=0.5 returns midpoint color', () => {
    const mid = interpolateColor('#000000', '#ffffff', 0.5);
    // midpoint should be around #808080
    assert.ok(/^#[0-9a-f]{6}$/i.test(mid), `Expected valid hex, got: ${mid}`);
    const val = parseInt(mid.slice(1, 3), 16);
    assert.ok(val >= 127 && val <= 128, `Expected ~0x80, got ${val} (${mid})`);
  });

  it('clamps t below 0 to colorA', () => {
    assert.equal(interpolateColor('#ff0000', '#0000ff', -0.5), '#ff0000');
  });

  it('clamps t above 1 to colorB', () => {
    assert.equal(interpolateColor('#ff0000', '#0000ff', 1.5), '#0000ff');
  });
});

// ─── colorRange ───────────────────────────────────────────────────────────────

describe('colorRange', () => {
  it('returns the correct count of colors', () => {
    assert.equal(colorRange('#000000', '#ffffff', 5).length, 5);
    assert.equal(colorRange('#000000', '#ffffff', 10).length, 10);
  });

  it('first color equals start', () => {
    const range = colorRange('#ff0000', '#0000ff', 5);
    assert.equal(range[0], '#ff0000');
  });

  it('last color equals end', () => {
    const range = colorRange('#ff0000', '#0000ff', 5);
    assert.equal(range[range.length - 1], '#0000ff');
  });

  it('returns [start] for n=1', () => {
    assert.deepEqual(colorRange('#ff0000', '#0000ff', 1), ['#ff0000']);
  });

  it('returns empty array for n=0', () => {
    assert.deepEqual(colorRange('#ff0000', '#0000ff', 0), []);
  });

  it('returns valid hex strings', () => {
    for (const hex of colorRange('#123456', '#abcdef', 7)) {
      assert.ok(/^#[0-9a-f]{6}$/i.test(hex), `Expected valid hex, got: ${hex}`);
    }
  });
});

// ─── multiStopGradient ────────────────────────────────────────────────────────

describe('multiStopGradient', () => {
  it('contains all input colors', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    const result = multiStopGradient(colors);
    for (const color of colors) {
      assert.ok(result.includes(color), `Expected ${color} in: ${result}`);
    }
  });

  it('returns a linear-gradient string', () => {
    const result = multiStopGradient(['#ff0000', '#0000ff']);
    assert.ok(result.includes('linear-gradient'), `Got: ${result}`);
  });

  it('uses default angle of 90deg', () => {
    const result = multiStopGradient(['#ff0000', '#0000ff']);
    assert.ok(result.includes('90deg'), `Expected 90deg in: ${result}`);
  });

  it('accepts custom angle', () => {
    const result = multiStopGradient(['#ff0000', '#0000ff'], 135);
    assert.ok(result.includes('135deg'), `Expected 135deg in: ${result}`);
  });
});

// ─── parseLinearGradient ──────────────────────────────────────────────────────

describe('parseLinearGradient', () => {
  it('extracts the angle', () => {
    const result = parseLinearGradient('linear-gradient(45deg, #ff0000, #0000ff)');
    assert.ok(result !== null);
    assert.equal(result.angle, 45);
  });

  it('extracts stops', () => {
    const result = parseLinearGradient('linear-gradient(90deg, #ff0000, #0000ff)');
    assert.ok(result !== null);
    assert.equal(result.stops.length, 2);
    assert.equal(result.stops[0].color, '#ff0000');
    assert.equal(result.stops[1].color, '#0000ff');
  });

  it('extracts stop positions when present', () => {
    const result = parseLinearGradient('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
    assert.ok(result !== null);
    assert.equal(result.stops[0].position, 0);
    assert.equal(result.stops[1].position, 100);
  });

  it('defaults to 90 when no angle specified', () => {
    const result = parseLinearGradient('linear-gradient(#ff0000, #0000ff)');
    assert.ok(result !== null);
    assert.equal(result.angle, 90);
    assert.equal(result.stops[0].color, '#ff0000');
  });

  it('returns null for non-linear-gradient input', () => {
    assert.equal(parseLinearGradient('radial-gradient(#ff0000, #0000ff)'), null);
    assert.equal(parseLinearGradient('not a gradient'), null);
  });

  it('roundtrips with linearGradient output', () => {
    const stops = [{ color: '#ff0000', position: 0 }, { color: '#0000ff', position: 100 }];
    const css = linearGradient(stops, 120);
    const parsed = parseLinearGradient(css);
    assert.ok(parsed !== null);
    assert.equal(parsed.angle, 120);
    assert.equal(parsed.stops.length, 2);
    assert.equal(parsed.stops[0].color, '#ff0000');
    assert.equal(parsed.stops[1].color, '#0000ff');
  });
});
