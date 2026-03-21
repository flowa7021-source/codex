// ─── Sync Encryption ────────────────────────────────────────────────────────
// E2E encryption for cloud sync using Web Crypto API (AES-GCM).
// Key is derived from a user passphrase via PBKDF2.

const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_BITS = 256;
const IV_BYTES = 12;
const SALT_BYTES = 16;

/**
 * Derive an AES-GCM-256 CryptoKey from a passphrase and salt using PBKDF2.
 * @param {string} passphrase - User passphrase
 * @param {Uint8Array} salt - 16-byte salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(passphrase, salt) {
  if (!passphrase) throw new Error('Passphrase is required');
  if (!salt || salt.length !== 16) throw new Error('Salt must be 16 bytes');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt data using AES-GCM with a random 12-byte IV.
 * @param {ArrayBuffer|Uint8Array|string} data - Data to encrypt (strings are UTF-8 encoded)
 * @param {CryptoKey} key - AES-GCM key from deriveKey()
 * @returns {Promise<{ iv: Uint8Array, ciphertext: Uint8Array }>}
 */
export async function encrypt(data, key) {
  let plaintext;
  if (typeof data === 'string') {
    plaintext = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    plaintext = new Uint8Array(data);
  } else {
    plaintext = data;
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );
  return { iv, ciphertext: new Uint8Array(ciphertextBuffer) };
}

/**
 * Decrypt AES-GCM encrypted data.
 * @param {{ iv: Uint8Array, ciphertext: Uint8Array }} encrypted
 * @param {CryptoKey} key - AES-GCM key from deriveKey()
 * @returns {Promise<ArrayBuffer>} Decrypted plaintext as ArrayBuffer
 */
export async function decrypt(encrypted, key) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    key,
    encrypted.ciphertext,
  );
}

/**
 * Generate a random 16-byte salt for PBKDF2 key derivation.
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}
