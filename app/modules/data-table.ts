// @ts-check
// ─── Data Table ──────────────────────────────────────────────────────────────
// In-memory data table with filtering, sorting, and aggregation.

// ─── Types ───────────────────────────────────────────────────────────────────

export type SortOrder = 'asc' | 'desc';

export interface SortSpec {
  column: string;
  order?: SortOrder;
}

export interface FilterSpec {
  column: string;
  operator: 'eq' | 'ne' | 'lt' | 'gt' | 'lte' | 'gte' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

// ─── DataTable ───────────────────────────────────────────────────────────────

export class DataTable {
  #rows: Record<string, unknown>[];
  #columns: string[];

  constructor(rows?: Record<string, unknown>[]) {
    this.#rows = [];
    this.#columns = [];

    if (rows) {
      for (const row of rows) {
        this.addRow(row);
      }
    }
  }

  /** Number of rows. */
  get rowCount(): number {
    return this.#rows.length;
  }

  /** Column names. */
  get columns(): string[] {
    return [...this.#columns];
  }

  /** Add a row. */
  addRow(row: Record<string, unknown>): void {
    this.#rows.push({ ...row });
    for (const key of Object.keys(row)) {
      if (!this.#columns.includes(key)) {
        this.#columns.push(key);
      }
    }
  }

  /** Get a row by index. */
  getRow(index: number): Record<string, unknown> | undefined {
    if (index < 0 || index >= this.#rows.length) return undefined;
    return { ...this.#rows[index] };
  }

  /** Filter rows by criteria. Returns new DataTable. */
  filter(spec: FilterSpec | FilterSpec[]): DataTable {
    const specs = Array.isArray(spec) ? spec : [spec];
    const filtered = this.#rows.filter((row) => specs.every((s) => applyFilter(row, s)));
    return new DataTable(filtered);
  }

  /** Sort rows by column(s). Returns new DataTable. */
  sort(spec: SortSpec | SortSpec[]): DataTable {
    const specs = Array.isArray(spec) ? spec : [spec];
    const sorted = [...this.#rows].sort((a, b) => compareRows(a, b, specs));
    return new DataTable(sorted);
  }

  /** Select specific columns. Returns new DataTable. */
  select(columns: string[]): DataTable {
    const projected = this.#rows.map((row) => {
      const result: Record<string, unknown> = {};
      for (const col of columns) {
        result[col] = row[col];
      }
      return result;
    });
    return new DataTable(projected);
  }

  /** Get unique values for a column. */
  distinct(column: string): unknown[] {
    const seen = new Set<unknown>();
    const result: unknown[] = [];
    for (const row of this.#rows) {
      const val = row[column];
      if (!seen.has(val)) {
        seen.add(val);
        result.push(val);
      }
    }
    return result;
  }

  /** Aggregate: count rows. */
  count(): number {
    return this.#rows.length;
  }

  /** Aggregate: sum of numeric column. */
  sum(column: string): number {
    let total = 0;
    for (const row of this.#rows) {
      const val = row[column];
      if (typeof val === 'number') total += val;
    }
    return total;
  }

  /** Aggregate: average of numeric column. */
  avg(column: string): number {
    if (this.#rows.length === 0) return 0;
    return this.sum(column) / this.#rows.length;
  }

  /** Aggregate: min of numeric column. */
  min(column: string): number {
    let result = Infinity;
    for (const row of this.#rows) {
      const val = row[column];
      if (typeof val === 'number' && val < result) result = val;
    }
    return result === Infinity ? 0 : result;
  }

  /** Aggregate: max of numeric column. */
  max(column: string): number {
    let result = -Infinity;
    for (const row of this.#rows) {
      const val = row[column];
      if (typeof val === 'number' && val > result) result = val;
    }
    return result === -Infinity ? 0 : result;
  }

  /** Export to array of records. */
  toArray(): Record<string, unknown>[] {
    return this.#rows.map((row) => ({ ...row }));
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function applyFilter(row: Record<string, unknown>, spec: FilterSpec): boolean {
  const val = row[spec.column];
  const target = spec.value;

  switch (spec.operator) {
    case 'eq':
      return val === target;
    case 'ne':
      return val !== target;
    case 'lt':
      return typeof val === 'number' && typeof target === 'number' && val < target;
    case 'gt':
      return typeof val === 'number' && typeof target === 'number' && val > target;
    case 'lte':
      return typeof val === 'number' && typeof target === 'number' && val <= target;
    case 'gte':
      return typeof val === 'number' && typeof target === 'number' && val >= target;
    case 'contains':
      return typeof val === 'string' && typeof target === 'string' && val.includes(target);
    case 'startsWith':
      return typeof val === 'string' && typeof target === 'string' && val.startsWith(target);
    case 'endsWith':
      return typeof val === 'string' && typeof target === 'string' && val.endsWith(target);
    default:
      return false;
  }
}

function compareRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  specs: SortSpec[],
): number {
  for (const spec of specs) {
    const order = spec.order ?? 'asc';
    const av = a[spec.column];
    const bv = b[spec.column];
    let cmp = 0;

    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else if (typeof av === 'string' && typeof bv === 'string') {
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    } else if (av == null && bv != null) {
      cmp = 1;
    } else if (av != null && bv == null) {
      cmp = -1;
    }

    if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
  }
  return 0;
}
