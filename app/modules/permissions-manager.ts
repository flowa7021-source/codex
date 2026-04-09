// @ts-check
// ─── Permissions Manager ──────────────────────────────────────────────────────
// Permission-based access control (PBAC) with wildcard support.

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionAction = string;
export type PermissionResource = string;

export interface Permission {
  action: PermissionAction;
  resource: PermissionResource;
}

// ─── PermissionsManager ───────────────────────────────────────────────────────

export class PermissionsManager {
  #permissions: Map<string, Set<string>> = new Map();

  /** Encode an action+resource pair as a single key. */
  #key(action: PermissionAction, resource: PermissionResource): string {
    return `${action}\x00${resource}`;
  }

  /** Grant a permission to a subject (user/role id). */
  grant(subject: string, action: PermissionAction, resource: PermissionResource): void {
    let set = this.#permissions.get(subject);
    if (set === undefined) {
      set = new Set();
      this.#permissions.set(subject, set);
    }
    set.add(this.#key(action, resource));
  }

  /** Revoke a permission from a subject. */
  revoke(subject: string, action: PermissionAction, resource: PermissionResource): void {
    const set = this.#permissions.get(subject);
    if (set !== undefined) {
      set.delete(this.#key(action, resource));
    }
  }

  /**
   * Check if subject has permission.
   * Supports '*' wildcard for action and/or resource:
   *   - `can('u', '*', 'posts')` — any action on 'posts'
   *   - `can('u', 'read', '*')` — 'read' on any resource
   *   - `can('u', '*', '*')` — superuser (all actions on all resources)
   */
  can(subject: string, action: PermissionAction, resource: PermissionResource): boolean {
    const set = this.#permissions.get(subject);
    if (set === undefined || set.size === 0) return false;

    // Direct match
    if (set.has(this.#key(action, resource))) return true;
    // Wildcard action: granted '*' on the specific resource
    if (set.has(this.#key('*', resource))) return true;
    // Wildcard resource: granted specific action on '*'
    if (set.has(this.#key(action, '*'))) return true;
    // Double wildcard: superuser
    if (set.has(this.#key('*', '*'))) return true;

    return false;
  }

  /** Get all permissions for a subject. */
  getPermissions(subject: string): Permission[] {
    const set = this.#permissions.get(subject);
    if (set === undefined) return [];
    const result: Permission[] = [];
    for (const key of set) {
      const idx = key.indexOf('\x00');
      result.push({
        action: key.slice(0, idx),
        resource: key.slice(idx + 1),
      });
    }
    return result;
  }

  /** Revoke all permissions for a subject. */
  revokeAll(subject: string): void {
    this.#permissions.delete(subject);
  }

  /** Copy all permissions from one subject to another (additive). */
  copyPermissions(fromSubject: string, toSubject: string): void {
    const from = this.#permissions.get(fromSubject);
    if (from === undefined) return;
    let to = this.#permissions.get(toSubject);
    if (to === undefined) {
      to = new Set();
      this.#permissions.set(toSubject, to);
    }
    for (const key of from) {
      to.add(key);
    }
  }
}
