// ─── Unit Tests: SQL Query Builder ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryBuilder,
  select,
  insert,
  update,
  deleteFrom,
} from '../../app/modules/query-builder.js';

// ─── SELECT basic ─────────────────────────────────────────────────────────────

describe('SELECT – basic', () => {
  it('select * from a table', () => {
    const { sql } = select('*').from('users').build();
    assert.equal(sql, 'SELECT * FROM users');
  });

  it('select a single column', () => {
    const { sql } = select('id').from('users').build();
    assert.equal(sql, 'SELECT id FROM users');
  });

  it('select multiple columns', () => {
    const { sql } = select('id', 'name', 'email').from('users').build();
    assert.equal(sql, 'SELECT id, name, email FROM users');
  });

  it('select() with no args defaults to *', () => {
    const { sql } = select().from('products').build();
    assert.equal(sql, 'SELECT * FROM products');
  });

  it('from() sets the table', () => {
    const { sql } = select('id').from('orders').build();
    assert.ok(sql.includes('FROM orders'));
  });

  it('build() returns empty params for plain SELECT', () => {
    const { params } = select('*').from('users').build();
    assert.deepEqual(params, []);
  });

  it('chaining is fluent (returns QueryBuilder)', () => {
    const qb = select('x').from('t');
    assert.ok(qb instanceof QueryBuilder);
  });
});

// ─── WHERE / andWhere / orWhere ───────────────────────────────────────────────

describe('WHERE / andWhere / orWhere', () => {
  it('single where condition', () => {
    const { sql } = select('*').from('users').where('id = 1').build();
    assert.equal(sql, 'SELECT * FROM users WHERE id = 1');
  });

  it('where with placeholder', () => {
    const { sql } = select('*').from('users').where('id = ?').build();
    assert.ok(sql.includes('WHERE id = ?'));
  });

  it('andWhere appends with AND', () => {
    const { sql } = select('*').from('users')
      .where('active = 1')
      .andWhere('role = ?')
      .build();
    assert.equal(sql, 'SELECT * FROM users WHERE active = 1 AND role = ?');
  });

  it('orWhere appends with OR', () => {
    const { sql } = select('*').from('users')
      .where('status = ?')
      .orWhere('admin = 1')
      .build();
    assert.equal(sql, 'SELECT * FROM users WHERE status = ? OR admin = 1');
  });

  it('multiple andWhere clauses', () => {
    const { sql } = select('*').from('t')
      .where('a = 1')
      .andWhere('b = 2')
      .andWhere('c = 3')
      .build();
    assert.equal(sql, 'SELECT * FROM t WHERE a = 1 AND b = 2 AND c = 3');
  });

  it('mixed andWhere and orWhere', () => {
    const { sql } = select('*').from('t')
      .where('a = 1')
      .andWhere('b = 2')
      .orWhere('c = 3')
      .build();
    assert.equal(sql, 'SELECT * FROM t WHERE a = 1 AND b = 2 OR c = 3');
  });

  it('where replaces previous first condition if called once', () => {
    const { sql } = select('*').from('t').where('a = 1').build();
    assert.ok(sql.includes('WHERE a = 1'));
    assert.ok(!sql.includes('AND a = 1'));
  });

  it('no where clause produces no WHERE keyword', () => {
    const { sql } = select('*').from('t').build();
    assert.ok(!sql.includes('WHERE'));
  });
});

// ─── JOINs ────────────────────────────────────────────────────────────────────

describe('JOINs', () => {
  it('INNER JOIN (default)', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id')
      .build();
    assert.ok(sql.includes('INNER JOIN orders ON users.id = orders.user_id'));
  });

  it('explicit INNER JOIN', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id', 'INNER')
      .build();
    assert.ok(sql.includes('INNER JOIN'));
  });

  it('LEFT JOIN', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id', 'LEFT')
      .build();
    assert.ok(sql.includes('LEFT JOIN orders ON users.id = orders.user_id'));
  });

  it('RIGHT JOIN', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id', 'RIGHT')
      .build();
    assert.ok(sql.includes('RIGHT JOIN'));
  });

  it('FULL JOIN', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id', 'FULL')
      .build();
    assert.ok(sql.includes('FULL JOIN'));
  });

  it('multiple joins', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id', 'LEFT')
      .join('products', 'orders.product_id = products.id', 'INNER')
      .build();
    assert.ok(sql.includes('LEFT JOIN orders'));
    assert.ok(sql.includes('INNER JOIN products'));
  });

  it('join appears before WHERE', () => {
    const { sql } = select('*').from('users')
      .join('orders', 'users.id = orders.user_id')
      .where('users.active = 1')
      .build();
    const joinIdx = sql.indexOf('JOIN');
    const whereIdx = sql.indexOf('WHERE');
    assert.ok(joinIdx < whereIdx);
  });
});

