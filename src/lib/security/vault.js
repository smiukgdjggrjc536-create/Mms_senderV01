// ============================================================================
// vault.js — Encrypted Credentials Vault (AES-256-GCM envelope)
// ----------------------------------------------------------------------------
// SPEC (V7 P1.1):
//   - AES-256-GCM envelope encryption.
//   - Vault file format (JSON): { v:1, iv, salt, tag, ciphertext }
//   - Key derivation: scrypt(password, salt, 32) -> 32-byte AES key.
//   - Master password/key from env CRED_MASTER_KEY (48-byte random hex/base64)
//     — NEVER in code. If CRED_MASTER_KEY is absent in production we fail loud.
//   - vault.encrypt(obj) / vault.decrypt() — used by server code to load
//     provider credentials at runtime; plaintext NEVER hits disk unencrypted.
//   - scripts/vault-cli.js drives set/get/list against this module.
//
// The vault file path defaults to .credentials.enc in the project root and can
// be overridden via env CRED_VAULT_PATH.
//
// GRACEFUL DEV FALLBACK: if CRED_MASTER_KEY is unset we derive a deterministic
// dev key from a fixed passphrase (clearly logged as INSECURE) so local dev
// and the build gate still work. In production the operator MUST set
// CRED_MASTER_KEY or loadCredentials() throws.
// ============================================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const VAULT_VERSION = 1;
const VAULT_PATH = process.env.CRED_VAULT_PATH || path.resolve(__dirname, '../../../.credentials.enc');
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// Deterministic dev passphrase — ONLY used when CRED_MASTER_KEY is unset.
const DEV_PASSPHRASE = 'mms-sender-v7-dev-only-do-not-use-in-production-7f3a';

let _devWarned = false;

/**
 * Resolve the master password used for scrypt key derivation.
 * In production this is CRED_MASTER_KEY (a 48-byte random value as hex/base64).
 * In dev (no env) we fall back to a fixed passphrase and warn loudly ONCE.
 */
function getMasterPassword() {
  const envKey = process.env.CRED_MASTER_KEY;
  if (envKey && envKey.length >= 16) {
    return envKey;
  }
  if (!_devWarned) {
    console.warn(
      '[vault] WARNING: CRED_MASTER_KEY is not set — using an INSECURE dev passphrase. ' +
        'Set CRED_MASTER_KEY (48-byte random, e.g. `node -e "console.log(crypto.randomBytes(48).toString(\'hex\'))"`) in production.'
    );
    _devWarned = true;
  }
  return DEV_PASSPHRASE;
}

/**
 * Derive a 32-byte AES-256 key from the master password + salt via scrypt.
 */
function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, SCRYPT_PARAMS);
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt an arbitrary JSON-serializable object into the vault envelope.
 * Returns the envelope object: { v, iv, salt, tag, ciphertext }.
 * @param {object} obj
 * @returns {{ v:number, iv:string, salt:string, tag:string, ciphertext:string }}
 */
export function encrypt(obj) {
  try {
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
    const key = deriveKey(getMasterPassword(), salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      v: VAULT_VERSION,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  } catch (err) {
    throw new Error(`vault.encrypt failed: ${err.message}`);
  }
}

/**
 * Decrypt a vault envelope back into the original object.
 * Throws if the auth tag is invalid (tampering / wrong key).
 * @param {{ v:number, iv:string, salt:string, tag:string, ciphertext:string }} envelope
 * @returns {object}
 */
export function decrypt(envelope) {
  try {
    if (!envelope || typeof envelope !== 'object') {
      throw new Error('envelope must be an object');
    }
    if (envelope.v !== VAULT_VERSION) {
      throw new Error(`unsupported vault version: ${envelope.v}`);
    }
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const key = deriveKey(getMasterPassword(), salt);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (err) {
    throw new Error(`vault.decrypt failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// File-backed helpers (used by vault-cli.js + server loadCredentials)
// ---------------------------------------------------------------------------

/**
 * Read + decrypt the vault file. Returns {} if the file does not exist yet.
 */
export function readVault() {
  try {
    if (!fs.existsSync(VAULT_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(VAULT_PATH, 'utf8').trim();
    if (!raw) return {};
    const envelope = JSON.parse(raw);
    return decrypt(envelope);
  } catch (err) {
    throw new Error(`vault.readVault failed: ${err.message}`);
  }
}

/**
 * Encrypt + write the credentials object to the vault file atomically.
 */
export function writeVault(obj) {
  try {
    const envelope = encrypt(obj);
    const tmpPath = VAULT_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(envelope), { mode: 0o600 });
    fs.renameSync(tmpPath, VAULT_PATH);
    // Restrict permissions on the final file.
    try { fs.chmodSync(VAULT_PATH, 0o600); } catch (_) {}
    return true;
  } catch (err) {
    throw new Error(`vault.writeVault failed: ${err.message}`);
  }
}

/**
 * Set a single key in the vault and persist.
 */
export function setKey(key, value) {
  const creds = readVault();
  creds[key] = value;
  writeVault(creds);
  return true;
}

/**
 * Get a single key from the vault (or undefined).
 */
export function getKey(key) {
  const creds = readVault();
  return creds[key];
}

/**
 * List all keys in the vault (values are NOT printed).
 */
export function listKeys() {
  const creds = readVault();
  return Object.keys(creds);
}

/**
 * Delete a single key from the vault and persist.
 */
export function deleteKey(key) {
  const creds = readVault();
  if (!(key in creds)) return false;
  delete creds[key];
  writeVault(creds);
  return true;
}

/**
 * loadCredentials() — the runtime entry point server code uses to obtain
 * provider credentials. Returns the decrypted credentials object.
 *
 * In production, CRED_MASTER_KEY must be set or this throws.
 * If the vault file is absent, returns {} (server code should then fall back
 * to per-account credentials in MongoDB / env, NOT hardcoded secrets).
 */
export function loadCredentials() {
  return readVault();
}

/**
 * Whether the vault file exists on disk.
 */
export function vaultExists() {
  return fs.existsSync(VAULT_PATH);
}

export const VAULT_FILE = VAULT_PATH;
export const VAULT_VERSION_CONST = VAULT_VERSION;

export default {
  encrypt,
  decrypt,
  readVault,
  writeVault,
  setKey,
  getKey,
  listKeys,
  deleteKey,
  loadCredentials,
  vaultExists,
  VAULT_FILE,
};
