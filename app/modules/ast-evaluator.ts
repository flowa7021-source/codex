// @ts-check
// ─── AST Evaluator ────────────────────────────────────────────────────────────
// Walks an ASTNode tree produced by expr-parser and computes a numeric result.

import type { ASTNode } from './expr-parser.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvalEnv = Record<string, number | ((...args: number[]) => number)>;

// ─── Built-in functions and constants ────────────────────────────────────────

/** Default built-in math functions and constants available in every evaluation. */
export const builtins: EvalEnv = {
  // Trig
  sin:   Math.sin,
  cos:   Math.cos,
  tan:   Math.tan,
  // Roots / exponents
  sqrt:  Math.sqrt,
  exp:   Math.exp,
  log:   Math.log,
  pow:   Math.pow,
  // Rounding / absolute value
  abs:   Math.abs,
  floor: Math.floor,
  ceil:  Math.ceil,
  round: Math.round,
  // Min / max
  max:   Math.max,
  min:   Math.min,
  // Constants
  PI:    Math.PI,
  E:     Math.E,
};

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Evaluate an ASTNode with optional variable/function bindings.
 * The `env` is merged on top of the built-in functions; env entries take
 * precedence so callers can override built-ins.
 */
export function evalAST(node: ASTNode, env: EvalEnv = {}): number {
  // Merge env on top of builtins (env wins on conflicts)
  const scope: EvalEnv = { ...builtins, ...env };
  return evalNode(node, scope);
}

function evalNode(node: ASTNode, scope: EvalEnv): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'variable': {
      const val = scope[node.name];
      if (val === undefined) {
        throw new ReferenceError(`Undefined variable: '${node.name}'`);
      }
      if (typeof val !== 'number') {
        throw new TypeError(`'${node.name}' is a function, not a number`);
      }
      return val;
    }

    case 'unary':
      return -evalNode(node.operand, scope);

    case 'binary': {
      const l = evalNode(node.left, scope);
      const r = evalNode(node.right, scope);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '^': return Math.pow(l, r);
      }
    }

    // TypeScript exhaustiveness guard — unreachable at runtime
    // eslint-disable-next-line no-fallthrough
    case 'call': {
      const fn = scope[node.name];
      if (fn === undefined) {
        throw new ReferenceError(`Undefined function: '${node.name}'`);
      }
      if (typeof fn !== 'function') {
        throw new TypeError(`'${node.name}' is not a function`);
      }
      const argVals = node.args.map(a => evalNode(a, scope));
      return fn(...argVals);
    }
  }
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

import { parseExpr } from './expr-parser.js';

/**
 * Parse and evaluate an expression string in one step.
 *
 * @example
 * evaluate('2 + 3 * 4')          // 14
 * evaluate('sin(PI / 2)')        // 1
 * evaluate('x^2 + 1', { x: 3 }) // 10
 */
export function evaluate(expr: string, env: EvalEnv = {}): number {
  return evalAST(parseExpr(expr), env);
}