// ─── ORDER BY, GROUP BY, HAVING ───────────────────────────────────────────────

describe('ORDER BY', () => {
  it('orderBy ascending (default)', () => {
    const { sql } = select('*').from('users').orderBy('name').build();
    assert.ok(sql.includes('ORDER BY name ASC'));
  });

  it('orderBy explicit ASC', () => {
    const { sql } = select('*').from('users').orderBy('name', 'ASC').build();
    assert.ok(sql.includes('ORDER BY name ASC'));
  });

  it('orderBy descending', () => {
    const { sql } = select('*').from('users').orderBy('created_at', 'DESC').build();
    assert.ok(sql.includes('ORDER BY created_at DESC'));
  });

  it('multiple orderBy clauses', () => {
    const { sql } = select('*').from('users')
      .orderBy('name', 'ASC')
      .orderBy('age', 'DESC')
      .build();
    assert.ok(sql.includes('ORDER BY name ASC, age DESC'));
  });
});

describe('GROUP BY', () => {
  it('single groupBy column', () => {
    const { sql } = select('status', 'COUNT(*)').from('users').groupBy('status').build();
    assert.ok(sql.includes('GROUP BY status'));
  });

  it('multiple groupBy columns in one call', () => {
    const { sql } = select('*').from('sales').groupBy('year', 'month').build();
    assert.ok(sql.includes('GROUP BY year, month'));
  });

  it('multiple groupBy calls accumulate', () => {
    const { sql } = select('*').from('t').groupBy('a').groupBy('b').build();
    assert.ok(sql.includes('GROUP BY a, b'));
  });
});

describe('HAVING', () => {
  it('having clause added after GROUP BY', () => {
    const { sql } = select('dept', 'COUNT(*)').from('employees')
      .groupBy('dept')
      .having('COUNT(*) > 5')
      .build();
    assert.ok(sql.includes('GROUP BY dept'));
    assert.ok(sql.includes('HAVING COUNT(*) > 5'));
    const groupIdx = sql.indexOf('GROUP BY');
    const havingIdx = sql.indexOf('HAVING');
    assert.ok(groupIdx < havingIdx);
  });

  it('no having clause produces no HAVING keyword', () => {
    const { sql } = select('*').from('t').build();
    assert.ok(!sql.includes('HAVING'));
  });
});

// ─── LIMIT / OFFSET ───────────────────────────────────────────────────────────

describe('LIMIT / OFFSET', () => {
  it('limit alone', () => {
    const { sql } = select('*').from('users').limit(10).build();
    assert.ok(sql.includes('LIMIT 10'));
  });

  it('offset alone', () => {
    const { sql } = select('*').from('users').offset(20).build();
    assert.ok(sql.includes('OFFSET 20'));
  });

  it('limit and offset together', () => {
    const { sql } = select('*').from('users').limit(5).offset(15).build();
    assert.ok(sql.includes('LIMIT 5'));
    assert.ok(sql.includes('OFFSET 15'));
    assert.ok(sql.indexOf('LIMIT') < sql.indexOf('OFFSET'));
  });

  it('limit 0 is included', () => {
    const { sql } = select('*').from('t').limit(0).build();
    assert.ok(sql.includes('LIMIT 0'));
  });

  it('no limit / offset → not present in SQL', () => {
    const { sql } = select('*').from('t').build();
    assert.ok(!sql.includes('LIMIT'));
    assert.ok(!sql.includes('OFFSET'));
  });
});

// ─── INSERT with values() ─────────────────────────────────────────────────────

describe('INSERT with values()', () => {
  it('basic insert', () => {
    const { sql, params } = insert('users').values({ name: 'Alice', age: 30 }).build();
    assert.equal(sql, 'INSERT INTO users (name, age) VALUES (?, ?)');
    assert.deepEqual(params, ['Alice', 30]);
  });

  it('insert single field', () => {
    const { sql, params } = insert('logs').values({ message: 'hello' }).build();
    assert.equal(sql, 'INSERT INTO logs (message) VALUES (?)');
    assert.deepEqual(params, ['hello']);
  });

  it('insert with null value', () => {
    const { sql, params } = insert('t').values({ a: null }).build();
    assert.ok(sql.includes('VALUES (?)'));
    assert.deepEqual(params, [null]);
  });

  it('insert with boolean value', () => {
    const { params } = insert('t').values({ active: true }).build();
    assert.deepEqual(params, [true]);
  });

  it('insert without values() throws', () => {
    assert.throws(() => insert('users').build(), /INSERT requires values/);
  });

  it('using QueryBuilder.insert static method', () => {
    const { sql } = QueryBuilder.insert('products').values({ title: 'Book' }).build();
    assert.ok(sql.startsWith('INSERT INTO products'));
  });
});

