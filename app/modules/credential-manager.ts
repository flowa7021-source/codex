// ─── Credential Management API ───────────────────────────────────────────────
// Wraps the browser Credential Management API (navigator.credentials) to save
// and retrieve OAuth tokens and passwords for cloud providers such as Google
// Drive, OneDrive, and Dropbox.

// ─── Local declarations for Credential constructor types ─────────────────────
// These are declared locally to avoid polluting the global lib typings.

declare const PasswordCredential:
  | {
      new (data: {
        id: string;
        password: string;
        name?: string;
        iconURL?: string;
      }): object;
    }
  | undefined;

declare const FederatedCredential:
  | {
      new (data: {
        id: string;
        provider: string;
        name?: string;
        iconURL?: string;
      }): object;
    }
  | undefined;

// ─── Public interface ─────────────────────────────────────────────────────────

export interface StoredCredential {
  /** Provider ID (e.g. 'google-drive') or username. */
  id: string;
  type: 'password' | 'federated';
  /** Secret / token — only present for password credentials. */
  password?: string;
  /** Federation provider URL, e.g. 'https://accounts.google.com'. */
  provider?: string;
  /** Human-readable display name. */
  name?: string;
  /** URL to an avatar / icon. */
  iconURL?: string;
}

/** Options for {@link getCredential}. */
export interface GetCredentialOptions {
  mediation?: 'silent' | 'optional' | 'required';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Whether the Credential Management API is available in this environment.
 */
export function isCredentialManagementSupported(): boolean {
  return 'credentials' in navigator;
}

/**
 * Save a credential using the Credential Management API.
 *
 * Creates a `PasswordCredential` or `FederatedCredential` depending on the
 * `type` field and calls `navigator.credentials.store()`.
 *
 * @returns `true` on success, `false` if the API is unavailable or an error
 *   occurs (errors are swallowed so callers never need to catch).
 */
export async function saveCredential(cred: StoredCredential): Promise<boolean> {
  if (!isCredentialManagementSupported()) return false;

  try {
    const nav = navigator as any;
    let credObj: object | undefined;

    if (cred.type === 'password') {
      if (typeof PasswordCredential === 'undefined') return false;
      credObj = new PasswordCredential({
        id: cred.id,
        password: cred.password ?? '',
        name: cred.name,
        iconURL: cred.iconURL,
      });
    } else {
      if (typeof FederatedCredential === 'undefined') return false;
      credObj = new FederatedCredential({
        id: cred.id,
        provider: cred.provider ?? '',
        name: cred.name,
        iconURL: cred.iconURL,
      });
    }

    await nav.credentials.store(credObj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve a stored credential by ID.
 *
 * Calls `navigator.credentials.get()` with both `password` and `federated`
 * options so either credential type can be returned.
 *
 * @param id       The credential ID / username to look up.
 * @param opts     Optional mediation mode (default: browser default).
 * @returns The stored credential mapped to {@link StoredCredential}, or `null`
 *   when the API is unavailable, nothing is found, or an error occurs.
 */
export async function getCredential(
  id: string,
  opts: GetCredentialOptions = {},
): Promise<StoredCredential | null> {
  if (!isCredentialManagementSupported()) return null;

  try {
    const nav = navigator as any;

    const getOpts: Record<string, unknown> = {
      password: true,
      federated: {
        providers: [
          'https://accounts.google.com',
          'https://login.microsoftonline.com',
          'https://www.dropbox.com',
        ],
      },
    };

    if (opts.mediation) {
      getOpts['mediation'] = opts.mediation;
    }

    const result = await nav.credentials.get(getOpts);
    if (!result) return null;

    return _mapCredential(result);
  } catch {
    return null;
  }
}

/**
 * Prevent the browser from automatically signing the user back in.
 *
 * Calls `navigator.credentials.preventSilentAccess()`. This should be invoked
 * when the user explicitly signs out of a cloud provider.
 *
 * No-op when the Credential Management API is unavailable.
 */
export async function removeCredential(): Promise<void> {
  if (!isCredentialManagementSupported()) return;

  try {
    const nav = navigator as any;
    await nav.credentials.preventSilentAccess();
  } catch {
    // Silently ignore — not critical
  }
}

/**
 * List the credential types supported by the current environment.
 *
 * Checks for the presence of `PasswordCredential` and `FederatedCredential`
 * constructors in the global scope.
 */
export function listSupportedTypes(): Array<'password' | 'federated'> {
  const supported: Array<'password' | 'federated'> = [];

  if (typeof PasswordCredential !== 'undefined') {
    supported.push('password');
  }
  if (typeof FederatedCredential !== 'undefined') {
    supported.push('federated');
  }

  return supported;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map a raw credential object returned by the browser API to a
 * {@link StoredCredential} value object.
 */
function _mapCredential(raw: any): StoredCredential | null {
  if (!raw || !raw.id) return null;

  const base = {
    id: raw.id as string,
    name: raw.name as string | undefined,
    iconURL: (raw.iconURL ?? raw.iconUrl) as string | undefined,
  };

  // PasswordCredential has a `password` field
  if (typeof raw.password === 'string') {
    return { ...base, type: 'password', password: raw.password };
  }

  // FederatedCredential has a `provider` field
  if (typeof raw.provider === 'string') {
    return { ...base, type: 'federated', provider: raw.provider };
  }

  // Unknown / public-key credential — treat as federated without provider
  return { ...base, type: 'federated' };
}
