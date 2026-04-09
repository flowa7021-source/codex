// @ts-check
// ─── Phonetic Algorithms ─────────────────────────────────────────────────────
// Phonetic encoding and matching algorithms: Soundex, Metaphone, Double
// Metaphone, NYSIIS, and utilities for comparison and grouping.
// No browser APIs — pure algorithmic implementations.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip non-alphabetic characters and upper-case. */
function clean(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, '');
}

// ─── Soundex ─────────────────────────────────────────────────────────────────

/** Soundex digit table. */
const SOUNDEX_MAP: Record<string, string> = {
  B: '1', F: '1', P: '1', V: '1',
  C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
  D: '3', T: '3',
  L: '4',
  M: '5', N: '5',
  R: '6',
};

/**
 * Encode a word using the Soundex algorithm.
 * Returns a 4-character code: one letter + three digits (zero-padded).
 * Example: 'Robert' → 'R163'
 */
export function soundex(word: string): string {
  const upper = clean(word);
  if (upper.length === 0) return '';

  const first = upper[0];
  let code = first;
  let prev = SOUNDEX_MAP[first] ?? '0';

  for (let i = 1; i < upper.length && code.length < 4; i++) {
    const digit = SOUNDEX_MAP[upper[i]] ?? '0';
    // Skip H and W (no digit) and adjacent duplicates
    if (digit !== '0' && digit !== prev) {
      code += digit;
    }
    // H and W do not reset the previous digit
    if (upper[i] !== 'H' && upper[i] !== 'W') {
      prev = digit;
    }
  }

  // Pad with zeros
  return code.padEnd(4, '0');
}

// ─── Metaphone ───────────────────────────────────────────────────────────────

/**
 * Encode a word using the original Metaphone algorithm.
 * Returns a string of consonant sounds.
 */
export function metaphone(word: string): string {
  let s = clean(word);
  if (s.length === 0) return '';

  // Initial transformations
  if (/^AE|^GN|^KN|^PN|^WR/.test(s)) s = s.slice(1);
  if (s[0] === 'I' || s[0] === 'E') s = s[0] + s.slice(1); // keep vowel at start
  // Drop initial vowel (Metaphone encodes initial vowels separately but many
  // implementations drop them; we keep it as-is and handle below)

  let result = '';
  const len = s.length;

  const at = (i: number, ...chars: string[]): boolean =>
    chars.some((c) => s.slice(i, i + c.length) === c);
  const vowel = (i: number): boolean => 'AEIOU'.includes(s[i] ?? '');

  for (let i = 0; i < len; i++) {
    const ch = s[i];

    // Drop duplicate adjacent letters (except C)
    if (ch !== 'C' && s[i - 1] === ch) continue;

    if ('AEIOU'.includes(ch)) {
      // Initial vowels are retained; others are dropped
      if (i === 0) result += ch;
      continue;
    }

    switch (ch) {
      case 'B':
        // Drop B if after M at end of word
        if (!(i === len - 1 && s[i - 1] === 'M')) result += 'B';
        break;

      case 'C':
        if (at(i, 'CIA') || at(i, 'CH')) {
          result += 'X';
          i += at(i, 'CH') ? 1 : 2;
        } else if (at(i, 'CI') || at(i, 'CE') || at(i, 'CY')) {
          result += 'S';
          i++;
        } else if (at(i, 'SCE') || at(i, 'SCI') || at(i, 'SCY')) {
          // silent — already handled by S
        } else {
          result += 'K';
        }
        break;

      case 'D':
        if (at(i, 'DGE') || at(i, 'DGI') || at(i, 'DGY')) {
          result += 'J';
          i++;
        } else {
          result += 'T';
        }
        break;

      case 'F':
        result += 'F';
        break;

      case 'G':
        if (at(i, 'GH')) {
          if (i === 0 && vowel(i + 2)) {
            result += 'K';
          } else if (i > 0 && !vowel(i - 1)) {
            // silent
          }
          i++;
        } else if (at(i, 'GN') || at(i, 'GNED')) {
          // silent
        } else if (at(i, 'GE') || at(i, 'GI') || at(i, 'GY')) {
          result += 'J';
        } else {
          result += 'K';
        }
        break;

      case 'H':
        if (vowel(i + 1) && !at(i - 1, 'A', 'E', 'I', 'O', 'U', 'H')) {
          result += 'H';
        }
        break;

      case 'J':
        result += 'J';
        break;

      case 'K':
        if (s[i - 1] !== 'C') result += 'K';
        break;

      case 'L':
        result += 'L';
        break;

      case 'M':
        result += 'M';
        break;

      case 'N':
        result += 'N';
        break;

      case 'P':
        if (at(i, 'PH')) {
          result += 'F';
          i++;
        } else {
          result += 'P';
        }
        break;

      case 'Q':
        result += 'K';
        break;

      case 'R':
        result += 'R';
        break;

      case 'S':
        if (at(i, 'SH') || at(i, 'SIO') || at(i, 'SIA')) {
          result += 'X';
          i++;
        } else {
          result += 'S';
        }
        break;

      case 'T':
        if (at(i, 'TIA') || at(i, 'TIO')) {
          result += 'X';
          i++;
        } else if (at(i, 'TH')) {
          result += '0'; // θ
          i++;
        } else if (!at(i, 'TCH')) {
          result += 'T';
        }
        break;

      case 'V':
        result += 'F';
        break;

      case 'W':
        if (vowel(i + 1)) result += 'W';
        break;

      case 'X':
        result += 'KS';
        break;

      case 'Y':
        if (vowel(i + 1)) result += 'Y';
        break;

      case 'Z':
        result += 'S';
        break;
    }
  }

  return result;
}

