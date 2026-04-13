// @ts-check
// ─── AST Builder ──────────────────────────────────────────────────────────────
// Provides node types and builder functions for a simple expression language,
// plus depth-first walk and transform utilities.

// ─── Node type discriminants (as const, not const enum) ──────────────────────

export const NodeType = {
  NumberLiteral: 'NumberLiteral',
  StringLiteral: 'StringLiteral',
  BoolLiteral:   'BoolLiteral',
  Identifier:    'Identifier',
  BinaryExpr:    'BinaryExpr',
  UnaryExpr:     'UnaryExpr',
  CallExpr:      'CallExpr',
  IfExpr:        'IfExpr',
  BlockExpr:     'BlockExpr',
  Assignment:    'Assignment',
} as const;

// ─── Node interfaces ──────────────────────────────────────────────────────────

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface BoolLiteral {
  type: 'BoolLiteral';
  value: boolean;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpr {
  type: 'BinaryExpr';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExpr {
  type: 'UnaryExpr';
  op: string;
  operand: ASTNode;
}

export interface CallExpr {
  type: 'CallExpr';
  callee: string;
  args: ASTNode[];
}

export interface IfExpr {
  type: 'IfExpr';
  condition: ASTNode;
  then: ASTNode;
  else: ASTNode;
}

export interface BlockExpr {
  type: 'BlockExpr';
  body: ASTNode[];
}

export interface Assignment {
  type: 'Assignment';
  name: string;
  value: ASTNode;
}

/** Union of all AST node types. */
export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BoolLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | IfExpr
  | BlockExpr
  | Assignment;

// ─── Builder functions ────────────────────────────────────────────────────────

/** Create a numeric literal node. */
export function num(value: number): NumberLiteral {
  return { type: 'NumberLiteral', value };
}

/** Create a string literal node. */
export function str(value: string): StringLiteral {
  return { type: 'StringLiteral', value };
}

/** Create a boolean literal node. */
export function bool(value: boolean): BoolLiteral {
  return { type: 'BoolLiteral', value };
}

/** Create an identifier (variable reference) node. */
export function ident(name: string): Identifier {
  return { type: 'Identifier', name };
}

/** Create a binary expression node. */
export function binary(op: string, left: ASTNode, right: ASTNode): BinaryExpr {
  return { type: 'BinaryExpr', op, left, right };
}

/** Create a unary expression node. */
export function unary(op: string, operand: ASTNode): UnaryExpr {
  return { type: 'UnaryExpr', op, operand };
}

/** Create a function-call expression node. */
export function call(callee: string, args: ASTNode[]): CallExpr {
  return { type: 'CallExpr', callee, args };
}

/** Create an if-expression node. */
export function ifExpr(condition: ASTNode, then: ASTNode, else_: ASTNode): IfExpr {
  return { type: 'IfExpr', condition, then, else: else_ };
}

/** Create a block expression (sequence of statements) node. */
export function block(body: ASTNode[]): BlockExpr {
  return { type: 'BlockExpr', body };
}

/** Create an assignment node. */
export function assign(name: string, value: ASTNode): Assignment {
  return { type: 'Assignment', name, value };
}

// ─── Tree utilities ───────────────────────────────────────────────────────────

/**
 * Walk an AST depth-first (children before the visitor sees a node? No —
 * visitor is called on each node *before* descending into its children, then
 * again we recurse). Actually: visitor is called in pre-order (node first,
 * then children), mirroring a typical depth-first traversal.
 */
export function walkAST(node: ASTNode, visitor: (node: ASTNode) => void): void {
  visitor(node);
  switch (node.type) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BoolLiteral':
    case 'Identifier':
      break;

    case 'BinaryExpr':
      walkAST(node.left, visitor);
      walkAST(node.right, visitor);
      break;

    case 'UnaryExpr':
      walkAST(node.operand, visitor);
      break;

    case 'CallExpr':
      for (const arg of node.args) {
        walkAST(arg, visitor);
      }
      break;

    case 'IfExpr':
      walkAST(node.condition, visitor);
      walkAST(node.then, visitor);
      walkAST(node.else, visitor);
      break;

    case 'BlockExpr':
      for (const stmt of node.body) {
        walkAST(stmt, visitor);
      }
      break;

    case 'Assignment':
      walkAST(node.value, visitor);
      break;
  }
}

/**
 * Transform an AST by applying `fn` to every node bottom-up (children first,
 * then the parent). Returns a new tree; the original is not mutated.
 */
export function transformAST(node: ASTNode, fn: (node: ASTNode) => ASTNode): ASTNode {
  let transformed: ASTNode;

  switch (node.type) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BoolLiteral':
    case 'Identifier':
      transformed = node;
      break;

    case 'BinaryExpr':
      transformed = {
        ...node,
        left:  transformAST(node.left, fn),
        right: transformAST(node.right, fn),
      };
      break;

    case 'UnaryExpr':
      transformed = {
        ...node,
        operand: transformAST(node.operand, fn),
      };
      break;

    case 'CallExpr':
      transformed = {
        ...node,
        args: node.args.map(a => transformAST(a, fn)),
      };
      break;

    case 'IfExpr':
      transformed = {
        ...node,
        condition: transformAST(node.condition, fn),
        then:      transformAST(node.then, fn),
        else:      transformAST(node.else, fn),
      };
      break;

    case 'BlockExpr':
      transformed = {
        ...node,
        body: node.body.map(s => transformAST(s, fn)),
      };
      break;

    case 'Assignment':
      transformed = {
        ...node,
        value: transformAST(node.value, fn),
      };
      break;
  }

  return fn(transformed);
}
