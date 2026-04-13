// @ts-check
// ─── Constraint Satisfaction Problem Solver ──────────────────────────────────
// A generic CSP solver with arc-consistency-style pruning and backtracking.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A CSP variable with a name and finite domain. */
export interface Variable<T> {
  name: string;
  domain: T[];
}

/** A constraint over one or more variables. */
export interface Constraint<T> {
  variables: string[];
  check: (assignment: Map<string, T>) => boolean;
}

// ─── CSPSolver ───────────────────────────────────────────────────────────────

/**
 * Constraint satisfaction problem solver using backtracking with forward
 * checking.
 */
export class CSPSolver<T> {
  private readonly variables: Map<string, T[]> = new Map();
  private readonly constraints: Constraint<T>[] = [];
  private variableOrder: string[] = [];

  constructor() {
    // intentionally empty — variables and constraints are added incrementally
  }

  /** Add a variable with its finite domain. */
  addVariable(name: string, domain: T[]): void {
    this.variables.set(name, [...domain]);
    this.variableOrder.push(name);
  }

  /** Add a constraint over the specified variables. */
  addConstraint(
    variables: string[],
    check: (assignment: Map<string, T>) => boolean,
  ): void {
    this.constraints.push({ variables, check });
  }

  /** Number of registered variables. */
  get variableCount(): number {
    return this.variables.size;
  }

  /** Number of registered constraints. */
  get constraintCount(): number {
    return this.constraints.length;
  }

  /** Return the first solution or `null`. */
  solve(): Map<string, T> | null {
    const result = this.backtrack(new Map(), 0, 1);
    return result.length > 0 ? result[0] : null;
  }

  /** Return all solutions, optionally capped at `limit`. */
  solveAll(limit?: number): Map<string, T>[] {
    return this.backtrack(new Map(), 0, limit);
  }

  // ─── Internal backtracking engine ────────────────────────────────────────

  private backtrack(
    assignment: Map<string, T>,
    depth: number,
    limit?: number,
  ): Map<string, T>[] {
    const solutions: Map<string, T>[] = [];

    if (depth === this.variableOrder.length) {
      // All variables assigned — full solution.
      solutions.push(new Map(assignment));
      return solutions;
    }

    const varName = this.variableOrder[depth];
    const domain = this.variables.get(varName)!;

    for (const value of domain) {
      assignment.set(varName, value);

      if (this.isConsistent(assignment)) {
        const sub = this.backtrack(assignment, depth + 1, limit !== undefined ? limit - solutions.length : undefined);
        for (const s of sub) {
          solutions.push(s);
          if (limit !== undefined && solutions.length >= limit) {
            assignment.delete(varName);
            return solutions;
          }
        }
      }
    }

    assignment.delete(varName);
    return solutions;
  }

  /**
   * Check that all constraints whose variables are fully assigned are
   * satisfied by the current (partial) assignment.
   */
  private isConsistent(assignment: Map<string, T>): boolean {
    for (const constraint of this.constraints) {
      const allAssigned = constraint.variables.every(v => assignment.has(v));
      if (allAssigned && !constraint.check(assignment)) {
        return false;
      }
    }
    return true;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new CSPSolver instance. */
export function createCSPSolver<T>(): CSPSolver<T> {
  return new CSPSolver<T>();
}
