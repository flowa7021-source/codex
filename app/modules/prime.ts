// ─── Prime Number Algorithms ─────────────────────────────────────────────────
// @ts-check
// Sieve of Eratosthenes, primality tests, factorisation, GCD/LCM, totient.

// ─── Sieve of Eratosthenes ───────────────────────────────────────────────────

/**
 * Sieve of Eratosthenes.
 * Returns a boolean array of length `limit + 1` where index `i` is `true`
 * if `i` is prime.
 *
 * @param limit - Upper bound (inclusive). Must be ≥ 0.
 * @throws {RangeError} If `limit` is negative.
 */
export function sieve(limit: number): boolean[] {
  if (limit < 0) throw new RangeError('limit must be >= 0');
  const isPrime: boolean[] = new Array(limit + 1).fill(true);
  isPrime[0] = false;
  if (limit >= 1) isPrime[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = false;
      }
    }
  }
  return isPrime;
}

// ─── Primes Up To ────────────────────────────────────────────────────────────

/**
 * Return a sorted array of all prime numbers ≤ `limit`.
 *
 * @param limit - Upper bound (inclusive).
 */
export function primesUpTo(limit: number): number[] {
  if (limit < 2) return [];
  const isPrimeArr = sieve(limit);
  const result: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isPrimeArr[i]) result.push(i);
  }
  return result;
}

// ─── isPrime ─────────────────────────────────────────────────────────────────

/**
 * Primality test using trial division.
 * Returns `false` for `n < 2`.
 *
 * @param n - Integer to test.
 */
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// ─── nthPrime ────────────────────────────────────────────────────────────────

/**
 * Return the n-th prime (1-indexed: `nthPrime(1) === 2`).
 *
 * @param n - Positive integer index.
 * @throws {RangeError} If `n < 1`.
 */
export function nthPrime(n: number): number {
  if (n < 1) throw new RangeError('n must be >= 1');
  let count: number = 0;
  let candidate: number = 1;
  while (count < n) {
    candidate++;
    if (isPrime(candidate)) count++;
  }
  return candidate;
}

// ─── primeFactors ────────────────────────────────────────────────────────────

/**
 * Return the sorted list of prime factors of `n` with repetition.
 * e.g. `primeFactors(12)` returns `[2, 2, 3]`.
 *
 * @param n - Positive integer.
 * @throws {RangeError} If `n < 1`.
 */
export function primeFactors(n: number): number[] {
  if (n < 1) throw new RangeError('n must be >= 1');
  const factors: number[] = [];
  let remaining: number = n;
  for (let d = 2; d * d <= remaining; d++) {
    while (remaining % d === 0) {
      factors.push(d);
      remaining = Math.floor(remaining / d);
    }
  }
  if (remaining > 1) factors.push(remaining);
  return factors;
}

// ─── gcd ─────────────────────────────────────────────────────────────────────

/**
 * Greatest common divisor via the Euclidean algorithm (always non-negative).
 *
 * @param a - First integer.
 * @param b - Second integer.
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

// ─── lcm ─────────────────────────────────────────────────────────────────────

/**
 * Least common multiple (always non-negative).
 * Returns 0 if either argument is 0.
 *
 * @param a - First integer.
 * @param b - Second integer.
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

// ─── totient ─────────────────────────────────────────────────────────────────

/**
 * Euler's totient function φ(n): count of integers in [1, n] coprime to n.
 * Uses the product formula over prime factors.
 *
 * @param n - Positive integer.
 */
export function totient(n: number): number {
  if (n <= 0) return 0;
  let result: number = n;
  let remaining: number = n;
  for (let p = 2; p * p <= remaining; p++) {
    if (remaining % p === 0) {
      while (remaining % p === 0) remaining = Math.floor(remaining / p);
      result -= Math.floor(result / p);
    }
  }
  if (remaining > 1) result -= Math.floor(result / remaining);
  return result;
}

// ─── isPerfect ───────────────────────────────────────────────────────────────

/**
 * Return `true` if `n` equals the sum of its proper divisors (perfect number).
 * e.g. 6 = 1 + 2 + 3, 28 = 1 + 2 + 4 + 7 + 14.
 *
 * @param n - Positive integer to test.
 */
export function isPerfect(n: number): boolean {
  if (n < 2) return false;
  let sum: number = 1;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) {
      sum += i;
      if (i !== Math.floor(n / i)) sum += Math.floor(n / i);
    }
  }
  return sum === n;
}
