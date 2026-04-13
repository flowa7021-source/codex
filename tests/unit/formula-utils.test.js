// ─── Unit Tests: formula-utils ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateFormula,
  callFunction,
  parseCellRef,
  colToLetter,
  letterToCol,
} from '../../app/modules/formula-utils.js';

// ─── evaluateFormula — arithmetic ────────────────────────────────────────────

describe('evaluateFormula — arithmetic', () => {
  it('evaluates =1+2 to 3', () => {
    assert.equal(evaluateFormula('=1+2'), 3);
  });

  it('evaluates =10-4 to 6', () => {
    assert.equal(evaluateFormula('=10-4'), 6);
  });

  it('evaluates =3*4 to 12', () => {
    assert.equal(evaluateFormula('=3*4'), 12);
  });

  it('evaluates =8/2 to 4', () => {
    assert.equal(evaluateFormula('=8/2'), 4);
  });

  it('evaluates =2^8 to 256', () => {
    assert.equal(evaluateFormula('=2^8'), 256);
  });

  it('evaluates =(2+3)*4 to 20', () => {
    assert.equal(evaluateFormula('=(2+3)*4'), 20);
  });

  it('evaluates formula without leading =', () => {
    assert.equal(evaluateFormula('5+5'), 10);
  });
});

// ─── evaluateFormula — comparisons ───────────────────────────────────────────

describe('evaluateFormula — comparisons', () => {
  it('evaluates =1>0 to true', () => {
    assert.equal(evaluateFormula('=1>0'), true);
  });

  it('evaluates =1<0 to false', () => {
    assert.equal(evaluateFormula('=1<0'), false);
  });

  it('evaluates =1=1 to true', () => {
    assert.equal(evaluateFormula('=1=1'), true);
  });

  it('evaluates =1<>2 to true', () => {
    assert.equal(evaluateFormula('=1<>2'), true);
  });

  it('evaluates =2>=2 to true', () => {
    assert.equal(evaluateFormula('=2>=2'), true);
  });

  it('evaluates =1<=0 to false', () => {
    assert.equal(evaluateFormula('=1<=0'), false);
  });
});

// ─── evaluateFormula — functions ─────────────────────────────────────────────

describe('evaluateFormula — functions', () => {
  it('evaluates =SUM(1,2,3) to 6', () => {
    assert.equal(evaluateFormula('=SUM(1,2,3)'), 6);
  });

  it('evaluates =IF(1>0,"yes","no") to "yes"', () => {
    assert.equal(evaluateFormula('=IF(1>0,"yes","no")'), 'yes');
  });

  it('evaluates =IF(1<0,"yes","no") to "no"', () => {
    assert.equal(evaluateFormula('=IF(1<0,"yes","no")'), 'no');
  });

  it('evaluates =AVERAGE(2,4,6) to 4', () => {
    assert.equal(evaluateFormula('=AVERAGE(2,4,6)'), 4);
  });

  it('evaluates =MAX(1,5,3) to 5', () => {
    assert.equal(evaluateFormula('=MAX(1,5,3)'), 5);
  });

  it('evaluates =MIN(1,5,3) to 1', () => {
    assert.equal(evaluateFormula('=MIN(1,5,3)'), 1);
  });

  it('evaluates =ROUND(3.567,2) to 3.57', () => {
    assert.equal(evaluateFormula('=ROUND(3.567,2)'), 3.57);
  });

  it('evaluates =CONCAT("hello"," ","world") to "hello world"', () => {
    assert.equal(evaluateFormula('=CONCAT("hello"," ","world")'), 'hello world');
  });

  it('evaluates =LEN("hello") to 5', () => {
    assert.equal(evaluateFormula('=LEN("hello")'), 5);
  });

  it('evaluates =UPPER("hello") to "HELLO"', () => {
    assert.equal(evaluateFormula('=UPPER("hello")'), 'HELLO');
  });

  it('evaluates =LOWER("HELLO") to "hello"', () => {
    assert.equal(evaluateFormula('=LOWER("HELLO")'), 'hello');
  });

  it('evaluates =COUNT(1,2,3) to 3', () => {
    assert.equal(evaluateFormula('=COUNT(1,2,3)'), 3);
  });
});