// ─── Double Metaphone ─────────────────────────────────────────────────────────

/**
 * Encode a word using the Double Metaphone algorithm.
 * Returns a tuple [primary, secondary].
 * The secondary may equal the primary when no divergence occurs.
 */
export function doubleMetaphone(word: string): [string, string] {
  // Normalise to upper-case, strip non-alpha
  const s = clean(word);
  if (s.length === 0) return ['', ''];

  let pri = '';
  let sec = '';
  let i = 0;
  const len = s.length;

  const at = (pos: number, ...seqs: string[]): boolean =>
    seqs.some((sq) => s.slice(pos, pos + sq.length) === sq);
  const vowel = (pos: number): boolean => 'AEIOU'.includes(s[pos] ?? '');
  const add = (p: string, q?: string) => {
    pri += p;
    sec += q !== undefined ? q : p;
  };

  // Handle initial silent letters
  if (at(0, 'GN', 'KN', 'PN', 'AE', 'WR')) i = 1;

  // Initial vowel → A
  if (vowel(0)) {
    add('A');
    i = 1;
  }

  while (i < len) {
    const ch = s[i];

    switch (ch) {
      case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
        // Vowels only at start (handled above); otherwise skip
        i++;
        break;

      case 'B':
        add('P');
        i += s[i + 1] === 'B' ? 2 : 1;
        break;

      case 'Ç':
        add('S');
        i++;
        break;

      case 'C':
        if (at(i, 'CCIA') || at(i, 'CCE') || at(i, 'CCI')) {
          add('X', 'S');
          i += 3;
        } else if (at(i, 'CH')) {
          if (i === 0 && len > 5 && at(0, 'CHAE')) {
            add('K', 'X');
          } else {
            add('X');
          }
          i += 2;
        } else if (at(i, 'CI') || at(i, 'CE') || at(i, 'CY')) {
          add('S');
          i += 2;
        } else if (at(i, 'CK') || at(i, 'CG') || at(i, 'CQ')) {
          add('K');
          i += 2;
        } else {
          add('K');
          i += at(i, 'CC') ? 2 : 1;
        }
        break;

      case 'D':
        if (at(i, 'DG') && 'IEY'.includes(s[i + 2] ?? '')) {
          add('J');
          i += 3;
        } else if (at(i, 'DT') || at(i, 'DD')) {
          add('T');
          i += 2;
        } else {
          add('T');
          i++;
        }
        break;

      case 'F':
        add('F');
        i += s[i + 1] === 'F' ? 2 : 1;
        break;

      case 'G':
        if (at(i, 'GH')) {
          if (i > 0 && !vowel(i - 1)) {
            i += 2;
            break;
          }
          if (i === 0) {
            add(at(i + 2, 'I') ? 'J' : 'K');
            i += 2;
            break;
          }
          if ((i > 1 && 'BHD'.includes(s[i - 2])) ||
              (i > 2 && 'BHD'.includes(s[i - 3])) ||
              (i > 3 && ('BE'.includes(s[i - 4]) || s[i - 4] === 'H'))) {
            i += 2;
            break;
          }
          if (i > 2 && s[i - 2] === 'U' && 'CGLRT'.includes(s[i - 3] ?? '')) {
            add('F');
          } else if (i > 0 && s[i - 1] !== 'I') {
            add('K');
          }
          i += 2;
        } else if (at(i, 'GN')) {
          if (i === 1 && vowel(0)) {
            add('KN', 'N');
          } else if (!at(i + 2, 'EY') && s[i + 1] !== 'Y') {
            add('N', 'KN');
          } else {
            add('KN');
          }
          i += 2;
        } else if (at(i, 'GL') && i === 1 && vowel(0)) {
          add('KL', 'L');
          i += 2;
        } else if (i === 0 && !at(i, 'GY') && !vowel(i + 1)) {
          add('K');
          i++;
        } else if (at(i, 'GE') || at(i, 'GI') || at(i, 'GY') ||
                   at(i, 'GER') || at(i, 'GIR')) {
          add('K', 'J');
          i++;
        } else if ('EIY'.includes(s[i + 1] ?? '')) {
          add('K', 'J');
          i += 2;
        } else if (at(i, 'GG')) {
          add('K');
          i += 2;
        } else {
          add('K');
          i++;
        }
        break;

      case 'H':
        if (vowel(i + 1) && (i === 0 || vowel(i - 1))) {
          add('H');
        }
        i++;
        break;

      case 'J':
        if (at(i, 'JOSE') || at(0, 'SAN ')) {
          add('H', 'J');
        } else if (i === 0) {
          add('J', 'A');
        } else if (vowel(i - 1) && i === len - 1) {
          add('J', 'H');
        } else {
          add('J');
        }
        i += s[i + 1] === 'J' ? 2 : 1;
        break;

      case 'K':
        add('K');
        i += s[i + 1] === 'K' ? 2 : 1;
        break;

      case 'L':
        if (s[i + 1] === 'L') {
          if ((i === len - 3 && at(i - 1, 'ILLO', 'ILLA', 'ALLE')) ||
              ((at(len - 2, 'AS') || at(len - 1, 'A') || at(len - 1, 'O')) && at(i - 1, 'ALLE'))) {
            add('L', '');
          } else {
            add('L');
          }
          i += 2;
        } else {
          add('L');
          i++;
        }
        break;

      case 'M':
        if ((at(i - 1, 'UMB') && (i + 1 === len || at(i + 2, 'ER'))) ||
            s[i + 1] === 'M') {
          add('M');
          i += 2;
        } else {
          add('M');
          i++;
        }
        break;

      case 'N':
        add('N');
        i += s[i + 1] === 'N' ? 2 : 1;
        break;

      case 'Ñ':
        add('N');
        i++;
        break;

      case 'P':
        if (s[i + 1] === 'H') {
          add('F');
          i += 2;
        } else {
          add('P');
          i += s[i + 1] === 'P' ? 2 : 1;
        }
        break;

      case 'Q':
        add('K');
        i += s[i + 1] === 'Q' ? 2 : 1;
        break;

      case 'R':
        if (i === len - 1 && !vowel(i - 1) && at(i - 2, 'IE') && !at(i - 4, 'ME') && !at(i - 4, 'MA')) {
          add('', 'R');
        } else {
          add('R');
        }
        i += s[i + 1] === 'R' ? 2 : 1;
        break;

      case 'S':
        if (at(i, 'ISL') || at(i, 'YSL')) {
          i++;
          break;
        }
        if (i === 0 && at(i, 'SUGAR')) {
          add('X', 'S');
          i++;
          break;
        }
        if (at(i, 'SH') || at(i, 'SIO') || at(i, 'SIA')) {
          add('X');
          i += at(i, 'SH') ? 2 : 3;
          break;
        }
        if (at(i, 'SC')) {
          if (s[i + 2] === 'H') {
            add('SK');
            i += 3;
          } else if ('IEY'.includes(s[i + 2] ?? '')) {
            add('S');
            i += 3;
          } else {
            add('SK');
            i += 3;
          }
          break;
        }
        if (i === len - 1 && at(i - 2, 'AI') || at(i - 2, 'OI')) {
          add('', 'S');
        } else {
          add('S');
        }
        i += s[i + 1] === 'S' ? 2 : 1;
        break;

      case 'T':
        if (at(i, 'TION') || at(i, 'TIA') || at(i, 'TCH')) {
          add('X');
          i += at(i, 'TCH') ? 3 : 3;
          break;
        }
        if (at(i, 'TH') || at(i, 'TTH')) {
          add('T', '0');
          i += 2;
          break;
        }
        add('T');
        i += at(i, 'TT') ? 2 : 1;
        break;

      case 'V':
        add('F');
        i += s[i + 1] === 'V' ? 2 : 1;
        break;

      case 'W':
        if (at(i, 'WR')) {
          add('R');
          i += 2;
          break;
        }
        if (i === 0 && (vowel(i + 1) || at(i, 'WH'))) {
          add(vowel(i + 1) ? 'A' : 'A');
          i++;
          break;
        }
        if ((i === len - 1 && vowel(i - 1)) || at(i - 1, 'EWSKI', 'EWSKY', 'OWSKI', 'OWSKY') ||
            at(0, 'SCH')) {
          add('', 'F');
          i++;
          break;
        }
        if (at(i, 'WICZ') || at(i, 'WITZ')) {
          add('TS', 'FX');
          i += 4;
          break;
        }
        i++;
        break;

      case 'X':
        if (!(i === len - 1 && (at(i - 3, 'IAU') || at(i - 3, 'EAU') || at(i - 2, 'AU') || at(i - 2, 'OU')))) {
          add('KS');
        }
        i += s[i + 1] === 'X' ? 2 : 1;
        break;

      case 'Z':
        if (s[i + 1] === 'H') {
          add('J');
          i += 2;
        } else {
          add('S', s[i + 1] === 'Z' ? 'S' : 'TS');
          i += s[i + 1] === 'Z' ? 2 : 1;
        }
        break;

      default:
        i++;
        break;
    }
  }

  // Limit lengths to 4 each (common convention)
  return [pri.slice(0, 4), sec.slice(0, 4)];
}

