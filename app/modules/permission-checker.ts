// @ts-check
// ─── Permission Checker ───────────────────────────────────────────────────────
// Attribute-based access control (ABAC) with deny-overrides semantics.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

export interface Resource {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface Policy {
  id: string;
  effect: 'allow' | 'deny';
  subjects?: string[];   // subject ids or '*'
  roles?: string[];      // role names
  resources?: string[];  // resource types or '*'
  actions?: string[];    // action names or '*'
  condition?: (subject: Subject, resource: Resource, action: string) => boolean;
}

// ─── Matching helpers ─────────────────────────────────────────────────────────

function matchesWildcard(list: string[] | undefined, value: string): boolean {
  if (list === undefined || list.length === 0) return true;
  return list.includes('*') || list.includes(value);
}

function policyApplies(
  policy: Policy,
  subject: Subject,
  resource: Resource,
  action: string,
): boolean {
  // Subject match: subject id or one of the subject's roles is listed, or wildcard
  const subjectMatch =
    policy.subjects === undefined || policy.subjects.length === 0
      ? true
      : policy.subjects.includes('*') ||
        policy.subjects.includes(subject.id) ||
        (subject.roles !== undefined &&
          subject.roles.some((r) => policy.subjects!.includes(r)));

  if (!subjectMatch) return false;

  // Role match: subject must have at least one of the required roles
  const roleMatch =
    policy.roles === undefined || policy.roles.length === 0
      ? true
      : subject.roles !== undefined &&
        subject.roles.some((r) => policy.roles!.includes(r));

  if (!roleMatch) return false;

  // Resource type match
  if (!matchesWildcard(policy.resources, resource.type)) return false;

  // Action match
  if (!matchesWildcard(policy.actions, action)) return false;

  // Condition function (if present)
  if (policy.condition !== undefined) {
    return policy.condition(subject, resource, action);
  }

  return true;
}

// ─── PermissionChecker ────────────────────────────────────────────────────────

export class PermissionChecker {
  #policies: Map<string, Policy> = new Map();

  /** Add a policy. */
  addPolicy(policy: Policy): void {
    this.#policies.set(policy.id, policy);
  }

  /** Remove a policy by id. */
  removePolicy(id: string): void {
    this.#policies.delete(id);
  }

  /** Get all policies that apply to this subject/action/resource combination. */
  getApplicablePolicies(
    subject: Subject,
    action: string,
    resource: Resource,
  ): Policy[] {
    const result: Policy[] = [];
    for (const policy of this.#policies.values()) {
      if (policyApplies(policy, subject, resource, action)) {
        result.push(policy);
      }
    }
    return result;
  }

  /**
   * Check if subject can perform action on resource.
   * Deny takes precedence over allow. Default deny if no matching policy.
   */
  can(subject: Subject, action: string, resource: Resource): boolean {
    let hasAllow = false;

    for (const policy of this.#policies.values()) {
      if (!policyApplies(policy, subject, resource, action)) continue;

      if (policy.effect === 'deny') return false;
      if (policy.effect === 'allow') hasAllow = true;
    }

    return hasAllow;
  }

  /** Clear all policies. */
  clear(): void {
    this.#policies.clear();
  }
}
