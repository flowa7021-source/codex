// ─── Unit Tests: Prime Number Algorithms ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sieve, primesUpTo, isPrime, nthPrime, primeFactors, gcd, lcm, totient, isPerfect,
} from '../../app/modules/prime.js';

describe('sieve', () => {
  it('throws RangeError for negative limit', () => { assert.throws(() => sieve(-1), RangeError); });
  it('sieve(10): correct primes', () => {
    const s = sieve(10);
    assert.equal(s[2], true); assert.equal(s[3], true); assert.equal(s[5], true); assert.equal(s[7], true);
    assert.equal(s[0], false); assert.equal(s[1], false); assert.equal(s[4], false);
  });
  it('returns array of length limit+1', () => { assert.equal(sieve(20).length, 21); });
});

describe('primesUpTo', () => {
  it('primesUpTo(13) = [2,3,5,7,11,13]', () => { assert.deepEqual(primesUpTo(13), [2,3,5,7,11,13]); });
  it('primesUpTo(1) = []', () => { assert.deepEqual(primesUpTo(1), []); });
  it('primesUpTo(2) = [2]', () => { assert.deepEqual(primesUpTo(2), [2]); });
});

describe('isPrime', () => {
  it('2 is prime', () => { assert.equal(isPrime(2), true); });
  it('17 is prime', () => { assert.equal(isPrime(17), true); });
  it('1 is not prime', () => { assert.equal(isPrime(1), false); });
  it('0 is not prime', () => { assert.equal(isPrime(0), false); });
  it('4 is not prime', () => { assert.equal(isPrime(4), false); });
});

describe('nthPrime', () => {
  it('nthPrime(1) = 2', () => { assert.equal(nthPrime(1), 2); });
  it('nthPrime(6) = 13', () => { assert.equal(nthPrime(6), 13); });
  it('throws RangeError for n < 1', () => { assert.throws(() => nthPrime(0), RangeError); });
});

describe('primeFactors', () => {
  it('primeFactors(12) = [2,2,3]', () => { assert.deepEqual(primeFactors(12), [2,2,3]); });
  it('primeFactors(7) = [7]', () => { assert.deepEqual(primeFactors(7), [7]); });
  it('primeFactors(8) = [2,2,2]', () => { assert.deepEqual(primeFactors(8), [2,2,2]); });
  it('primeFactors(1) = []', () => { assert.deepEqual(primeFactors(1), []); });
  it('throws for n < 1', () => { assert.throws(() => primeFactors(0)); });
  it('product of factors = n', () => {
    assert.equal(primeFactors(360).reduce((a, b) => a * b, 1), 360);
  });
});

describe('gcd', () => {
  it('gcd(12, 8) = 4', () => { assert.equal(gcd(12, 8), 4); });
  it('gcd(17, 13) = 1', () => { assert.equal(gcd(17, 13), 1); });
  it('gcd(0, 5) = 5', () => { assert.equal(gcd(0, 5), 5); });
});

describe('lcm', () => {
  it('lcm(4, 6) = 12', () => { assert.equal(lcm(4, 6), 12); });
  it('lcm(3, 5) = 15', () => { assert.equal(lcm(3, 5), 15); });
});

describe('totient', () => {
  it('totient(1) = 1', () => { assert.equal(totient(1), 1); });
  it('totient(6) = 2', () => { assert.equal(totient(6), 2); });
  it('totient(7) = 6', () => { assert.equal(totient(7), 6); });
  it('totient(12) = 4', () => { assert.equal(totient(12), 4); });
});

describe('isPerfect', () => {
  it('6 is perfect', () => { assert.equal(isPerfect(6), true); });
  it('28 is perfect', () => { assert.equal(isPerfect(28), true); });
  it('12 is not perfect', () => { assert.equal(isPerfect(12), false); });
});
