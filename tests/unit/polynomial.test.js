// ─── Unit Tests: Polynomial ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Polynomial, createPolynomial } from '../../app/modules/polynomial.js';

// ─── Construction & degree ────────────────────────────────────────────────────

describe('Polynomial construction', () => {
  it('stores trimmed coefficients', () => {
    const p = new Polynomial([1, 2, 3]);
    assert.deepEqual([...p.coefficients], [1, 2, 3]);
  });

  it('trims trailing zeros', () => {
    const p = new Polynomial([1, 2, 0, 0]);
    assert.deepEqual([...p.coefficients], [1, 2]);
    assert.equal(p.degree, 1);
  });

  it('all-zero array gives zero polynomial (degree -1)', () => {
    const p = new Polynomial([0, 0, 0]);
    assert.equal(p.degree, -1);
    assert.equal(p.coefficients.length, 0);
  });

  it('empty array gives zero polynomial (degree -1)', () => {
    const p = new Polynomial([]);
    assert.equal(p.degree, -1);
  });

  it('degree equals highest non-zero index', () => {
    const p = new Polynomial([5, 0, 3]); // 3x^2 + 5
    assert.equal(p.degree, 2);
  });

  it('constant non-zero polynomial has degree 0', () => {
    const p = new Polynomial([7]);
    assert.equal(p.degree, 0);
  });
});

// ─── createPolynomial factory ─────────────────────────────────────────────────

describe('createPolynomial factory', () => {
  it('returns a Polynomial instance', () => {
    const p = createPolynomial([3, 2, 1]);
    assert.ok(p instanceof Polynomial);
    assert.equal(p.degree, 2);
  });
});

// ─── evaluate ─────────────────────────────────────────────────────────────────

describe('Polynomial#evaluate', () => {
  it('evaluates x^2 + 2x + 1 at x=3 → 16', () => {
    // coefficients: [1, 2, 1] → 1 + 2x + x^2
    const p = new Polynomial([1, 2, 1]);
    assert.equal(p.evaluate(3), 16);
  });

  it('evaluates x^2 + 2x + 1 at x=0 → 1', () => {
    const p = new Polynomial([1, 2, 1]);
    assert.equal(p.evaluate(0), 1);
  });

  it('returns 0 for the zero polynomial', () => {
    assert.equal(Polynomial.zero().evaluate(42), 0);
  });

  it('evaluates a constant polynomial correctly', () => {
    const p = new Polynomial([5]);
    assert.equal(p.evaluate(100), 5);
  });
});

// ─── add ──────────────────────────────────────────────────────────────────────

describe('Polynomial#add', () => {
  it('(x+1) + (x^2+2) = x^2+x+3', () => {
    const a = new Polynomial([1, 1]);       // x + 1
    const b = new Polynomial([2, 0, 1]);    // x^2 + 2
    const result = a.add(b);
    assert.deepEqual([...result.coefficients], [3, 1, 1]);
    assert.equal(result.degree, 2);
  });

  it('adding zero polynomial leaves polynomial unchanged', () => {
    const p = new Polynomial([1, 2, 3]);
    const sum = p.add(Polynomial.zero());
    assert.deepEqual([...sum.coefficients], [1, 2, 3]);
  });
});

// ─── sub ──────────────────────────────────────────────────────────────────────

describe('Polynomial#sub', () => {
  it('(x^2+x+1) - (x^2) = x+1', () => {
    const a = new Polynomial([1, 1, 1]);    // x^2 + x + 1
    const b = new Polynomial([0, 0, 1]);    // x^2
    const result = a.sub(b);
    assert.deepEqual([...result.coefficients], [1, 1]);
    assert.equal(result.degree, 1);
  });

  it('subtracting a polynomial from itself gives zero polynomial', () => {
    const p = new Polynomial([3, 2, 1]);
    const result = p.sub(p);
    assert.equal(result.degree, -1);
  });
});

// ─── mul ──────────────────────────────────────────────────────────────────────

describe('Polynomial#mul', () => {
  it('(x+1) * (x+1) = x^2+2x+1', () => {
    const a = new Polynomial([1, 1]);
    const result = a.mul(a);
    assert.deepEqual([...result.coefficients], [1, 2, 1]);
    assert.equal(result.degree, 2);
  });

  it('multiplying by zero polynomial gives zero polynomial', () => {
    const p = new Polynomial([1, 2, 3]);
    assert.equal(p.mul(Polynomial.zero()).degree, -1);
  });

  it('multiplying by one polynomial leaves polynomial unchanged', () => {
    const p = new Polynomial([1, 2, 3]);
    const result = p.mul(Polynomial.one());
    assert.deepEqual([...result.coefficients], [1, 2, 3]);
  });
});

