// @ts-check
// ─── File Tree ────────────────────────────────────────────────────────────────
// In-memory file tree structure.

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileNodeType = 'file' | 'directory';

export interface FileNode {
  name: string;
  type: FileNodeType;
  path: string;
  children?: FileNode[];
  size?: number;
  metadata?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize a path: collapse slashes, trim trailing slash. */
function normPath(p: string): string {
  const parts = p.split('/').filter((s) => s.length > 0);
  return '/' + parts.join('/');
}

/** Split a path into its non-empty segments. */
function segments(p: string): string[] {
  return p.split('/').filter((s) => s.length > 0);
}

// ─── FileTree ─────────────────────────────────────────────────────────────────

export class FileTree {
  #root: FileNode;

  constructor(root = '/') {
    const name = root === '/' ? '/' : root.split('/').filter(Boolean).pop() ?? '/';
    this.#root = { name, type: 'directory', path: '/', children: [] };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Return the node at the given path, or undefined. */
  #getNode(path: string): FileNode | undefined {
    const p = normPath(path);
    if (p === '/') return this.#root;

    const parts = segments(p);
    let current: FileNode = this.#root;

    for (const part of parts) {
      if (!current.children) return undefined;
      const child = current.children.find((c) => c.name === part);
      if (!child) return undefined;
      current = child;
    }
    return current;
  }

  /** Return parent node and the target name for a given path. */
  #getParentAndName(path: string): { parent: FileNode | undefined; name: string } {
    const p = normPath(path);
    const parts = segments(p);
    const name = parts[parts.length - 1] ?? '/';
    const parentPath = parts.length <= 1 ? '/' : '/' + parts.slice(0, -1).join('/');
    return { parent: this.#getNode(parentPath), name };
  }

  /** Ensure all intermediate directories exist for a path. */
  #ensureDirs(path: string): void {
    const parts = segments(normPath(path));
    let current: FileNode = this.#root;
    let currentPath = '';

    for (const part of parts) {
      currentPath += '/' + part;
      if (!current.children) current.children = [];
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, type: 'directory', path: currentPath, children: [] };
        current.children.push(child);
      }
      current = child;
    }
  }

  /** Collect all nodes matching a predicate (recursive). */
  #collectAll(node: FileNode, pred: (n: FileNode) => boolean, out: FileNode[]): void {
    if (node !== this.#root && pred(node)) out.push(node);
    if (node.children) {
      for (const child of node.children) {
        this.#collectAll(child, pred, out);
      }
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Add a file at path (creates intermediate directories). */
  addFile(path: string, size?: number, metadata?: Record<string, unknown>): FileNode {
    const p = normPath(path);
    const parts = segments(p);
    const name = parts[parts.length - 1];
    if (!name) throw new Error('Invalid path for file');

    // Ensure parent directories exist
    const parentPath = parts.length <= 1 ? '/' : '/' + parts.slice(0, -1).join('/');
    this.#ensureDirs(parentPath);

    const parent = this.#getNode(parentPath);
    if (!parent || parent.type !== 'directory') {
      throw new Error(`Parent is not a directory: ${parentPath}`);
    }
    if (!parent.children) parent.children = [];

    // Replace existing node at this path if any
    const existingIdx = parent.children.findIndex((c) => c.name === name);
    const node: FileNode = { name, type: 'file', path: p, size, metadata };
    if (existingIdx >= 0) {
      parent.children[existingIdx] = node;
    } else {
      parent.children.push(node);
    }
    return node;
  }

  /** Add a directory at path. */
  addDir(path: string): FileNode {
    const p = normPath(path);
    if (p === '/') return this.#root;

    this.#ensureDirs(p);
    const node = this.#getNode(p);
    if (!node) throw new Error(`Failed to create directory: ${p}`);
    return node;
  }

  /** Remove a node at path. */
  remove(path: string): boolean {
    const p = normPath(path);
    if (p === '/') return false;

    const { parent, name } = this.#getParentAndName(p);
    if (!parent || !parent.children) return false;

    const idx = parent.children.findIndex((c) => c.name === name);
    if (idx < 0) return false;
    parent.children.splice(idx, 1);
    return true;
  }

  /** Get a node at path. */
  get(path: string): FileNode | undefined {
    return this.#getNode(normPath(path));
  }

  /** Check if path exists. */
  exists(path: string): boolean {
    return this.#getNode(normPath(path)) !== undefined;
  }

  /** List children of a directory. */
  list(path: string): FileNode[] {
    const node = this.#getNode(normPath(path));
    if (!node || node.type !== 'directory') return [];
    return node.children ? [...node.children] : [];
  }

  /** Move/rename a node. */
  move(from: string, to: string): boolean {
    const src = normPath(from);
    const dst = normPath(to);
    if (src === dst) return true;

    const srcNode = this.#getNode(src);
    if (!srcNode) return false;

    // Remove from current parent
    const { parent: srcParent, name: srcName } = this.#getParentAndName(src);
    if (!srcParent || !srcParent.children) return false;
    const srcIdx = srcParent.children.findIndex((c) => c.name === srcName);
    if (srcIdx < 0) return false;

    // Ensure destination parent directories exist
    const dstParts = segments(dst);
    const dstName = dstParts[dstParts.length - 1];
    const dstParentPath = dstParts.length <= 1 ? '/' : '/' + dstParts.slice(0, -1).join('/');
    this.#ensureDirs(dstParentPath);

    const dstParent = this.#getNode(dstParentPath);
    if (!dstParent || dstParent.type !== 'directory') return false;
    if (!dstParent.children) dstParent.children = [];

    // Remove source node
    srcParent.children.splice(srcIdx, 1);

    // Update paths recursively helper
    const updatePaths = (node: FileNode, newPath: string): void => {
      node.path = newPath;
      node.name = newPath.split('/').filter(Boolean).pop() ?? node.name;
      if (node.children) {
        for (const child of node.children) {
          updatePaths(child, newPath + '/' + child.name);
        }
      }
    };

    // Replace or insert at destination
    const existingIdx = dstParent.children.findIndex((c) => c.name === dstName);
    updatePaths(srcNode, dst);
    if (existingIdx >= 0) {
      dstParent.children[existingIdx] = srcNode;
    } else {
      dstParent.children.push(srcNode);
    }
    return true;
  }

  /** Get all files (recursive). */
  allFiles(): FileNode[] {
    const out: FileNode[] = [];
    this.#collectAll(this.#root, (n) => n.type === 'file', out);
    return out;
  }

  /** Get all directories (recursive). */
  allDirs(): FileNode[] {
    const out: FileNode[] = [];
    this.#collectAll(this.#root, (n) => n.type === 'directory', out);
    return out;
  }

  /** Find files matching a predicate. */
  find(pred: (node: FileNode) => boolean): FileNode[] {
    const out: FileNode[] = [];
    this.#collectAll(this.#root, pred, out);
    return out;
  }

  /** Get total size of all files. */
  totalSize(): number {
    return this.allFiles().reduce((acc, f) => acc + (f.size ?? 0), 0);
  }

  /** Serialize tree to a plain object. */
  toObject(): FileNode {
    const clone = (node: FileNode): FileNode => {
      const result: FileNode = { name: node.name, type: node.type, path: node.path };
      if (node.size !== undefined) result.size = node.size;
      if (node.metadata !== undefined) result.metadata = { ...node.metadata };
      if (node.children) result.children = node.children.map(clone);
      return result;
    };
    return clone(this.#root);
  }
}
