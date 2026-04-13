// @ts-check
// ─── SQL Query Builder ────────────────────────────────────────────────────────
// Generates SQL strings (no DB connection). Supports SELECT, INSERT, UPDATE,
// DELETE with parameterized output via build() or inlined output via toSQL().

// ─── Types ────────────────────────────────────────────────────────────────────

type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
type OrderDirection = 'ASC' | 'DESC';

interface JoinClause {
  type: JoinType;
  table: string;
  condition: string;
}

interface OrderClause {
  column: string;
  direction: OrderDirection;
}

/** The result of build(): final SQL string and collected parameters. */
export interface BuildResult {
  sql: string;
  params: unknown[];
}

// ─── QueryBuilder ─────────────────────────────────────────────────────────────

export class QueryBuilder {
  #type: QueryType = 'SELECT';
  #table: string = '';
  #columns: string[] = [];
  #joins: JoinClause[] = [];
  #wheres: { condition: string; connector: 'AND' | 'OR' }[] = [];
  #orderBys: OrderClause[] = [];
  #groupBys: string[] = [];
  #having: string = '';
  #limit: number | null = null;
  #offset: number | null = null;
  #insertData: Record<string, unknown> | null = null;
  #updateData: Record<string, unknown> | null = null;

  // ─── Static factory methods ────────────────────────────────────────────────

  /** Start a SELECT query for the given columns (or '*' for all). */
  static select(...columns: string[]): QueryBuilder {
    const qb = new QueryBuilder();
    qb.#type = 'SELECT';
    qb.#columns = columns.length > 0 ? columns : ['*'];
    return qb;
  }

  /** Start an INSERT query for the given table. */
  static insert(table: string): QueryBuilder {
    const qb = new QueryBuilder();
    qb.#type = 'INSERT';
    qb.#table = table;
    return qb;
  }

  /** Start an UPDATE query for the given table. */
  static update(table: string): QueryBuilder {
    const qb = new QueryBuilder();
    qb.#type = 'UPDATE';
    qb.#table = table;
    return qb;
  }

  /** Start a DELETE query. */
  static delete(): QueryBuilder {
    const qb = new QueryBuilder();
    qb.#type = 'DELETE';
    return qb;
  }

  // ─── Clause methods ────────────────────────────────────────────────────────

  /** Set the target table (used with SELECT / DELETE). */
  from(table: string): QueryBuilder {
    this.#table = table;
    return this;
  }

  /**
   * Add a JOIN clause.
   * @param table - The table to join.
   * @param condition - The ON condition (e.g. 'users.id = orders.user_id').
   * @param type - Join type (default 'INNER').
   */
  join(table: string, condition: string, type: JoinType = 'INNER'): QueryBuilder {
    this.#joins.push({ type, table, condition });
    return this;
  }

  /** Add the first WHERE condition (replaces any previously set first condition). */
  where(condition: string): QueryBuilder {
    // Replace an existing initial where, or push a new one
    if (this.#wheres.length === 0) {
      this.#wheres.push({ condition, connector: 'AND' });
    } else {
      this.#wheres[0] = { condition, connector: 'AND' };
    }
    return this;
  }

  /** Append an AND condition to the WHERE clause. */
  andWhere(condition: string): QueryBuilder {
    this.#wheres.push({ condition, connector: 'AND' });
    return this;
  }

  /** Append an OR condition to the WHERE clause. */
  orWhere(condition: string): QueryBuilder {
    this.#wheres.push({ condition, connector: 'OR' });
    return this;
  }

  /** Add an ORDER BY clause. */
  orderBy(column: string, direction: OrderDirection = 'ASC'): QueryBuilder {
    this.#orderBys.push({ column, direction });
    return this;
  }

  /** Add GROUP BY columns. */
  groupBy(...columns: string[]): QueryBuilder {
    this.#groupBys.push(...columns);
    return this;
  }

  /** Set the HAVING condition. */
  having(condition: string): QueryBuilder {
    this.#having = condition;
    return this;
  }

  /** Set LIMIT. */
  limit(n: number): QueryBuilder {
    this.#limit = n;
    return this;
  }

  /** Set OFFSET. */
  offset(n: number): QueryBuilder {
    this.#offset = n;
    return this;
  }

  /**
   * Provide data for an INSERT query.
   * Values will be parameterized in build().
   */
  values(data: Record<string, unknown>): QueryBuilder {
    this.#insertData = { ...data };
    return this;
  }

  /**
   * Provide data for an UPDATE query.
   * Values will be parameterized in build().
   */
  set(data: Record<string, unknown>): QueryBuilder {
    this.#updateData = { ...data };
    return this;
  }

  // ─── Build helpers ─────────────────────────────────────────────────────────

  /** Build the WHERE portion of the SQL string. */
  #buildWhere(): string {
    if (this.#wheres.length === 0) return '';
    let clause = ' WHERE ' + this.#wheres[0].condition;
    for (let i = 1; i < this.#wheres.length; i++) {
      clause += ` ${this.#wheres[i].connector} ${this.#wheres[i].condition}`;
    }
    return clause;
  }