// ─── evaluateFormula — cell references ───────────────────────────────────────

describe('evaluateFormula — cell references', () => {
  it('reads a cell value from context', () => {
    const ctx = { cells: { A1: 10, B1: 20 } };
    assert.equal(evaluateFormula('=A1+B1', ctx), 30);
  });

  it('returns null for missing cell reference', () => {
    assert.equal(evaluateFormula('=A1', {}), null);
  });

  it('uses cell value in function', () => {
    const ctx = { cells: { A1: 5, A2: 15 } };
    assert.equal(evaluateFormula('=SUM(A1,A2)', ctx), 20);
  });
});

// ─── evaluateFormula — string operations ─────────────────────────────────────

describe('evaluateFormula — string literals and concatenation', () => {
  it('returns a string literal', () => {
    assert.equal(evaluateFormula('="hello"'), 'hello');
  });

  it('concatenates with & operator', () => {
    assert.equal(evaluateFormula('="foo"&"bar"'), 'foobar');
  });

  it('handles boolean literals', () => {
    assert.equal(evaluateFormula('=TRUE'), true);
    assert.equal(evaluateFormula('=FALSE'), false);
  });
});

// ─── callFunction ─────────────────────────────────────────────────────────────

describe('callFunction — SUM', () => {
  it('sums numbers', () => {
    assert.equal(callFunction('SUM', [1, 2, 3, 4]), 10);
  });

  it('returns 0 for empty args', () => {
    assert.equal(callFunction('SUM', []), 0);
  });
});

describe('callFunction — AVERAGE', () => {
  it('returns average', () => {
    assert.equal(callFunction('AVERAGE', [2, 4, 6]), 4);
  });

  it('returns 0 for empty args', () => {
    assert.equal(callFunction('AVERAGE', []), 0);
  });
});

describe('callFunction — MIN / MAX', () => {
  it('MIN returns smallest', () => {
    assert.equal(callFunction('MIN', [5, 3, 8, 1]), 1);
  });

  it('MAX returns largest', () => {
    assert.equal(callFunction('MAX', [5, 3, 8, 1]), 8);
  });
});

describe('callFunction — COUNT', () => {
  it('counts numeric values', () => {
    assert.equal(callFunction('COUNT', [1, 2, 3]), 3);
  });

  it('counts numeric strings', () => {
    assert.equal(callFunction('COUNT', ['1', '2', 'hello']), 2);
  });

  it('returns 0 for empty args', () => {
    assert.equal(callFunction('COUNT', []), 0);
  });
});

describe('callFunction — ROUND', () => {
  it('rounds to given decimal places', () => {
    assert.equal(callFunction('ROUND', [3.14159, 2]), 3.14);
  });

  it('rounds to integer when no digits arg', () => {
    assert.equal(callFunction('ROUND', [3.7]), 4);
  });
});

describe('callFunction — IF', () => {
  it('returns then-value when condition is truthy', () => {
    assert.equal(callFunction('IF', [true, 'yes', 'no']), 'yes');
  });

  it('returns else-value when condition is falsy', () => {
    assert.equal(callFunction('IF', [false, 'yes', 'no']), 'no');
  });

  it('returns null when condition is false and no else', () => {
    assert.equal(callFunction('IF', [false, 'yes']), null);
  });
});

describe('callFunction — CONCAT', () => {
  it('concatenates strings', () => {
    assert.equal(callFunction('CONCAT', ['a', 'b', 'c']), 'abc');
  });

  it('handles numbers by converting to string', () => {
    assert.equal(callFunction('CONCAT', ['val:', 42]), 'val:42');
  });
});

describe('callFunction — LEN', () => {
  it('returns length of string', () => {
    assert.equal(callFunction('LEN', ['hello']), 5);
  });

  it('returns 0 for empty string', () => {
    assert.equal(callFunction('LEN', ['']), 0);
  });
});

describe('callFunction — UPPER / LOWER', () => {
  it('UPPER converts to uppercase', () => {
    assert.equal(callFunction('UPPER', ['hello']), 'HELLO');
  });

  it('LOWER converts to lowercase', () => {
    assert.equal(callFunction('LOWER', ['HELLO']), 'hello');
  });
});