// ─── NYSIIS ───────────────────────────────────────────────────────────────────

/**
 * Encode a word using the New York State Identification and Intelligence System
 * (NYSIIS) phonetic algorithm.
 * Returns an upper-case code of up to 6 characters.
 */
export function nysiis(word: string): string {
  let s = clean(word);
  if (s.length === 0) return '';

  // Step 1: Translate initial characters
  const prefixMap: [string, string][] = [
    ['MAC', 'MCC'],
    ['KN', 'N'],
    ['K', 'C'],
    ['PH', 'FF'],
    ['PF', 'FF'],
    ['SCH', 'SSS'],
  ];
  for (const [from, to] of prefixMap) {
    if (s.startsWith(from)) {
      s = to + s.slice(from.length);
      break;
    }
  }

  // Step 2: Translate suffix
  const suffixMap: [string, string][] = [
    ['EE', 'Y'],
    ['IE', 'Y'],
    ['DT', 'D'],
    ['RT', 'D'],
    ['RD', 'D'],
    ['NT', 'N'],
    ['ND', 'N'],
  ];
  for (const [from, to] of suffixMap) {
    if (s.endsWith(from)) {
      s = s.slice(0, -from.length) + to;
      break;
    }
  }

  // Step 3: First character of key = first character of name
  const first = s[0];
  let key = first;
  s = s.slice(1); // process rest

  // Step 4: Apply transformation rules
  const vowel = (c: string): boolean => 'AEIOU'.includes(c);

  let result = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let mapped = '';

    if (s.slice(i, i + 2) === 'EV') {
      mapped = 'AF'; i += 2;
    } else if (vowel(c)) {
      mapped = 'A'; i++;
    } else if (c === 'Q') {
      mapped = 'G'; i++;
    } else if (c === 'Z') {
      mapped = 'S'; i++;
    } else if (c === 'M') {
      mapped = 'N'; i++;
    } else if (s.slice(i, i + 2) === 'KN') {
      mapped = 'N'; i += 2;
    } else if (c === 'K') {
      mapped = 'C'; i++;
    } else if (s.slice(i, i + 3) === 'SCH') {
      mapped = 'SSS'; i += 3;
    } else if (s.slice(i, i + 2) === 'PH') {
      mapped = 'FF'; i += 2;
    } else if (c === 'H' && (!vowel(s[i - 1] ?? '') || !vowel(s[i + 1] ?? ''))) {
      // Preceding or following vowel absent → use preceding character
      mapped = s[i - 1] ?? ''; i++;
    } else if (c === 'W' && vowel(s[i - 1] ?? '')) {
      mapped = s[i - 1] ?? ''; i++;
    } else {
      mapped = c; i++;
    }

    result += mapped;
  }

  // Step 5: Remove duplicate adjacent letters
  let deduped = '';
  for (let j = 0; j < result.length; j++) {
    if (j === 0 || result[j] !== result[j - 1]) {
      deduped += result[j];
    }
  }

  // Step 6: Remove trailing S or trailing AY → Y
  if (deduped.endsWith('AY')) {
    deduped = deduped.slice(0, -2) + 'Y';
  } else if (deduped.endsWith('A')) {
    deduped = deduped.slice(0, -1);
  }

  // Prepend the first character and limit to 6
  return (first + deduped).slice(0, 6);
}