// ─── UPDATE with set() and where() ───────────────────────────────────────────

describe('UPDATE with set() and where()', () => {
  it('basic update', () => {
    const { sql, params } = update('users').set({ name: 'Bob' }).where('id = ?').build();
    assert.equal(sql, 'UPDATE users SET name = ? WHERE id = ?');
    assert.deepEqual(params, ['Bob']);
  });

  it('update multiple fields', () => {
    const { sql, params } = update('users').set({ name: 'Bob', age: 25 }).build();
    assert.equal(sql, 'UPDATE users SET name = ?, age = ?');
    assert.deepEqual(params, ['Bob', 25]);
  });

  it('update without set() throws', () => {
    assert.throws(() => update('users').build(), /UPDATE requires set/);
  });

  it('update with multiple where conditions', () => {
    const { sql } = update('t')
      .set({ x: 1 })
      .where('a = ?')
      .andWhere('b = ?')
      .build();
    assert.ok(sql.includes('WHERE a = ? AND b = ?'));
  });

  it('using QueryBuilder.update static method', () => {
    const { sql } = QueryBuilder.update('items').set({ price: 9.99 }).build();
    assert.ok(sql.startsWith('UPDATE items SET'));
  });
});

// ─── DELETE with where() ──────────────────────────────────────────────────────

describe('DELETE with where()', () => {
  it('delete with where clause', () => {
    const { sql, params } = deleteFrom('users').where('id = ?').build();
    assert.equal(sql, 'DELETE FROM users WHERE id = ?');
    assert.deepEqual(params, []);
  });

  it('delete without where', () => {
    const { sql } = deleteFrom('logs').build();
    assert.equal(sql, 'DELETE FROM logs');
  });

  it('delete with andWhere', () => {
    const { sql } = deleteFrom('sessions')
      .where('expired = 1')
      .andWhere('user_id = ?')
      .build();
    assert.equal(sql, 'DELETE FROM sessions WHERE expired = 1 AND user_id = ?');
  });

  it('using QueryBuilder.delete static method + from()', () => {
    const { sql } = QueryBuilder.delete().from('cache').where('ttl < ?').build();
    assert.equal(sql, 'DELETE FROM cache WHERE ttl < ?');
  });
});

// ─── build() – SQL + params ───────────────────────────────────────────────────

describe('build() – SQL and params', () => {
  it('returns an object with sql and params', () => {
    const result = select('*').from('t').build();
    assert.ok('sql' in result);
    assert.ok('params' in result);
  });

  it('params is always an array', () => {
    const { params } = select('*').from('t').build();
    assert.ok(Array.isArray(params));
  });

  it('insert params match values order', () => {
    const { params } = insert('t').values({ a: 1, b: 2, c: 3 }).build();
    assert.deepEqual(params, [1, 2, 3]);
  });

  it('update params match set values order', () => {
    const { params } = update('t').set({ x: 10, y: 20 }).build();
    assert.deepEqual(params, [10, 20]);
  });

  it('select with where has empty params (placeholders provided by caller)', () => {
    const { params } = select('*').from('t').where('id = ?').build();
    assert.deepEqual(params, []);
  });

  it('complex select: joins + where + group + order + limit', () => {
    const { sql, params } = select('u.id', 'COUNT(o.id) AS order_count')
      .from('users u')
      .join('orders o', 'u.id = o.user_id', 'LEFT')
      .where('u.active = 1')
      .groupBy('u.id')
      .having('COUNT(o.id) > 2')
      .orderBy('order_count', 'DESC')
      .limit(10)
      .offset(0)
      .build();
    assert.ok(sql.startsWith('SELECT u.id, COUNT(o.id) AS order_count FROM users u'));
    assert.ok(sql.includes('LEFT JOIN orders o ON u.id = o.user_id'));
    assert.ok(sql.includes('WHERE u.active = 1'));
    assert.ok(sql.includes('GROUP BY u.id'));
    assert.ok(sql.includes('HAVING COUNT(o.id) > 2'));
    assert.ok(sql.includes('ORDER BY order_count DESC'));
    assert.ok(sql.includes('LIMIT 10'));
    assert.ok(sql.includes('OFFSET 0'));
    assert.deepEqual(params, []);
  });
});

// ─── toSQL() ──────────────────────────────────────────────────────────────────