describe('callFunction — unknown function', () => {
  it('throws ReferenceError for unknown function', () => {
    assert.throws(
      () => callFunction('NOSUCHFN', []),
      (err) => err instanceof ReferenceError,
    );
  });
});

// ─── parseCellRef ─────────────────────────────────────────────────────────────

describe('parseCellRef', () => {
  it('parses A1 to {col:0, row:0}', () => {
    assert.deepEqual(parseCellRef('A1'), { col: 0, row: 0 });
  });

  it('parses B1 to {col:1, row:0}', () => {
    assert.deepEqual(parseCellRef('B1'), { col: 1, row: 0 });
  });

  it('parses B10 to {col:1, row:9}', () => {
    assert.deepEqual(parseCellRef('B10'), { col: 1, row: 9 });
  });

  it('parses Z1 to {col:25, row:0}', () => {
    assert.deepEqual(parseCellRef('Z1'), { col: 25, row: 0 });
  });

  it('parses AA1 to {col:26, row:0}', () => {
    assert.deepEqual(parseCellRef('AA1'), { col: 26, row: 0 });
  });

  it('is case-insensitive', () => {
    assert.deepEqual(parseCellRef('a1'), parseCellRef('A1'));
  });

  it('returns null for invalid reference', () => {
    assert.equal(parseCellRef('123'), null);
    assert.equal(parseCellRef(''), null);
    assert.equal(parseCellRef('A'), null);
  });
});

// ─── colToLetter ──────────────────────────────────────────────────────────────

describe('colToLetter', () => {
  it('0 → A', () => { assert.equal(colToLetter(0), 'A'); });
  it('1 → B', () => { assert.equal(colToLetter(1), 'B'); });
  it('25 → Z', () => { assert.equal(colToLetter(25), 'Z'); });
  it('26 → AA', () => { assert.equal(colToLetter(26), 'AA'); });
  it('27 → AB', () => { assert.equal(colToLetter(27), 'AB'); });
  it('51 → AZ', () => { assert.equal(colToLetter(51), 'AZ'); });
  it('52 → BA', () => { assert.equal(colToLetter(52), 'BA'); });
  it('701 → ZZ', () => { assert.equal(colToLetter(701), 'ZZ'); });
  it('702 → AAA', () => { assert.equal(colToLetter(702), 'AAA'); });

  it('throws for negative index', () => {
    assert.throws(() => colToLetter(-1), (err) => err instanceof RangeError);
  });
});

// ─── letterToCol ──────────────────────────────────────────────────────────────

describe('letterToCol', () => {
  it('A → 0', () => { assert.equal(letterToCol('A'), 0); });
  it('B → 1', () => { assert.equal(letterToCol('B'), 1); });
  it('Z → 25', () => { assert.equal(letterToCol('Z'), 25); });
  it('AA → 26', () => { assert.equal(letterToCol('AA'), 26); });
  it('AB → 27', () => { assert.equal(letterToCol('AB'), 27); });
  it('AZ → 51', () => { assert.equal(letterToCol('AZ'), 51); });
  it('BA → 52', () => { assert.equal(letterToCol('BA'), 52); });
  it('ZZ → 701', () => { assert.equal(letterToCol('ZZ'), 701); });
  it('AAA → 702', () => { assert.equal(letterToCol('AAA'), 702); });
  it('is case-insensitive', () => { assert.equal(letterToCol('a'), 0); });
});

// ─── colToLetter / letterToCol roundtrip ─────────────────────────────────────

describe('colToLetter / letterToCol roundtrip', () => {
  const cases = [0, 1, 25, 26, 27, 51, 52, 100, 500, 701, 702];

  for (const col of cases) {
    it(`roundtrip for index ${col}`, () => {
      assert.equal(letterToCol(colToLetter(col)), col);
    });
  }

  const letters = ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'];

  for (const letter of letters) {
    it(`roundtrip for letter ${letter}`, () => {
      assert.equal(colToLetter(letterToCol(letter)), letter);
    });
  }
});
