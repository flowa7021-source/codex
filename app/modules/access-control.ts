// @ts-check
// ─── Access Control ───────────────────────────────────────────────────────────
// Role-based access control (RBAC) with resource ownership and ACL entries.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ACLEntry {
  subjectId: string;
  resourceId: string;
  permissions: string[];  // e.g. ['read', 'write', 'delete']
}

export interface ResourceOwnership {
  resourceId: string;
  ownerId: string;
}

// ─── AccessControl ────────────────────────────────────────────────────────────

export class AccessControl {
  // key: `${subjectId}::${resourceId}`
  #acl: Map<string, Set<string>> = new Map();
  // resourceId -> ownerId
  #owners: Map<string, string> = new Map();

  #key(subjectId: string, resourceId: string): string {
    return `${subjectId}::${resourceId}`;
  }

  /** Grant permissions to a subject on a resource. */
  grant(subjectId: string, resourceId: string, permissions: string[]): void {
    const key = this.#key(subjectId, resourceId);
    const existing = this.#acl.get(key);
    if (existing !== undefined) {
      for (const p of permissions) existing.add(p);
    } else {
      this.#acl.set(key, new Set(permissions));
    }
  }

  /** Revoke specific permissions from a subject on a resource. */
  revoke(subjectId: string, resourceId: string, permissions: string[]): void {
    const key = this.#key(subjectId, resourceId);
    const existing = this.#acl.get(key);
    if (existing === undefined) return;
    for (const p of permissions) existing.delete(p);
    if (existing.size === 0) this.#acl.delete(key);
  }

  /** Revoke all permissions a subject has on a resource. */
  revokeAll(subjectId: string, resourceId: string): void {
    this.#acl.delete(this.#key(subjectId, resourceId));
  }

  /** Check if subject has a specific permission on a resource. */
  check(subjectId: string, resourceId: string, permission: string): boolean {
    // Owners have all permissions
    if (this.#owners.get(resourceId) === subjectId) return true;

    const key = this.#key(subjectId, resourceId);
    const perms = this.#acl.get(key);
    return perms !== undefined && perms.has(permission);
  }

  /** Check multiple permissions — all must be present. */
  checkAll(
    subjectId: string,
    resourceId: string,
    permissions: string[],
  ): boolean {
    return permissions.every((p) => this.check(subjectId, resourceId, p));
  }

  /** Check at least one of the given permissions is present. */
  checkAny(
    subjectId: string,
    resourceId: string,
    permissions: string[],
  ): boolean {
    return permissions.some((p) => this.check(subjectId, resourceId, p));
  }

  /** Set resource owner — the owner implicitly has all permissions. */
  setOwner(resourceId: string, ownerId: string): void {
    this.#owners.set(resourceId, ownerId);
  }

  /** Get all ACL entries for a subject. */
  getForSubject(subjectId: string): ACLEntry[] {
    const result: ACLEntry[] = [];
    for (const [key, perms] of this.#acl) {
      const [sid, rid] = key.split('::');
      if (sid === subjectId) {
        result.push({
          subjectId: sid,
          resourceId: rid,
          permissions: Array.from(perms),
        });
      }
    }
    return result;
  }

  /** Get all subjects with explicit ACL entries for a resource. */
  getForResource(resourceId: string): ACLEntry[] {
    const result: ACLEntry[] = [];
    for (const [key, perms] of this.#acl) {
      const [sid, rid] = key.split('::');
      if (rid === resourceId) {
        result.push({
          subjectId: sid,
          resourceId: rid,
          permissions: Array.from(perms),
        });
      }
    }
    return result;
  }

  /**
   * Clone all explicit ACL entries from one resource to another.
   * Existing entries on the target resource are preserved (permissions are merged).
   */
  cloneAccess(fromResourceId: string, toResourceId: string): void {
    for (const [key, perms] of this.#acl) {
      const [sid, rid] = key.split('::');
      if (rid === fromResourceId) {
        this.grant(sid, toResourceId, Array.from(perms));
      }
    }
  }
}
