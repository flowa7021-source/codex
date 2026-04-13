// @ts-check
// ─── Bayesian Network ────────────────────────────────────────────────────────
// A simple Bayesian Network implementation with variable elimination for
// inference and prior sampling for Monte Carlo estimation.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BayesNode {
  name: string;
  parents: string[];
  /** CPT: probability table. Keys are parent value combinations.
   *  e.g. 'T|T,F' = 0.8 means P(node=T|parent1=T,parent2=F) = 0.8
   *  For root nodes (no parents), use 'T' => P(node=T).
   */
  cpt: Record<string, number>;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Convert a boolean value to its canonical string token. */
function boolKey(v: boolean): string {
  return v ? 'T' : 'F';
}

/**
 * Build the CPT lookup key for a node given a specific assignment.
 * Format:  "<nodeVal>|<p1Val>,<p2Val>,..."  for nodes with parents,
 * or       "<nodeVal>"                       for root nodes.
 */
function cptKey(nodeVal: boolean, parentVals: boolean[]): string {
  if (parentVals.length === 0) return boolKey(nodeVal);
  return `${boolKey(nodeVal)}|${parentVals.map(boolKey).join(',')}`;
}

/**
 * Look up P(node=nodeVal | parents=parentVals) from the CPT.
 * Falls back to the complement (1 - P(T|...)) when only the true-row is stored.
 */
function lookupCpt(cpt: Record<string, number>, nodeVal: boolean, parentVals: boolean[]): number {
  const key = cptKey(nodeVal, parentVals);
  if (key in cpt) return cpt[key];

  // Try to derive from the complementary true-row.
  const trueKey = cptKey(true, parentVals);
  if (trueKey in cpt) {
    const pTrue = cpt[trueKey];
    return nodeVal ? pTrue : 1 - pTrue;
  }

  // Default: uniform
  return 0.5;
}

// ─── BayesianNetwork ─────────────────────────────────────────────────────────

export class BayesianNetwork {
  readonly #nodes: Map<string, BayesNode>;

  constructor(nodes: BayesNode[] = []) {
    this.#nodes = new Map<string, BayesNode>();
    for (const node of nodes) {
      this.#nodes.set(node.name, node);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Add (or replace) a node in the network. */
  addNode(node: BayesNode): void {
    this.#nodes.set(node.name, node);
  }

  /**
   * Query P(variable=value | evidence) using exact inference via
   * variable elimination over a topologically-sorted network.
   */
  query(variable: string, value: boolean, evidence: Record<string, boolean> = {}): number {
    const order = this.topologicalOrder();

    // Enumerate all hidden variables (not queried, not evidence).
    const hidden = order.filter(n => n !== variable && !(n in evidence));

    // Compute the joint probability of a complete assignment.
    const jointProb = (assignment: Record<string, boolean>): number => {
      let p = 1;
      for (const name of order) {
        const node = this.#nodes.get(name)!;
        const nodeVal = assignment[name];
        const parentVals = node.parents.map(pn => assignment[pn]);
        p *= lookupCpt(node.cpt, nodeVal, parentVals);
      }
      return p;
    };

    // Sum over all assignments consistent with evidence.
    const sumOver = (
      vars: string[],
      assignment: Record<string, boolean>,
      targetVal: boolean,
    ): number => {
      if (vars.length === 0) {
        const full = { ...assignment, [variable]: targetVal };
        return jointProb(full);
      }
      const [first, ...rest] = vars;
      return (
        sumOver(rest, { ...assignment, [first]: true }, targetVal) +
        sumOver(rest, { ...assignment, [first]: false }, targetVal)
      );
    };

    const base = { ...evidence };
    const pTrue = sumOver(hidden, base, true);
    const pFalse = sumOver(hidden, base, false);
    const total = pTrue + pFalse;

    if (total === 0) return 0.5;
    return value ? pTrue / total : pFalse / total;
  }

  /**
   * Draw one sample from the joint prior distribution using ancestral (prior)
   * sampling.  Returns a complete assignment to all variables.
   */
  sample(): Record<string, boolean> {
    const order = this.topologicalOrder();
    const assignment: Record<string, boolean> = {};

    for (const name of order) {
      const node = this.#nodes.get(name)!;
      const parentVals = node.parents.map(pn => assignment[pn]);
      const pTrue = lookupCpt(node.cpt, true, parentVals);
      assignment[name] = Math.random() < pTrue;
    }

    return assignment;
  }

  /**
   * Return all node names in topological order (parents before children).
   * Uses a standard DFS-based algorithm.
   */
  topologicalOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const node = this.#nodes.get(name);
      if (node) {
        for (const parent of node.parents) {
          visit(parent);
        }
      }
      result.push(name);
    };

    for (const name of this.#nodes.keys()) {
      visit(name);
    }

    return result;
  }
}
