// ─── Unit Tests: Cron Parser ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCron, matchesCron, nextMatches } from '../../app/modules/cron-parser.js';

// ─── parseCron ────────────────────────────────────────────────────────────────

describe('parseCron – field parsing', () => {
  it('parses wildcard * fields', () => {
    const expr = parseCron('* * * * *');
    assert.equal(expr.minute.type, 'all');
    assert.equal(expr.hour.type, 'all');
    assert.equal(expr.dayOfMonth.type, 'all');
    assert.equal(expr.month.type, 'all');
    assert.equal(expr.dayOfWeek.type, 'all');
    assert.equal(expr.minute.values.length, 60);   // 0-59
    assert.equal(expr.hour.values.length, 24);     // 0-23
    assert.equal(expr.month.values.length, 12);    // 1-12
    assert.equal(expr.dayOfWeek.values.length, 7); // 0-6
  });

  it('parses specific values', () => {
    const expr = parseCron('30 14 1 6 3');
    assert.equal(expr.minute.type, 'value');
    assert.deepEqual(expr.minute.values, [30]);
    assert.equal(expr.hour.type, 'value');
    assert.deepEqual(expr.hour.values, [14]);
    assert.equal(expr.dayOfMonth.type, 'value');
    assert.deepEqual(expr.dayOfMonth.values, [1]);
    assert.equal(expr.month.type, 'value');
    assert.deepEqual(expr.month.values, [6]);
    assert.equal(expr.dayOfWeek.type, 'value');
    assert.deepEqual(expr.dayOfWeek.values, [3]);
  });

  it('parses */step syntax', () => {
    const expr = parseCron('*/15 */6 * * *');
    assert.equal(expr.minute.type, 'step');
    assert.deepEqual(expr.minute.values, [0, 15, 30, 45]);
    assert.equal(expr.hour.type, 'step');
    assert.deepEqual(expr.hour.values, [0, 6, 12, 18]);
  });

  it('parses range syntax a-b', () => {
    const expr = parseCron('0 9-17 * * *');
    assert.equal(expr.hour.type, 'range');
    assert.deepEqual(expr.hour.values, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('parses range with step a-b/step', () => {
    const expr = parseCron('0 8-20/4 * * *');
    assert.equal(expr.hour.type, 'step');
    assert.deepEqual(expr.hour.values, [8, 12, 16, 20]);
  });

  it('parses comma-separated list', () => {
    const expr = parseCron('0 0 1,15 * *');
    assert.equal(expr.dayOfMonth.type, 'list');
    assert.deepEqual(expr.dayOfMonth.values, [1, 15]);
  });

  it('parses mixed list with ranges', () => {
    const expr = parseCron('0,30 8-10,14 * * *');
    assert.equal(expr.minute.type, 'list');
    assert.deepEqual(expr.minute.values, [0, 30]);
    assert.equal(expr.hour.type, 'list');
    assert.deepEqual(expr.hour.values, [8, 9, 10, 14]);
  });

  it('parses month names (case-insensitive)', () => {
    const expr = parseCron('0 0 1 jan,feb,DEC *');
    assert.equal(expr.month.type, 'list');
    assert.deepEqual(expr.month.values, [1, 2, 12]);
  });

  it('parses weekday names (case-insensitive)', () => {
    const expr = parseCron('0 0 * * mon,WED,fri');
    assert.equal(expr.dayOfWeek.type, 'list');
    assert.deepEqual(expr.dayOfWeek.values, [1, 3, 5]);
  });

  it('parses sun as 0', () => {
    const expr = parseCron('0 0 * * sun');
    assert.deepEqual(expr.dayOfWeek.values, [0]);
  });

  it('parses sat as 6', () => {
    const expr = parseCron('0 0 * * sat');
    assert.deepEqual(expr.dayOfWeek.values, [6]);
  });

  it('throws on wrong number of fields', () => {
    assert.throws(() => parseCron('* * *'), /5 cron fields/);
    assert.throws(() => parseCron('* * * * * *'), /5 cron fields/);
  });

  it('throws on out-of-range values', () => {
    assert.throws(() => parseCron('60 * * * *'));  // minute 60 is out of range
    assert.throws(() => parseCron('* 24 * * *'));  // hour 24 out of range
    assert.throws(() => parseCron('* * 0 * *'));   // dom 0 out of range
    assert.throws(() => parseCron('* * * 13 *'));  // month 13 out of range
  });

  it('handles 7 as Sunday alias for dow', () => {
    const expr = parseCron('0 0 * * 7');
    assert.deepEqual(expr.dayOfWeek.values, [0]); // normalised to 0
  });
});

// ─── matchesCron ─────────────────────────────────────────────────────────────

describe('matchesCron', () => {
  it('matches every minute for * * * * *', () => {
    const d = new Date(2024, 0, 1, 10, 30, 0); // 2024-01-01 10:30
    assert.equal(matchesCron('* * * * *', d), true);
  });

  it('matches specific time', () => {
    // 14:30 on any day
    const yes = new Date(2024, 5, 15, 14, 30); // 2024-06-15 14:30
    const no  = new Date(2024, 5, 15, 14, 31); // 14:31
    assert.equal(matchesCron('30 14 * * *', yes), true);
    assert.equal(matchesCron('30 14 * * *', no),  false);
  });

  it('does not match wrong hour', () => {
    const d = new Date(2024, 0, 1, 9, 0);
    assert.equal(matchesCron('0 10 * * *', d), false);
  });

  it('matches specific day of month', () => {
    const yes = new Date(2024, 0, 15, 0, 0);
    const no  = new Date(2024, 0, 14, 0, 0);
    assert.equal(matchesCron('0 0 15 * *', yes), true);
    assert.equal(matchesCron('0 0 15 * *', no),  false);
  });

  it('matches specific month', () => {
    const yes = new Date(2024, 5, 1, 0, 0); // June = month 6
    const no  = new Date(2024, 6, 1, 0, 0); // July = month 7
    assert.equal(matchesCron('0 0 1 6 *', yes), true);
    assert.equal(matchesCron('0 0 1 6 *', no),  false);
  });

  it('matches month by name', () => {
    const d = new Date(2024, 11, 25, 0, 0); // 2024-12-25
    assert.equal(matchesCron('0 0 25 dec *', d), true);
    assert.equal(matchesCron('0 0 25 nov *', d), false);
  });

  it('matches day of week', () => {
    // 2024-01-01 is a Monday (dow=1)
    const monday = new Date(2024, 0, 1, 10, 0);
    assert.equal(matchesCron('0 10 * * 1', monday), true);
    assert.equal(matchesCron('0 10 * * 2', monday), false);
  });

  it('matches weekday by name', () => {
    // 2024-01-07 is a Sunday (dow=0)
    const sunday = new Date(2024, 0, 7, 0, 0);
    assert.equal(matchesCron('0 0 * * sun', sunday), true);
    assert.equal(matchesCron('0 0 * * mon', sunday), false);
  });

  it('matches step expression */15 for minutes', () => {
    const yes1 = new Date(2024, 0, 1, 0,  0);
    const yes2 = new Date(2024, 0, 1, 0, 15);
    const yes3 = new Date(2024, 0, 1, 0, 30);
    const yes4 = new Date(2024, 0, 1, 0, 45);
    const no   = new Date(2024, 0, 1, 0,  7);
    assert.equal(matchesCron('*/15 * * * *', yes1), true);
    assert.equal(matchesCron('*/15 * * * *', yes2), true);
    assert.equal(matchesCron('*/15 * * * *', yes3), true);
    assert.equal(matchesCron('*/15 * * * *', yes4), true);
    assert.equal(matchesCron('*/15 * * * *', no),   false);
  });

  it('matches range expression 9-17 for hours', () => {
    const yes = new Date(2024, 0, 1, 9,  0);
    const no  = new Date(2024, 0, 1, 8,  0);
    assert.equal(matchesCron('0 9-17 * * *', yes), true);
    assert.equal(matchesCron('0 9-17 * * *', no),  false);
  });

  it('dom-dow union: matches if EITHER dom or dow matches when both restricted', () => {
    // dow=0 (Sunday) restricted, dom=15 restricted
    // 2024-01-15 is Monday (dow=1), but dom matches
    const domMatch = new Date(2024, 0, 15, 0, 0);
    // 2024-01-07 is Sunday (dow=0), but dom doesn't match
    const dowMatch = new Date(2024, 0, 7, 0, 0);
    // 2024-01-08 is Monday (dow=1), dom doesn't match → no match
    const noMatch  = new Date(2024, 0, 8, 0, 0);
    assert.equal(matchesCron('0 0 15 * 0', domMatch), true);
    assert.equal(matchesCron('0 0 15 * 0', dowMatch), true);
    assert.equal(matchesCron('0 0 15 * 0', noMatch),  false);
  });
});

// ─── nextMatches ─────────────────────────────────────────────────────────────

describe('nextMatches', () => {
  it('returns the next matching minute', () => {
    // Every minute, so next minute from now should match
    const from = new Date(2024, 0, 1, 10, 0, 30); // 10:00:30
    const results = nextMatches('* * * * *', from, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].getHours(), 10);
    assert.equal(results[0].getMinutes(), 1);
    assert.equal(results[0].getSeconds(), 0);
  });

  it('returns the next N matching times', () => {
    // Hourly at minute 0
    const from = new Date(2024, 0, 1, 10, 30);
    const results = nextMatches('0 * * * *', from, 3);
    assert.equal(results.length, 3);
    assert.equal(results[0].getHours(), 11);
    assert.equal(results[0].getMinutes(), 0);
    assert.equal(results[1].getHours(), 12);
    assert.equal(results[2].getHours(), 13);
  });

  it('defaults count to 1', () => {
    const from = new Date(2024, 0, 1, 10, 0);
    const results = nextMatches('0 12 * * *', from);
    assert.equal(results.length, 1);
    assert.equal(results[0].getHours(), 12);
  });

  it('finds the next match across a day boundary', () => {
    // Daily at midnight
    const from = new Date(2024, 0, 1, 23, 30); // 2024-01-01 23:30
    const results = nextMatches('0 0 * * *', from, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].getDate(), 2);
    assert.equal(results[0].getHours(), 0);
    assert.equal(results[0].getMinutes(), 0);
  });

  it('finds the next match for a specific weekday', () => {
    // Next Monday at noon — 2024-01-01 is Monday, from=2024-01-01 13:00
    // so next Monday is 2024-01-08
    const from = new Date(2024, 0, 1, 13, 0); // Monday 13:00
    const results = nextMatches('0 12 * * 1', from, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].getFullYear(), 2024);
    assert.equal(results[0].getMonth(), 0);
    assert.equal(results[0].getDate(), 8);
  });

  it('finds multiple matches for every-15-minutes', () => {
    const from = new Date(2024, 0, 1, 10, 0); // 10:00
    const results = nextMatches('*/15 10 * * *', from, 3);
    assert.equal(results.length, 3);
    assert.equal(results[0].getMinutes(), 15);
    assert.equal(results[1].getMinutes(), 30);
    assert.equal(results[2].getMinutes(), 45);
  });

  it('returns empty array when no match found within 4 years', () => {
    // Feb 30 never exists
    const from = new Date(2024, 0, 1);
    const results = nextMatches('0 0 30 2 *', from, 1);
    assert.equal(results.length, 0);
  });

  it('does not include the `from` minute itself', () => {
    // from is exactly at 10:00; * * * * * should give 10:01 first, not 10:00
    const from = new Date(2024, 0, 1, 10, 0, 0);
    const results = nextMatches('* * * * *', from, 1);
    assert.equal(results[0].getMinutes(), 1);
  });

  it('correctly advances past midnight for monthly schedule', () => {
    // 1st of next month at midnight
    const from = new Date(2024, 0, 15, 0, 0); // 2024-01-15
    const results = nextMatches('0 0 1 * *', from, 2);
    assert.equal(results.length, 2);
    assert.equal(results[0].getMonth(), 1); // February
    assert.equal(results[0].getDate(), 1);
    assert.equal(results[1].getMonth(), 2); // March
    assert.equal(results[1].getDate(), 1);
  });
});
