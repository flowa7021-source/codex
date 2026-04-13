// @ts-check
// ─── Role System ──────────────────────────────────────────────────────────────
// Role-based access control (RBAC) with role inheritance.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Role {
  name: string;
  permissions: Array<{ action: string; resource: string }>;
  inherits?: string[];
}

// ─── RoleSystem ───────────────────────────────────────────────────────────────

export class RoleSystem {
  #roles: Map<string, Role> = new Map();
  #userRoles: Map<string, Set<string>> = new Map();

  /** Define a role with its permissions (and optional inheritance). */
  defineRole(role: Role): void {
    this.#roles.set(role.name, {
      name: role.name,
      permissions: role.permissions.slice(),
      inherits: role.inherits !== undefined ? role.inherits.slice() : [],
    });
  }

  /** Assign a role to a user. Silently ignores unknown role names. */
  assignRole(userId: string, roleName: string): void {
    let set = this.#userRoles.get(userId);
    if (set === undefined) {
      set = new Set();
      this.#userRoles.set(userId, set);
    }
    set.add(roleName);
  }

  /** Revoke a role from a user. */
  revokeRole(userId: string, roleName: string): void {
    const set = this.#userRoles.get(userId);
    if (set !== undefined) {
      set.delete(roleName);
    }
  }

  /**
   * Collect all role names reachable from a set of directly-assigned roles,
   * following `inherits` chains. Detects cycles to avoid infinite loops.
   */
  #expandRoles(direct: Set<string>): Set<string> {
    const visited = new Set<string>();
    const stack = Array.from(direct);
    while (stack.length > 0) {
      const name = stack.pop()!;
      if (visited.has(name)) continue;
      visited.add(name);
      const role = this.#roles.get(name);
      if (role?.inherits !== undefined) {
        for (const parent of role.inherits) {
          if (!visited.has(parent)) stack.push(parent);
        }
      }
    }
    return visited;
  }

  /**
   * Get all role names assigned to a user (including inherited roles).
   * Returns an empty array for unknown users.
   */
  getUserRoles(userId: string): string[] {
    const direct = this.#userRoles.get(userId);
    if (direct === undefined || direct.size === 0) return [];
    return Array.from(this.#expandRoles(direct));
  }

  /**
   * Check if user has a specific role (directly assigned only, not inherited).
   */
  hasRole(userId: string, roleName: string): boolean {
    const set = this.#userRoles.get(userId);
    return set !== undefined && set.has(roleName);
  }

  /**
   * Check if user has permission (considering all their roles and inheritance).
   * Supports '*' wildcards: a permission with action '*' matches any action,
   * and resource '*' matches any resource.
   */
  can(userId: string, action: string, resource: string): boolean {
    const allRoles = this.getUserRoles(userId);
    for (const roleName of allRoles) {
      const role = this.#roles.get(roleName);
      if (role === undefined) continue;
      for (const perm of role.permissions) {
        const actionMatch = perm.action === action || perm.action === '*';
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        if (actionMatch && resourceMatch) return true;
      }
    }
    return false;
  }

  /**
   * Get all effective permissions for a user (union across all roles,
   * including inherited ones). Duplicates are removed.
   */
  getEffectivePermissions(userId: string): Array<{ action: string; resource: string }> {
    const allRoles = this.getUserRoles(userId);
    const seen = new Set<string>();
    const result: Array<{ action: string; resource: string }> = [];
    for (const roleName of allRoles) {
      const role = this.#roles.get(roleName);
      if (role === undefined) continue;
      for (const perm of role.permissions) {
        const key = `${perm.action}\x00${perm.resource}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ action: perm.action, resource: perm.resource });
        }
      }
    }
    return result;
  }
}
