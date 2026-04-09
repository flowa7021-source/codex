// ─── Quaternion Math ──────────────────────────────────────────────────────────
// @ts-check
// Quaternion math for 3D rotations in NovaReader.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A quaternion representing a 3D rotation. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ─── Construction ────────────────────────────────────────────────────────────

/**
 * Creates a quaternion from components.
 *
 * @param x - X component
 * @param y - Y component
 * @param z - Z component
 * @param w - W (scalar) component
 */
export function quat(x: number, y: number, z: number, w: number): Quat {
  return { x, y, z, w };
}

/**
 * Returns the identity quaternion (no rotation).
 */
export function quatIdentity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/**
 * Creates a quaternion from an axis-angle representation.
 *
 * @param axis  - Unit vector defining the rotation axis
 * @param angle - Rotation angle in radians
 */
export function quatFromAxisAngle(
  axis: { x: number; y: number; z: number },
  angle: number,
): Quat {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(halfAngle),
  };
}

/**
 * Creates a quaternion from Euler angles (intrinsic ZYX / yaw-pitch-roll order).
 * Applies roll (Z), then yaw (Y), then pitch (X).
 *
 * @param pitch - Rotation around X axis in radians
 * @param yaw   - Rotation around Y axis in radians
 * @param roll  - Rotation around Z axis in radians
 */
export function quatFromEuler(pitch: number, yaw: number, roll: number): Quat {
  const cx = Math.cos(pitch / 2);
  const sx = Math.sin(pitch / 2);
  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);
  const cz = Math.cos(roll / 2);
  const sz = Math.sin(roll / 2);

  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
}

// ─── Core Operations ─────────────────────────────────────────────────────────

/**
 * Multiplies two quaternions: returns a * b.
 *
 * @param a - Left quaternion
 * @param b - Right quaternion
 */
export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/**
 * Returns the conjugate of a quaternion (negates x, y, z).
 *
 * @param q - Input quaternion
 */
export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/**
 * Returns the inverse of a quaternion.
 * For unit quaternions this equals the conjugate.
 *
 * @param q - Input quaternion
 */
export function quatInverse(q: Quat): Quat {
  const lenSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
  if (lenSq === 0) return quatIdentity();
  const invLenSq = 1 / lenSq;
  return {
    x: -q.x * invLenSq,
    y: -q.y * invLenSq,
    z: -q.z * invLenSq,
    w: q.w * invLenSq,
  };
}

/**
 * Returns the length (magnitude) of a quaternion.
 *
 * @param q - Input quaternion
 */
export function quatLength(q: Quat): number {
  return Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
}

/**
 * Returns a normalized (unit) quaternion.
 * Returns identity if the quaternion has zero length.
 *
 * @param q - Input quaternion
 */
export function quatNormalize(q: Quat): Quat {
  const len = quatLength(q);
  if (len === 0) return quatIdentity();
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/**
 * Returns the dot product of two quaternions.
 *
 * @param a - First quaternion
 * @param b - Second quaternion
 */
export function quatDot(a: Quat, b: Quat): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

/**
 * Spherical linear interpolation between two quaternions.
 *
 * @param a - Start quaternion
 * @param b - End quaternion
 * @param t - Interpolation factor in [0, 1]
 */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let dot = quatDot(a, b);

  // Ensure shortest arc
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  // Clamp dot to valid range for acos
  dot = Math.min(dot, 1);

  if (dot > 0.9995) {
    // Quaternions are very close — use linear interpolation
    return quatNormalize({
      x: a.x + t * (bx - a.x),
      y: a.y + t * (by - a.y),
      z: a.z + t * (bz - a.z),
      w: a.w + t * (bw - a.w),
    });
  }

  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return {
    x: s0 * a.x + s1 * bx,
    y: s0 * a.y + s1 * by,
    z: s0 * a.z + s1 * bz,
    w: s0 * a.w + s1 * bw,
  };
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * Converts a unit quaternion to Euler angles (pitch/yaw/roll in radians).
 * Produces the same convention as quatFromEuler (ZYX intrinsic / XYZ extrinsic):
 * R = Rx(pitch) * Ry(yaw) * Rz(roll).
 *
 * Extraction formulas derived from the rotation matrix:
 *   yaw   = asin(R[0][2])
 *   roll  = atan2(-R[0][1], R[0][0])
 *   pitch = atan2(-R[1][2], R[2][2])
 *
 * @param q - Unit quaternion
 */
export function quatToEuler(q: Quat): { pitch: number; yaw: number; roll: number } {
  const { x, y, z, w } = q;

  // Rotation matrix elements needed (from unit quaternion)
  // R[0][2] = 2*(xz + wy)
  const R02 = 2 * (x * z + w * y);
  // R[0][1] = 2*(xy - wz)
  const R01 = 2 * (x * y - w * z);
  // R[0][0] = 1 - 2*(y^2 + z^2)
  const R00 = 1 - 2 * (y * y + z * z);
  // R[1][2] = 2*(yz - wx)
  const R12 = 2 * (y * z - w * x);
  // R[2][2] = 1 - 2*(x^2 + y^2)
  const R22 = 1 - 2 * (x * x + y * y);

  // Yaw (Y rotation) — clamp to valid asin range
  const sinYaw = Math.max(-1, Math.min(1, R02));
  const yaw = Math.asin(sinYaw);

  // Roll (Z rotation)
  const roll = Math.atan2(-R01, R00);

  // Pitch (X rotation)
  const pitch = Math.atan2(-R12, R22);

  return { pitch, yaw, roll };
}

/**
 * Rotates a 3D vector by a unit quaternion.
 *
 * Computes q * v * q^-1 using the sandwich product.
 *
 * @param q - Unit quaternion
 * @param v - Vector to rotate
 */
export function quatRotateVec3(
  q: Quat,
  v: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);

  // result = v + q.w * t + cross(q.xyz, t)
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}