describe('toSQL()', () => {
  it('returns SQL string for SELECT', () => {
    const sql = select('*').from('users').toSQL();
    assert.equal(sql, 'SELECT * FROM users');
  });

  it('returns SQL string with WHERE', () => {
    const sql = select('id').from('users').where('active = 1').toSQL();
    assert.equal(sql, 'SELECT id FROM users WHERE active = 1');
  });

  it('inlines string values for INSERT', () => {
    const sql = insert('users').values({ name: 'Alice', age: 30 }).toSQL();
    assert.equal(sql, "INSERT INTO users (name, age) VALUES ('Alice', 30)");
  });

  it('inlines values for UPDATE', () => {
    const sql = update('users').set({ name: 'Bob', score: 99 }).where('id = 1').toSQL();
    assert.equal(sql, "UPDATE users SET name = 'Bob', score = 99 WHERE id = 1");
  });

  it('inlines null as string for UPDATE', () => {
    const sql = update('t').set({ x: null }).toSQL();
    assert.ok(sql.includes('null'));
  });

  it('returns DELETE SQL', () => {
    const sql = deleteFrom('sessions').where('id = 42').toSQL();
    assert.equal(sql, 'DELETE FROM sessions WHERE id = 42');
  });

  it('toSQL for INSERT without values throws', () => {
    assert.throws(() => insert('t').toSQL(), /INSERT requires values/);
  });

  it('toSQL for UPDATE without set throws', () => {
    assert.throws(() => update('t').toSQL(), /UPDATE requires set/);
  });
});

// ─── QueryBuilder static methods ──────────────────────────────────────────────

describe('QueryBuilder static methods', () => {
  it('QueryBuilder.select returns QueryBuilder instance', () => {
    const qb = QueryBuilder.select('id');
    assert.ok(qb instanceof QueryBuilder);
  });

  it('QueryBuilder.select with multiple columns', () => {
    const { sql } = QueryBuilder.select('a', 'b', 'c').from('t').build();
    assert.ok(sql.includes('SELECT a, b, c'));
  });

  it('QueryBuilder.select with no args defaults to *', () => {
    const { sql } = QueryBuilder.select().from('t').build();
    assert.ok(sql.includes('SELECT *'));
  });

  it('QueryBuilder.insert returns QueryBuilder instance', () => {
    const qb = QueryBuilder.insert('t');
    assert.ok(qb instanceof QueryBuilder);
  });

  it('QueryBuilder.update returns QueryBuilder instance', () => {
    const qb = QueryBuilder.update('t');
    assert.ok(qb instanceof QueryBuilder);
  });

  it('QueryBuilder.delete returns QueryBuilder instance', () => {
    const qb = QueryBuilder.delete();
    assert.ok(qb instanceof QueryBuilder);
  });

  it('QueryBuilder.delete().from() sets table', () => {
    const { sql } = QueryBuilder.delete().from('old_records').build();
    assert.ok(sql.includes('FROM old_records'));
  });
});

// ─── Factory functions ────────────────────────────────────────────────────────

describe('Factory functions – select, insert, update, deleteFrom', () => {
  it('select() is an alias for QueryBuilder.select()', () => {
    const { sql } = select('id', 'name').from('users').build();
    assert.equal(sql, 'SELECT id, name FROM users');
  });

  it('select() returns QueryBuilder', () => {
    assert.ok(select('*') instanceof QueryBuilder);
  });

  it('insert() is an alias for QueryBuilder.insert()', () => {
    const { sql } = insert('products').values({ title: 'Widget' }).build();
    assert.ok(sql.startsWith('INSERT INTO products'));
  });

  it('insert() returns QueryBuilder', () => {
    assert.ok(insert('t') instanceof QueryBuilder);
  });

  it('update() is an alias for QueryBuilder.update()', () => {
    const { sql } = update('accounts').set({ balance: 0 }).build();
    assert.ok(sql.startsWith('UPDATE accounts'));
  });

  it('update() returns QueryBuilder', () => {
    assert.ok(update('t') instanceof QueryBuilder);
  });

  it('deleteFrom() sets table and returns QueryBuilder', () => {
    const { sql } = deleteFrom('tmp').build();
    assert.equal(sql, 'DELETE FROM tmp');
  });

  it('deleteFrom() returns QueryBuilder', () => {
    assert.ok(deleteFrom('t') instanceof QueryBuilder);
  });

  it('deleteFrom() with where clause', () => {
    const { sql } = deleteFrom('cache').where('key = ?').build();
    assert.equal(sql, 'DELETE FROM cache WHERE key = ?');
  });
});
