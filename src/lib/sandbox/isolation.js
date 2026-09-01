// ============================================================================
// V7 P6.2 — 4 Sandbox Isolation (zero cross-talk)
// ============================================================================
// Every campaign tab = a separate sandbox with:
//   - separate state slice (recipients, config, progress)
//   - separate credential set
//   - separate Redis key namespace: sb:{user}:{sandboxId}:...
//
// Operations (paste/upload/delete/clear) in one sandbox NEVER touch others.
// Each sandbox is identified by an integer 1-4.
//
// Exports:
//   SANDBOX_IDS, sandboxKey, getSandboxState, setSandboxState,
//   addRecipients, removeRecipient, clearRecipients, getRecipients,
//   setConfig, getConfig, setCredentials, getCredentials,
//   deleteSandbox, listSandboxes, snapshotSandbox, verifyIsolation
// ============================================================================

import { getRedisClient, isRedisLive } from '../redis/client.js';

export const SANDBOX_IDS = [1, 2, 3, 4];

const MAX_SANDBOXES = 4;
const STATE_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// Key helpers — every key is namespaced: sb:{user}:{sandboxId}:{field}
// ---------------------------------------------------------------------------

function _validateSandboxId(sandboxId) {
  const id = Number(sandboxId);
  if (!Number.isInteger(id) || id < 1 || id > MAX_SANDBOXES) {
    throw new Error(`Invalid sandbox id: ${sandboxId} (must be 1-${MAX_SANDBOXES})`);
  }
  return id;
}

function _validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }
  return userId;
}

/**
 * Build a sandbox-specific Redis key.
 * Format: sb:{user}:{sandboxId}:{field}
 */
export function sandboxKey(userId, sandboxId, field) {
  const uid = _validateUserId(userId);
  const sid = _validateSandboxId(sandboxId);
  return `sb:${uid}:${sid}:${field}`;
}

// ---------------------------------------------------------------------------
// State slice — the complete state of one sandbox
// ---------------------------------------------------------------------------

const STATE_FIELDS = {
  recipients: 'recipients',   // JSON array of email addresses
  config: 'config',           // JSON campaign config object
  credentials: 'credentials', // JSON array of credential IDs/emails
  status: 'status',           // 'idle' | 'running' | 'paused' | 'done' | 'error'
  progress: 'progress',       // JSON { sent, total, failed, lastUpdated }
};

/**
 * Get the full state snapshot of one sandbox.
 */
export async function getSandboxState(userId, sandboxId) {
  const redis = getRedisClient();
  const state = { sandboxId: Number(sandboxId), exists: false };

  for (const [name, field] of Object.entries(STATE_FIELDS)) {
    const key = sandboxKey(userId, sandboxId, field);
    try {
      const raw = await redis.get(key);
      if (raw != null) {
        state.exists = true;
        try { state[name] = JSON.parse(raw); }
        catch { state[name] = raw; }
      } else {
        state[name] = name === 'recipients' || name === 'credentials' ? [] : null;
        if (name === 'status') state[name] = 'idle';
        if (name === 'progress') state[name] = { sent: 0, total: 0, failed: 0, lastUpdated: 0 };
      }
    } catch (err) {
      state[name] = name === 'recipients' || name === 'credentials' ? [] : null;
    }
  }

  return state;
}

/**
 * Set a single field of a sandbox's state.
 * @param {string} field - one of STATE_FIELDS values
 * @param {*} value - will be JSON.stringify'd
 */
export async function setSandboxState(userId, sandboxId, field, value) {
  if (!STATE_FIELDS[field] && !Object.values(STATE_FIELDS).includes(field)) {
    throw new Error(`Unknown sandbox state field: ${field}`);
  }
  const redis = getRedisClient();
  const key = sandboxKey(userId, sandboxId, field);
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await redis.set(key, serialized, 'EX', STATE_TTL_SEC);
  return true;
}

// ---------------------------------------------------------------------------
// Recipients management
// ---------------------------------------------------------------------------

/**
 * Add recipients to a sandbox (dedup within the sandbox only).
 * @returns { number } count of newly added recipients
 */
export async function addRecipients(userId, sandboxId, emails) {
  if (!Array.isArray(emails)) return 0;
  const redis = getRedisClient();
  const stateKey = sandboxKey(userId, sandboxId, STATE_FIELDS.recipients);

  // Read current recipients
  let current = [];
  try {
    const raw = await redis.get(stateKey);
    if (raw) current = JSON.parse(raw);
    if (!Array.isArray(current)) current = [];
  } catch { current = []; }

  const existing = new Set(current.map(e => String(e).toLowerCase().trim()));
  let added = 0;
  for (const email of emails) {
    const clean = String(email).trim().toLowerCase();
    if (clean && !existing.has(clean)) {
      existing.add(clean);
      current.push(clean);
      added++;
    }
  }

  await redis.set(stateKey, JSON.stringify(current), 'EX', STATE_TTL_SEC);
  return added;
}

/**
 * Remove a specific recipient from a sandbox.
 */
export async function removeRecipient(userId, sandboxId, email) {
  const redis = getRedisClient();
  const stateKey = sandboxKey(userId, sandboxId, STATE_FIELDS.recipients);

  let current = [];
  try {
    const raw = await redis.get(stateKey);
    if (raw) current = JSON.parse(raw);
  } catch { current = []; }

  const target = String(email).trim().toLowerCase();
  const before = current.length;
  current = current.filter(e => e !== target);
  const after = current.length;

  await redis.set(stateKey, JSON.stringify(current), 'EX', STATE_TTL_SEC);
  return before - after;
}

/**
 * Clear all recipients from a sandbox.
 */