  /** Build JOIN clauses. */
  #buildJoins(): string {
    return this.#joins
      .map(j => ` ${j.type} JOIN ${j.table} ON ${j.condition}`)
      .join('');
  }

  /** Build ORDER BY clause. */
  #buildOrderBy(): string {
    if (this.#orderBys.length === 0) return '';
    return ' ORDER BY ' + this.#orderBys.map(o => `${o.column} ${o.direction}`).join(', ');
  }

  /** Build GROUP BY clause. */
  #buildGroupBy(): string {
    if (this.#groupBys.length === 0) return '';
    return ' GROUP BY ' + this.#groupBys.join(', ');
  }

  /** Build HAVING clause. */
  #buildHaving(): string {
    return this.#having ? ` HAVING ${this.#having}` : '';
  }

  /** Build LIMIT clause. */
  #buildLimit(): string {
    return this.#limit !== null ? ` LIMIT ${this.#limit}` : '';
  }

  /** Build OFFSET clause. */
  #buildOffset(): string {
    return this.#offset !== null ? ` OFFSET ${this.#offset}` : '';
  }

  // ─── Public build methods ──────────────────────────────────────────────────

  /**
   * Build the final parameterized SQL.
   * For INSERT/UPDATE, values are extracted into params[].
   * WHERE placeholders (?) must be supplied by the caller.
   */
  build(): BuildResult {
    const params: unknown[] = [];
    let sql = '';

    switch (this.#type) {
      case 'SELECT': {
        const cols = this.#columns.join(', ');
        sql = `SELECT ${cols} FROM ${this.#table}`;
        sql += this.#buildJoins();
        sql += this.#buildWhere();
        sql += this.#buildGroupBy();
        sql += this.#buildHaving();
        sql += this.#buildOrderBy();
        sql += this.#buildLimit();
        sql += this.#buildOffset();
        break;
      }

      case 'INSERT': {
        if (!this.#insertData || Object.keys(this.#insertData).length === 0) {
          throw new Error('INSERT requires values() to be called with at least one field');
        }
        const keys = Object.keys(this.#insertData);
        const vals = Object.values(this.#insertData);
        params.push(...vals);
        const placeholders = keys.map(() => '?').join(', ');
        sql = `INSERT INTO ${this.#table} (${keys.join(', ')}) VALUES (${placeholders})`;
        break;
      }

      case 'UPDATE': {
        if (!this.#updateData || Object.keys(this.#updateData).length === 0) {
          throw new Error('UPDATE requires set() to be called with at least one field');
        }
        const keys = Object.keys(this.#updateData);
        const vals = Object.values(this.#updateData);
        params.push(...vals);
        const setPairs = keys.map(k => `${k} = ?`).join(', ');
        sql = `UPDATE ${this.#table} SET ${setPairs}`;
        sql += this.#buildWhere();
        break;
      }

      case 'DELETE': {
        sql = `DELETE FROM ${this.#table}`;
        sql += this.#buildWhere();
        break;
      }
    }

    return { sql, params };
  }

  /**
   * Build SQL with values inlined (no parameterization).
   * Strings are single-quoted; all other values are coerced to string.
   * For debugging only — do NOT use with untrusted data.
   */
  toSQL(): string {
    // Render INSERT/UPDATE data inline
    const inlineValue = (v: unknown): string =>
      typeof v === 'string' ? `'${v}'` : String(v);

    switch (this.#type) {
      case 'SELECT': {
        const cols = this.#columns.join(', ');
        let sql = `SELECT ${cols} FROM ${this.#table}`;
        sql += this.#buildJoins();
        sql += this.#buildWhere();
        sql += this.#buildGroupBy();
        sql += this.#buildHaving();
        sql += this.#buildOrderBy();
        sql += this.#buildLimit();
        sql += this.#buildOffset();
        return sql;
      }

      case 'INSERT': {
        if (!this.#insertData || Object.keys(this.#insertData).length === 0) {
          throw new Error('INSERT requires values() to be called with at least one field');
        }
        const keys = Object.keys(this.#insertData);
        const vals = Object.values(this.#insertData).map(inlineValue);
        return `INSERT INTO ${this.#table} (${keys.join(', ')}) VALUES (${vals.join(', ')})`;
      }

      case 'UPDATE': {
        if (!this.#updateData || Object.keys(this.#updateData).length === 0) {
          throw new Error('UPDATE requires set() to be called with at least one field');
        }
        const keys = Object.keys(this.#updateData);
        const vals = Object.values(this.#updateData);
        const setPairs = keys.map((k, i) => `${k} = ${inlineValue(vals[i])}`).join(', ');
        let sql = `UPDATE ${this.#table} SET ${setPairs}`;
        sql += this.#buildWhere();
        return sql;
      }

      case 'DELETE': {
        let sql = `DELETE FROM ${this.#table}`;
        sql += this.#buildWhere();
        return sql;
      }
    }
  }
}

// ─── Convenience factory functions ────────────────────────────────────────────

/** Start a SELECT query. Alias for QueryBuilder.select(). */
export function select(...columns: string[]): QueryBuilder {
  return QueryBuilder.select(...columns);
}

/** Start an INSERT query. Alias for QueryBuilder.insert(). */
export function insert(table: string): QueryBuilder {
  return QueryBuilder.insert(table);
}

/** Start an UPDATE query. Alias for QueryBuilder.update(). */
export function update(table: string): QueryBuilder {
  return QueryBuilder.update(table);
}

/** Start a DELETE query targeting the given table. */
export function deleteFrom(table: string): QueryBuilder {
  return QueryBuilder.delete().from(table);
}