// ─── scale ────────────────────────────────────────────────────────────────────

describe('Polynomial#scale', () => {
  it('2 * (x+1) = 2x+2', () => {
    const p = new Polynomial([1, 1]);
    const result = p.scale(2);
    assert.deepEqual([...result.coefficients], [2, 2]);
  });

  it('scaling by 0 gives zero polynomial', () => {
    const p = new Polynomial([1, 2, 3]);
    assert.equal(p.scale(0).degree, -1);
  });

  it('scaling by 1 is identity', () => {
    const p = new Polynomial([4, 5, 6]);
    assert.deepEqual([...p.scale(1).coefficients], [4, 5, 6]);
  });
});

// ─── derivative ───────────────────────────────────────────────────────────────

describe('Polynomial#derivative', () => {
  it('d/dx(x^3 + 2x^2 + 3x + 4) = 3x^2 + 4x + 3', () => {
    // coefficients: [4, 3, 2, 1] → 4 + 3x + 2x^2 + x^3
    const p = new Polynomial([4, 3, 2, 1]);
    const d = p.derivative();
    assert.deepEqual([...d.coefficients], [3, 4, 3]);
  });

  it('derivative of a constant is the zero polynomial', () => {
    const p = new Polynomial([7]);
    assert.equal(p.derivative().degree, -1);
  });

  it('derivative of the zero polynomial is the zero polynomial', () => {
    assert.equal(Polynomial.zero().derivative().degree, -1);
  });

  it('derivative of x is constant 1', () => {
    const p = new Polynomial([0, 1]); // x
    const d = p.derivative();
    assert.deepEqual([...d.coefficients], [1]);
  });
});

// ─── toString ─────────────────────────────────────────────────────────────────

describe('Polynomial#toString', () => {
  it('zero polynomial returns "0"', () => {
    assert.equal(Polynomial.zero().toString(), '0');
  });

  it('constant polynomial returns its value as string', () => {
    assert.equal(new Polynomial([5]).toString(), '5');
  });

  it('linear polynomial x+1 gives reasonable string', () => {
    const s = new Polynomial([1, 1]).toString();
    assert.ok(s.includes('x'), `expected "x" in "${s}"`);
    assert.ok(s.includes('1'), `expected "1" in "${s}"`);
  });

  it('x^2+2x+1 gives reasonable string', () => {
    const s = new Polynomial([1, 2, 1]).toString();
    assert.ok(s.includes('x^2'), `expected "x^2" in "${s}"`);
    assert.ok(s.includes('2x') || s.includes('2*x'), `expected "2x" in "${s}"`);
  });

  it('does not emit trailing + or - artifacts', () => {
    const s = new Polynomial([3, 0, 1]).toString(); // x^2 + 3
    assert.ok(!s.startsWith('+') && !s.endsWith('+'));
  });
});

// ─── Static factories ─────────────────────────────────────────────────────────

describe('Polynomial.zero', () => {
  it('has degree -1', () => {
    assert.equal(Polynomial.zero().degree, -1);
  });

  it('evaluates to 0 everywhere', () => {
    assert.equal(Polynomial.zero().evaluate(999), 0);
  });
});

describe('Polynomial.one', () => {
  it('has degree 0', () => {
    assert.equal(Polynomial.one().degree, 0);
  });

  it('evaluates to 1 everywhere', () => {
    assert.equal(Polynomial.one().evaluate(999), 1);
  });
});

describe('Polynomial.fromRoots', () => {
  it('fromRoots([1, 2]) evaluates to 0 at x=1', () => {
    const p = Polynomial.fromRoots([1, 2]);
    assert.equal(p.evaluate(1), 0);
  });

  it('fromRoots([1, 2]) evaluates to 0 at x=2', () => {
    const p = Polynomial.fromRoots([1, 2]);
    assert.equal(p.evaluate(2), 0);
  });

  it('fromRoots([1, 2]) has degree 2', () => {
    assert.equal(Polynomial.fromRoots([1, 2]).degree, 2);
  });

  it('fromRoots([]) returns the constant polynomial 1', () => {
    const p = Polynomial.fromRoots([]);
    assert.equal(p.degree, 0);
    assert.equal(p.evaluate(0), 1);
  });

  it('fromRoots([0]) has root at x=0', () => {
    const p = Polynomial.fromRoots([0]);
    assert.equal(p.evaluate(0), 0);
    assert.notEqual(p.evaluate(1), 0);
  });
});