// ─── phoneticMatch ────────────────────────────────────────────────────────────

/**
 * Compare two words phonetically using the specified algorithm.
 * Returns true if their phonetic codes match.
 */
export function phoneticMatch(
  a: string,
  b: string,
  algorithm: 'soundex' | 'metaphone' | 'nysiis' = 'soundex',
): boolean {
  switch (algorithm) {
    case 'soundex':
      return soundex(a) === soundex(b);
    case 'metaphone':
      return metaphone(a) === metaphone(b);
    case 'nysiis':
      return nysiis(a) === nysiis(b);
  }
}

// ─── phoneticGroup ────────────────────────────────────────────────────────────

/**
 * Group an array of words by their phonetic code.
 * Returns a Map from phonetic code → list of original words.
 */
export function phoneticGroup(
  words: string[],
  algorithm: 'soundex' | 'metaphone' | 'nysiis' = 'soundex',
): Map<string, string[]> {
  const encode =
    algorithm === 'soundex' ? soundex : algorithm === 'metaphone' ? metaphone : nysiis;

  const map = new Map<string, string[]>();
  for (const word of words) {
    const code = encode(word);
    const group = map.get(code);
    if (group) {
      group.push(word);
    } else {
      map.set(code, [word]);
    }
  }
  return map;
}