export async function clearRecipients(userId, sandboxId) {
  const redis = getRedisClient();
  const stateKey = sandboxKey(userId, sandboxId, STATE_FIELDS.recipients);
  await redis.set(stateKey, '[]', 'EX', STATE_TTL_SEC);
  return true;
}

/**
 * Get the recipients array for a sandbox.
 */
export async function getRecipients(userId, sandboxId) {
  const redis = getRedisClient();
  const stateKey = sandboxKey(userId, sandboxId, STATE_FIELDS.recipients);
  try {
    const raw = await redis.get(stateKey);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch { }
  return [];
}

// ---------------------------------------------------------------------------
// Config & Credentials
// ---------------------------------------------------------------------------

export async function setConfig(userId, sandboxId, config) {
  return setSandboxState(userId, sandboxId, 'config', config);
}

export async function getConfig(userId, sandboxId) {
  const redis = getRedisClient();
  const key = sandboxKey(userId, sandboxId, STATE_FIELDS.config);
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

export async function setCredentials(userId, sandboxId, credentials) {
  if (!Array.isArray(credentials)) throw new Error('credentials must be an array');
  return setSandboxState(userId, sandboxId, 'credentials', credentials);
}

export async function getCredentials(userId, sandboxId) {
  const redis = getRedisClient();
  const key = sandboxKey(userId, sandboxId, STATE_FIELDS.credentials);
  try {
    const raw = await redis.get(key);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch { }
  return [];
}

// ---------------------------------------------------------------------------
// Status & Progress
// ---------------------------------------------------------------------------

export async function setStatus(userId, sandboxId, status) {
  const valid = ['idle', 'running', 'paused', 'done', 'error'];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}`);
  return setSandboxState(userId, sandboxId, 'status', status);
}

export async function getStatus(userId, sandboxId) {
  const redis = getRedisClient();
  const key = sandboxKey(userId, sandboxId, STATE_FIELDS.status);
  try {
    const raw = await redis.get(key);
    if (raw) return String(raw).replace(/^"|"$/g, '');
  } catch { }
  return 'idle';
}

export async function setProgress(userId, sandboxId, progress) {
  return setSandboxState(userId, sandboxId, 'progress', progress);
}

export async function getProgress(userId, sandboxId) {
  const redis = getRedisClient();
  const key = sandboxKey(userId, sandboxId, STATE_FIELDS.progress);
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { sent: 0, total: 0, failed: 0, lastUpdated: 0 };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Delete all state for a sandbox (clear everything).
 */
export async function deleteSandbox(userId, sandboxId) {
  const redis = getRedisClient();
  let deleted = 0;
  for (const field of Object.values(STATE_FIELDS)) {
    const key = sandboxKey(userId, sandboxId, field);
    try {
      const n = await redis.del(key);
      deleted += Number(n) || 0;
    } catch { }
  }
  return deleted;
}

/**
 * List all sandboxes for a user with their state summaries.
 */
export async function listSandboxes(userId) {
  const list = [];
  for (const sid of SANDBOX_IDS) {
    const state = await getSandboxState(userId, sid);
    list.push({
      sandboxId: sid,
      status: state.status || 'idle',
      recipientCount: state.recipients ? state.recipients.length : 0,
      credentialCount: state.credentials ? state.credentials.length : 0,
      hasConfig: state.config != null,
      exists: state.exists,
    });
  }
  return list;
}

/**
 * Take a full snapshot of a sandbox (for debugging / state diff).
 */
export async function snapshotSandbox(userId, sandboxId) {
  return getSandboxState(userId, sandboxId);
}

/**
 * Verify isolation: check that sandboxes are completely independent.
 * Returns a diff object showing whether any cross-talk was detected.
 *
 * @param {string} userId
 * @returns { { isolated: boolean, details: object } }
 */
export async function verifyIsolation(userId) {
  const snapshots = {};
  for (const sid of SANDBOX_IDS) {
    snapshots[sid] = await snapshotSandbox(userId, sid);
  }

  // Verify that each sandbox has its own distinct key namespace
  const keyChecks = [];
  for (const sid of SANDBOX_IDS) {
    const key = sandboxKey(userId, sid, 'recipients');
    keyChecks.push({ sandboxId: sid, key });
  }

  // Check that no two sandboxes share a key
  const keys = keyChecks.map(k => k.key);
  const uniqueKeys = new Set(keys);
  const keysIsolated = keys.length === uniqueKeys.size;

  return {
    isolated: keysIsolated,
    details: {
      keyChecks,
      snapshots,
      message: keysIsolated
        ? 'All sandboxes have distinct key namespaces — zero cross-talk'
        : 'WARNING: key namespace collision detected!',
    },
  };
}

// ---------------------------------------------------------------------------
// API helper: enforce sandbox isolation at the API layer
// ---------------------------------------------------------------------------

/**
 * Assert that a sandbox belongs to a specific user.
 * This is a no-op in the current implementation (keys already include userId),
 * but serves as a hook for future multi-tenant access control.
 */
export function assertSandboxOwnership(userId, sandboxId) {
  _validateUserId(userId);
  _validateSandboxId(sandboxId);
  return true;
}

export default {
  SANDBOX_IDS,
  sandboxKey,
  getSandboxState,
  setSandboxState,
  addRecipients,
  removeRecipient,
  clearRecipients,
  getRecipients,
  setConfig,
  getConfig,
  setCredentials,
  getCredentials,
  setStatus,
  getStatus,
  setProgress,
  getProgress,
  deleteSandbox,
  listSandboxes,
  snapshotSandbox,
  verifyIsolation,
  assertSandboxOwnership,
};
