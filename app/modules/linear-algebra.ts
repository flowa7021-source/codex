// @ts-check
// ─── Linear Algebra ───────────────────────────────────────────────────────────
// Vector operations and linear algebra utilities for arbitrary dimensions.

// ─── Vector Class ─────────────────────────────────────────────────────────────

/** Immutable n-dimensional vector. */
export class Vector {
  readonly components: number[];

  constructor(components: number[]) {
    if (components.length === 0) {
      throw new RangeError('Vector must have at least one component');
    }
    this.components = [...components];
  }

  /** Create a Vector from individual numeric arguments. */
  static of(...values: number[]): Vector {
    return new Vector(values);
  }

  /** Number of dimensions. */
  get dimension(): number {
    return this.components.length;
  }
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _checkSameDimension(a: Vector, b: Vector, op: string): void {
  if (a.dimension !== b.dimension) {
    throw new RangeError(
      `Cannot ${op} vectors of dimension ${a.dimension} and ${b.dimension}: dimensions must match`,
    );
  }
}

// ─── Basic Arithmetic ─────────────────────────────────────────────────────────

/**
 * Add two vectors component-wise.
 * Both vectors must have the same dimension.
 */
export function add(a: Vector, b: Vector): Vector {
  _checkSameDimension(a, b, 'add');
  return new Vector(a.components.map((v, i) => v + b.components[i]));
}

/**
 * Subtract vector b from vector a component-wise.
 * Both vectors must have the same dimension.
 */
export function subtract(a: Vector, b: Vector): Vector {
  _checkSameDimension(a, b, 'subtract');
  return new Vector(a.components.map((v, i) => v - b.components[i]));
}

/**
 * Multiply every component of a vector by a scalar.
 */
export function scale(v: Vector, scalar: number): Vector {
  return new Vector(v.components.map((c) => c * scalar));
}

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two vectors.
 * Both vectors must have the same dimension.
 */
export function dot(a: Vector, b: Vector): number {
  _checkSameDimension(a, b, 'dot');
  return a.components.reduce((sum, v, i) => sum + v * b.components[i], 0);
}

/**
 * Compute the cross product of two 3D vectors.
 * Both vectors must be exactly 3-dimensional.
 */
export function cross(a: Vector, b: Vector): Vector {
  if (a.dimension !== 3 || b.dimension !== 3) {
    throw new RangeError(
      `cross product requires 3D vectors (got ${a.dimension}D and ${b.dimension}D)`,
    );
  }
  const [a0, a1, a2] = a.components;
  const [b0, b1, b2] = b.components;
  return new Vector([
    a1 * b2 - a2 * b1,
    a2 * b0 - a0 * b2,
    a0 * b1 - a1 * b0,
  ]);
}

// ─── Magnitude & Direction ────────────────────────────────────────────────────

/**
 * Compute the Euclidean magnitude (length) of a vector.
 */
export function magnitude(v: Vector): number {
  return Math.sqrt(v.components.reduce((sum, c) => sum + c * c, 0));
}

/**
 * Return the unit vector (normalised) in the same direction as v.
 * Throws if v is the zero vector.
 */
export function normalize(v: Vector): Vector {
  const mag = magnitude(v);
  if (mag === 0) {
    throw new RangeError('Cannot normalize the zero vector');
  }
  return new Vector(v.components.map((c) => c / mag));
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/**
 * Compute the angle between two vectors in radians.
 * Both vectors must have the same dimension and non-zero magnitude.
 */
export function angle(a: Vector, b: Vector): number {
  _checkSameDimension(a, b, 'compute angle between');
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) {
    throw new RangeError('Cannot compute angle involving the zero vector');
  }
  // Clamp to [-1, 1] to guard against floating-point drift past the domain of acos
  const cosTheta = Math.max(-1, Math.min(1, dot(a, b) / (magA * magB)));
  return Math.acos(cosTheta);
}

/**
 * Project vector a onto vector b.
 * Returns the component of a in the direction of b.
 * Throws if b is the zero vector.
 */
export function project(a: Vector, onto: Vector): Vector {
  _checkSameDimension(a, onto, 'project');
  const magSq = dot(onto, onto);
  if (magSq === 0) {
    throw new RangeError('Cannot project onto the zero vector');
  }
  return scale(onto, dot(a, onto) / magSq);
}

/**
 * Compute the Euclidean distance between two vectors (treated as points).
 * Both vectors must have the same dimension.
 */
export function distance(a: Vector, b: Vector): number {
  _checkSameDimension(a, b, 'compute distance between');
  return magnitude(subtract(b, a));
}

/**
 * Linear interpolation between vectors a and b at parameter t.
 * t=0 returns a, t=1 returns b. t is not clamped.
 * Both vectors must have the same dimension.
 */
export function lerp(a: Vector, b: Vector, t: number): Vector {
  _checkSameDimension(a, b, 'lerp');
  return new Vector(a.components.map((v, i) => v + (b.components[i] - v) * t));
}
