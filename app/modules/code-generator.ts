// @ts-check
// ─── Code Generator ───────────────────────────────────────────────────────────
// Generates JavaScript source code from AST nodes produced by ast-builder.

import type { ASTNode } from './ast-builder.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIndent(level: number, size: number): string {
  return ' '.repeat(level * size);
}

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ─── generateJS ───────────────────────────────────────────────────────────────

/**
 * Generate readable JavaScript from an AST node.
 *
 * @param node   - The AST node to generate code for.
 * @param indent - Current indentation level (default 0); each level = 2 spaces.
 */
export function generateJS(node: ASTNode, indent: number = 0): string {
  const pad = makeIndent(indent, 2);
  const pad1 = makeIndent(indent + 1, 2);

  switch (node.type) {
    case 'NumberLiteral':
      return String(node.value);

    case 'StringLiteral':
      return `"${escapeString(node.value)}"`;

    case 'BoolLiteral':
      return String(node.value);

    case 'Identifier':
      return node.name;

    case 'BinaryExpr': {
      const l = generateJS(node.left, indent);
      const r = generateJS(node.right, indent);
      return `(${l} ${node.op} ${r})`;
    }

    case 'UnaryExpr': {
      const operand = generateJS(node.operand, indent);
      return `${node.op}${operand}`;
    }

    case 'CallExpr': {
      const args = node.args.map(a => generateJS(a, indent)).join(', ');
      return `${node.callee}(${args})`;
    }

    case 'IfExpr': {
      const cond = generateJS(node.condition, indent);
      const thenBranch = generateJS(node.then, indent);
      const elseBranch = generateJS(node.else, indent);
      return `(${cond} ? ${thenBranch} : ${elseBranch})`;
    }

    case 'BlockExpr': {
      if (node.body.length === 0) return `{\n${pad}}`;
      const lines = node.body
        .map(s => `${pad1}${generateJS(s, indent + 1)};`)
        .join('\n');
      return `{\n${lines}\n${pad}}`;
    }

    case 'Assignment': {
      const val = generateJS(node.value, indent);
      return `${node.name} = ${val}`;
    }
  }
}

// ─── generateMinified ─────────────────────────────────────────────────────────

/**
 * Generate minified JavaScript from an AST node — no extra whitespace.
 */
export function generateMinified(node: ASTNode): string {
  switch (node.type) {
    case 'NumberLiteral':
      return String(node.value);

    case 'StringLiteral':
      return `"${escapeString(node.value)}"`;

    case 'BoolLiteral':
      return String(node.value);

    case 'Identifier':
      return node.name;

    case 'BinaryExpr': {
      const l = generateMinified(node.left);
      const r = generateMinified(node.right);
      return `(${l}${node.op}${r})`;
    }

    case 'UnaryExpr': {
      const operand = generateMinified(node.operand);
      return `${node.op}${operand}`;
    }

    case 'CallExpr': {
      const args = node.args.map(a => generateMinified(a)).join(',');
      return `${node.callee}(${args})`;
    }

    case 'IfExpr': {
      const cond = generateMinified(node.condition);
      const thenBranch = generateMinified(node.then);
      const elseBranch = generateMinified(node.else);
      return `(${cond}?${thenBranch}:${elseBranch})`;
    }

    case 'BlockExpr': {
      const stmts = node.body.map(s => `${generateMinified(s)};`).join('');
      return `{${stmts}}`;
    }

    case 'Assignment': {
      const val = generateMinified(node.value);
      return `${node.name}=${val}`;
    }
  }
}

// ─── CodeGen class ────────────────────────────────────────────────────────────

export interface CodeGenOptions {
  indent?: number;
  semicolons?: boolean;
}

/**
 * Stateful code generator with configurable indent size and optional semicolons.
 */
export class CodeGen {
  private readonly indentSize: number;
  private readonly semicolons: boolean;

  constructor(options?: CodeGenOptions) {
    this.indentSize = options?.indent ?? 2;
    this.semicolons = options?.semicolons ?? true;
  }

  /**
   * Generate JavaScript for a single AST node.
   */
  generate(node: ASTNode): string {
    return this.#genNode(node, 0);
  }

  /**
   * Generate JavaScript for multiple AST nodes, one per line.
   */
  generateMany(nodes: ASTNode[]): string {
    return nodes.map(n => {
      const code = this.generate(n);
      return this.semicolons ? `${code};` : code;
    }).join('\n');
  }

  #genNode(node: ASTNode, indent: number): string {
    const pad = makeIndent(indent, this.indentSize);
    const pad1 = makeIndent(indent + 1, this.indentSize);

    switch (node.type) {
      case 'NumberLiteral':
        return String(node.value);

      case 'StringLiteral':
        return `"${escapeString(node.value)}"`;

      case 'BoolLiteral':
        return String(node.value);

      case 'Identifier':
        return node.name;

      case 'BinaryExpr': {
        const l = this.#genNode(node.left, indent);
        const r = this.#genNode(node.right, indent);
        return `(${l} ${node.op} ${r})`;
      }

      case 'UnaryExpr': {
        const operand = this.#genNode(node.operand, indent);
        return `${node.op}${operand}`;
      }

      case 'CallExpr': {
        const args = node.args.map(a => this.#genNode(a, indent)).join(', ');
        return `${node.callee}(${args})`;
      }

      case 'IfExpr': {
        const cond = this.#genNode(node.condition, indent);
        const thenBranch = this.#genNode(node.then, indent);
        const elseBranch = this.#genNode(node.else, indent);
        return `(${cond} ? ${thenBranch} : ${elseBranch})`;
      }

      case 'BlockExpr': {
        if (node.body.length === 0) return `{\n${pad}}`;
        const semi = this.semicolons ? ';' : '';
        const lines = node.body
          .map(s => `${pad1}${this.#genNode(s, indent + 1)}${semi}`)
          .join('\n');
        return `{\n${lines}\n${pad}}`;
      }

      case 'Assignment': {
        const val = this.#genNode(node.value, indent);
        return `${node.name} = ${val}`;
      }
    }
  }
}
