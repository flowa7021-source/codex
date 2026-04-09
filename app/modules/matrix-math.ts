// ─── Matrix Math Utilities ────────────────────────────────────────────────────
// @ts-check
// 2D and 3D matrix math utilities for NovaReader.

// ─── Types ───────────────────────────────────────────────────────────────────

/** Row-major 2x2 matrix: [a, b, c, d] */
export type Mat2 = [number, number, number, number];

/** Row-major 3x3 matrix */
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

/** Row-major 4x4 matrix */
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

// ─── Mat2 Operations ─────────────────────────────────────────────────────────

/**
 * Returns the 2x2 identity matrix.
 */
export function mat2Identity(): Mat2 {
  return [1, 0, 0, 1];
}

/**
 * Multiplies two 2x2 matrices: returns a * b.
 *
 * @param a - Left matrix
 * @param b - Right matrix
 */
export function mat2Multiply(a: Mat2, b: Mat2): Mat2 {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ];
}

/**
 * Returns the determinant of a 2x2 matrix.
 *
 * @param m - Input matrix
 */
export function mat2Determinant(m: Mat2): number {
  return m[0] * m[3] - m[1] * m[2];
}

/**
 * Returns the inverse of a 2x2 matrix, or null if singular.
 *
 * @param m - Input matrix
 */
export function mat2Inverse(m: Mat2): Mat2 | null {
  const det = mat2Determinant(m);
  if (det === 0) return null;
  const invDet = 1 / det;
  return [
    m[3] * invDet,
    -m[1] * invDet,
    -m[2] * invDet,
    m[0] * invDet,
  ];
}

/**
 * Returns the transpose of a 2x2 matrix.
 *
 * @param m - Input matrix
 */
export function mat2Transpose(m: Mat2): Mat2 {
  return [m[0], m[2], m[1], m[3]];
}

/**
 * Returns a 2x2 scaling matrix.
 *
 * @param sx - Scale factor along X
 * @param sy - Scale factor along Y
 */
export function mat2Scale(sx: number, sy: number): Mat2 {
  return [sx, 0, 0, sy];
}

/**
 * Returns a 2x2 rotation matrix for the given angle.
 *
 * @param angleRad - Rotation angle in radians
 */
export function mat2Rotate(angleRad: number): Mat2 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [c, -s, s, c];
}

// ─── Mat3 Operations ─────────────────────────────────────────────────────────

/**
 * Returns the 3x3 identity matrix.
 */
export function mat3Identity(): Mat3 {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ];
}

/**
 * Multiplies two 3x3 matrices: returns a * b.
 *
 * @param a - Left matrix
 * @param b - Right matrix
 */
export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],

    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],

    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/**
 * Returns the determinant of a 3x3 matrix.
 *
 * @param m - Input matrix
 */
export function mat3Determinant(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/**
 * Returns the transpose of a 3x3 matrix.
 *
 * @param m - Input matrix
 */
export function mat3Transpose(m: Mat3): Mat3 {
  return [
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ];
}

/**
 * Extracts the upper-left 3x3 submatrix from a 4x4 matrix.
 *
 * @param m - Input 4x4 matrix
 */
export function mat3FromMat4(m: Mat4): Mat3 {
  return [
    m[0],  m[1],  m[2],
    m[4],  m[5],  m[6],
    m[8],  m[9],  m[10],
  ];
}

// ─── Mat4 Operations ─────────────────────────────────────────────────────────

/**
 * Returns the 4x4 identity matrix.
 */
export function mat4Identity(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Multiplies two 4x4 matrices: returns a * b.
 *
 * @param a - Left matrix
 * @param b - Right matrix
 */
export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const result: number[] = new Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 4 + k] * b[k * 4 + col];
      }
      result[row * 4 + col] = sum;
    }
  }
  return result as Mat4;
}

/**
 * Returns the transpose of a 4x4 matrix.
 *
 * @param m - Input matrix
 */
export function mat4Transpose(m: Mat4): Mat4 {
  return [
    m[0],  m[4],  m[8],  m[12],
    m[1],  m[5],  m[9],  m[13],
    m[2],  m[6],  m[10], m[14],
    m[3],  m[7],  m[11], m[15],
  ];
}

/**
 * Returns a 4x4 translation matrix.
 *
 * @param tx - Translation along X
 * @param ty - Translation along Y
 * @param tz - Translation along Z
 */
export function mat4Translation(tx: number, ty: number, tz: number): Mat4 {
  return [
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1,
  ];
}

/**
 * Returns a 4x4 scale matrix.
 *
 * @param sx - Scale factor along X
 * @param sy - Scale factor along Y
 * @param sz - Scale factor along Z
 */
export function mat4Scale(sx: number, sy: number, sz: number): Mat4 {
  return [
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ];
}

/**
 * Returns a 4x4 rotation matrix around the X axis.
 *
 * @param angle - Rotation angle in radians
 */
export function mat4RotateX(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    1, 0,  0, 0,
    0, c, -s, 0,
    0, s,  c, 0,
    0, 0,  0, 1,
  ];
}

/**
 * Returns a 4x4 rotation matrix around the Y axis.
 *
 * @param angle - Rotation angle in radians
 */
export function mat4RotateY(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c,  0, s, 0,
    0,  1, 0, 0,
    -s, 0, c, 0,
    0,  0, 0, 1,
  ];
}

/**
 * Returns a 4x4 rotation matrix around the Z axis.
 *
 * @param angle - Rotation angle in radians
 */
export function mat4RotateZ(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, -s, 0, 0,
    s,  c, 0, 0,
    0,  0, 1, 0,
    0,  0, 0, 1,
  ];
}
