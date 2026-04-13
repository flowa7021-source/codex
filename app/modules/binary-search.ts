// ─── Binary Search Algorithms ────────────────────────────────────────────────
// Efficient search algorithms for sorted arrays, including standard binary
// search, bound-finding variants, exponential search, and interpolation search.

// ─── Default Comparator ──────────────────────────────────────────────────────

/** Default comparator: works for numbers, strings, and anything with < / >. */
function defaultComparator<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── binarySearch ────────────────────────────────────────────────────────────

/**
 * Standard binary search. Returns the index of `target` in a sorted array,
 * or -1 if not found. When duplicates exist, any matching index may be returned.
 *
 * @param arr        Sorted array to search.
 * @param target     Value to find.
 * @param comparator Optional ordering function (default: natural </>).
 * @returns Index of target, or -1.
 */
export function binarySearch<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = comparator(arr[mid], target);
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// ─── binarySearchLeft ────────────────────────────────────────────────────────

/**
 * Binary search that returns the leftmost (first) index of `target`.
 * Returns -1 if the target is not in the array.
 *
 * @param arr        Sorted array to search.
 * @param target     Value to find.
 * @param comparator Optional ordering function.
 * @returns Leftmost index of target, or -1.
 */
export function binarySearchLeft<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (comparator(arr[mid], target) < 0) lo = mid + 1;
    else hi = mid;
  }
  if (lo < arr.length && comparator(arr[lo], target) === 0) return lo;
  return -1;
}

// ─── binarySearchRight ───────────────────────────────────────────────────────

/**
 * Binary search that returns the rightmost (last) index of `target` plus one.
 * Returns -1 if the target is not in the array.
 *
 * The "+1" convention mirrors C++ `upper_bound`, giving a half-open range
 * [left, right) when combined with `binarySearchLeft`.
 *
 * @param arr        Sorted array to search.
 * @param target     Value to find.
 * @param comparator Optional ordering function.
 * @returns Index after the last occurrence of target, or -1.
 */
export function binarySearchRight<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (comparator(arr[mid], target) <= 0) lo = mid + 1;
    else hi = mid;
  }
  // lo is now one past the last equal element; check that any equal element exists
  if (lo > 0 && comparator(arr[lo - 1], target) === 0) return lo;
  return -1;
}

// ─── lowerBound ──────────────────────────────────────────────────────────────

/**
 * Returns the index of the first element that is >= `target` (lower bound).
 * If all elements are less than target, returns `arr.length`.
 *
 * Mirrors C++ `std::lower_bound`.
 *
 * @param arr        Sorted array.
 * @param target     Value to compare against.
 * @param comparator Optional ordering function.
 * @returns First index i where arr[i] >= target.
 */
export function lowerBound<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (comparator(arr[mid], target) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ─── upperBound ──────────────────────────────────────────────────────────────

/**
 * Returns the index of the first element that is > `target` (upper bound).
 * If all elements are <= target, returns `arr.length`.
 *
 * Mirrors C++ `std::upper_bound`.
 *
 * @param arr        Sorted array.
 * @param target     Value to compare against.
 * @param comparator Optional ordering function.
 * @returns First index i where arr[i] > target.
 */
export function upperBound<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (comparator(arr[mid], target) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ─── exponentialSearch ───────────────────────────────────────────────────────

/**
 * Exponential search: useful when the array is very large or effectively
 * unbounded. First finds a range where the target might exist by doubling the
 * index, then performs a binary search within that range.
 *
 * Time complexity: O(log i) where i is the target's index.
 *
 * @param arr        Sorted array to search.
 * @param target     Value to find.
 * @param comparator Optional ordering function.
 * @returns Index of target, or -1.
 */
export function exponentialSearch<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): number {
  const n = arr.length;
  if (n === 0) return -1;

  // Quick check on first element
  if (comparator(arr[0], target) === 0) return 0;

  // Find range for binary search by repeated doubling
  let bound = 1;
  while (bound < n && comparator(arr[bound], target) < 0) {
    bound *= 2;
  }

  // Binary search in [bound/2, min(bound, n-1)]
  let lo = bound >> 1;
  let hi = Math.min(bound, n - 1);
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = comparator(arr[mid], target);
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// ─── interpolationSearch ─────────────────────────────────────────────────────

/**
 * Interpolation search for uniformly distributed numeric data.
 * Uses linear interpolation to probe a likely position, giving O(log log n)
 * average-case performance on uniform distributions. Degrades to O(n) in the
 * worst case (skewed distributions).
 *
 * Only works on `number[]`.
 *
 * @param arr    Sorted array of numbers.
 * @param target Number to find.
 * @returns Index of target, or -1.
 */
export function interpolationSearch(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {
    // Avoid division by zero when all elements in range are equal
    if (arr[hi] === arr[lo]) {
      return arr[lo] === target ? lo : -1;
    }

    // Probe position via linear interpolation
    const pos =
      lo + Math.floor(((target - arr[lo]) / (arr[hi] - arr[lo])) * (hi - lo));

    if (arr[pos] === target) return pos;
    if (arr[pos] < target) lo = pos + 1;
    else hi = pos - 1;
  }

  return -1;
}

// ─── equalRange ──────────────────────────────────────────────────────────────

/**
 * Returns the half-open range [lower, upper) of indices where `target` appears.
 * Equivalent to [lowerBound, upperBound].
 *
 * If target is not found, lower === upper (an empty range).
 *
 * @param arr        Sorted array.
 * @param target     Value to find.
 * @param comparator Optional ordering function.
 * @returns Tuple [firstIndex, pastLastIndex].
 */
export function equalRange<T>(
  arr: T[],
  target: T,
  comparator: (a: T, b: T) => number = defaultComparator,
): [number, number] {
  return [lowerBound(arr, target, comparator), upperBound(arr, target, comparator)];
}
