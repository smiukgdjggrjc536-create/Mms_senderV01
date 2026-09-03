// ============================================================================
// V7 P5.1 — Toggle Registry (server-authoritative God-Mode Matrix v2)
// ============================================================================
// Every user-panel control gets a key with: visibility, enabled, defaultValue,
// allowedRoles, packageTier. Admin changes a toggle → DB persistence + Redis
// pub/sub → user panel live update. The UI NEVER trusts itself — every render
// decision comes from the server.
//
// Exports:
//   TOGGLE_REGISTRY, resolveToggles, getToggle, isToggleEnabled,
//   isToggleVisible, updateToggle, publishToggleChange, subscribeToggleChanges,
//   getEffectiveTogglesForUser, enforceToggle (middleware helper)
// ============================================================================

import { connectDB } from '../core.js';
import { getRedisClient, isRedisLive } from '../redis/client.js';
import { sanitizeInput } from '../validate/sanitize.js';

// Lazy-load FeatureToggle model
async function _getFeatureToggleModel() {
  const mod = await import('@/models/featureToggle.js');
  return mod.default;
}

// ---------------------------------------------------------------------------
// TOGGLE_REGISTRY — the canonical definition of all user-panel controls.
// Each toggle has:
//   key:          unique identifier (matches featureToggle DEFAULT_TOGGLES)
//   label:        human-readable label
//   category:     grouping for the matrix UI
//   defaultValue: the value the control shows when enabled+visible
//   allowedRoles: which user roles can see/use this control
//   packageTier:  minimum package tier required (0=free, 1=basic, 2=pro, 3=enterprise)
// ---------------------------------------------------------------------------

export const TOGGLE_REGISTRY = [
  // Dedicated inputs
  { key: 'tfnNumber', label: 'TFN Number Input', category: 'dedicated_inputs', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'helpDeskLink', label: 'Help Desk Link Input', category: 'dedicated_inputs', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'invoiceFormat', label: 'Custom Invoice Format Input', category: 'dedicated_inputs', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },
  { key: 'transactionFormat', label: 'Custom Transaction Format Input', category: 'dedicated_inputs', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },
  { key: 'boilingSummary', label: 'Boiling Summary Input', category: 'dedicated_inputs', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },

  // Content editor
  { key: 'htmlEditor', label: 'Raw HTML Editor', category: 'content_editor', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'tagPills', label: 'Interactive Tag Pills', category: 'content_editor', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'contentMode', label: 'Content Mode Selector', category: 'content_editor', defaultValue: 'html', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'bodyTemplates', label: 'Body Template Manager', category: 'content_editor', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'subjectCategories', label: 'Subject Category Manager', category: 'content_editor', defaultValue: '', allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },

  // Sending options
  { key: 'batchSize', label: 'Batch Size Control', category: 'sending_options', defaultValue: 50, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'delayControl', label: 'Send Delay Control', category: 'sending_options', defaultValue: 500, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'senderRotation', label: 'Sender Mail Rotation', category: 'sending_options', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'fromNameRotation', label: 'From Name Rotation', category: 'sending_options', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'antiDetect', label: 'Anti-Detection Mode', category: 'sending_options', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },
  { key: 'trackPixel', label: 'Tracking Pixel', category: 'sending_options', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'humanizeMode', label: 'Humanize Mode', category: 'sending_options', defaultValue: false, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },

  // Validation
  { key: 'cognitiveTrustValidator', label: '5-Second Cognitive Trust Validator', category: 'validation', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'bounceCheck', label: 'Bounce Risk Filter', category: 'validation', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },

  // AI engine
  { key: 'backgroundAiEngine', label: 'Background AI Engine', category: 'ai_engine', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'aiNameGeneration', label: 'AI Name Pool Generation', category: 'ai_engine', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'aiSubjectGeneration', label: 'AI Subject Pool Generation', category: 'ai_engine', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'autoRestock', label: 'Auto-Restock Pools', category: 'ai_engine', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },

  // Threshold
  { key: 'googleApiThreshold', label: 'Google API Smart Threshold', category: 'threshold', defaultValue: 500, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'autoPauseAtLimit', label: 'Auto-Pause at Limit', category: 'threshold', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },
  { key: 'resumeLoop', label: 'Seamless Resume Loop', category: 'threshold', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },
  { key: 'credentialAlertModal', label: 'Enterprise Alert Modal for New Credentials', category: 'threshold', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 3 },

  // Sender management
  { key: 'gmailConnect', label: 'Gmail Credentials.json Connect', category: 'sender_management', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'senderList', label: 'Sender Account List', category: 'sender_management', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 0 },
  { key: 'senderAutoFill', label: 'Sender Mail Auto-Fill', category: 'sender_management', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 1 },

  // Campaign sandboxes
  { key: 'campaignSandboxes', label: '4 Campaign Sandboxes', category: 'sending_options', defaultValue: true, allowedRoles: ['user', 'admin', 'superadmin'], packageTier: 2 },
];

// Quick lookup map
const _REGISTRY_MAP = new Map(TOGGLE_REGISTRY.map((t) => [t.key, t]));

// Redis pub/sub channel for live toggle updates
const TOGGLE_PUBSUB_CHANNEL = 'toggles:updates';

// ---------------------------------------------------------------------------
// resolveToggles(dbToggles, userContext)
//   Merge the DB-stored toggle states with the registry defaults.
//   Returns the effective toggle set for the given user context.
//   userContext = { role, packageTier }
//   Each entry: { key, label, category, visible, enabled, defaultValue, allowedRoles, packageTier }
// ---------------------------------------------------------------------------
export function resolveToggles(dbToggles, userContext = {}) {
  const role = userContext.role || 'user';
  const userTier = userContext.packageTier || 0;

  // Build a map of DB toggle states
  const dbMap = new Map();
  if (Array.isArray(dbToggles)) {
    for (const t of dbToggles) {
      if (t && t.key) dbMap.set(t.key, t);
    }
  }

  return TOGGLE_REGISTRY.map((reg) => {
    const db = dbMap.get(reg.key);
    const allowedRoles = reg.allowedRoles || ['user', 'admin', 'superadmin'];
    const roleAllowed = allowedRoles.includes(role);
    const tierOk = userTier >= (reg.packageTier || 0);

    // visible = admin-set visible AND role allowed AND package tier sufficient
    const visible = (db ? db.visible : true) && roleAllowed && tierOk;
    // enabled = admin-set enabled (only if visible)
    const enabled = visible && (db ? db.enabled : true);

    return {
      key: reg.key,
      label: reg.label,
      category: reg.category,
      visible,
      enabled,
      defaultValue: reg.defaultValue,
      allowedRoles: reg.allowedRoles,
      packageTier: reg.packageTier,
      locked: db ? !!db.locked : false,
    };
  });
}

// ---------------------------------------------------------------------------
// getEffectiveTogglesForUser(userContext)
//   Read the God-Mode Matrix singleton from DB, resolve for the user, return.
//   Falls back to registry defaults if DB is unreachable.
// ---------------------------------------------------------------------------
export async function getEffectiveTogglesForUser(userContext = {}) {
  try {
    const FeatureToggle = await _getFeatureToggleModel();
    const doc = await FeatureToggle.getOrCreate();
    return resolveToggles(doc?.toggles || [], userContext);
  } catch (err) {
    console.error(`[toggles] getEffectiveTogglesForUser failed: ${err.message}`);
    // Graceful fallback: registry defaults with no DB overrides
    return resolveToggles([], userContext);
  }
}

// ---------------------------------------------------------------------------
// getToggle(key, userContext)
//   Get a single resolved toggle for a user.
// ---------------------------------------------------------------------------
export async function getToggle(key, userContext = {}) {
  const toggles = await getEffectiveTogglesForUser(userContext);
  return toggles.find((t) => t.key === key) || null;
}

// ---------------------------------------------------------------------------
// isToggleEnabled(key, userContext)
//   Returns true if the toggle is enabled for the user. Server-authoritative.
// ---------------------------------------------------------------------------
export async function isToggleEnabled(key, userContext = {}) {
  const t = await getToggle(key, userContext);
  return t ? t.enabled : false;
}

// ---------------------------------------------------------------------------
// isToggleVisible(key, userContext)
//   Returns true if the toggle is visible for the user.
// ---------------------------------------------------------------------------
export async function isToggleVisible(key, userContext = {}) {
  const t = await getToggle(key, userContext);
  return t ? t.visible : false;
}

// ---------------------------------------------------------------------------
// updateToggle(key, patch)
//   Admin-only: update a toggle's visible/enabled/locked state.
//   Persists to DB + publishes via Redis pub/sub for live UI update.
//   Returns the updated toggle entry.
// ---------------------------------------------------------------------------
export async function updateToggle(key, patch) {
  // Validate the key exists in the registry
  if (!_REGISTRY_MAP.has(key)) {
    throw new Error(`Unknown toggle key: ${key}`);
  }

  // Sanitize the patch (only allow visible/enabled/locked)
  const clean = sanitizeInput(patch, {
    visible: { type: 'boolean', required: false },
    enabled: { type: 'boolean', required: false },
    locked: { type: 'boolean', required: false },
  });
  if (!clean.ok) {
    throw new Error(`Invalid toggle patch: ${clean.errors?.join(', ') || 'validation failed'}`);
  }

  try {
    const FeatureToggle = await _getFeatureToggleModel();
    const doc = await FeatureToggle.getOrCreate();
    if (!doc) throw new Error('FeatureToggle singleton not found');

    // Find or add the toggle in the toggles array
    let toggle = doc.toggles.find((t) => t.key === key);
    if (!toggle) {
      toggle = { key, label: _REGISTRY_MAP.get(key).label, category: _REGISTRY_MAP.get(key).category, visible: true, enabled: true, locked: false };
      doc.toggles.push(toggle);
    }

    // Apply patch (respect locked: a locked toggle can only be unlocked by superadmin)
    if (clean.data.visible !== undefined) toggle.visible = clean.data.visible;
    if (clean.data.enabled !== undefined) toggle.enabled = clean.data.enabled;
    if (clean.data.locked !== undefined) toggle.locked = clean.data.locked;

    doc.updatedAt = new Date();
    await doc.save();

    // Publish the change via Redis pub/sub
    await publishToggleChange(key, { visible: toggle.visible, enabled: toggle.enabled, locked: toggle.locked });

    return { key, visible: toggle.visible, enabled: toggle.enabled, locked: toggle.locked };
  } catch (err) {
    console.error(`[toggles] updateToggle failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// publishToggleChange(key, state)
//   Publish a toggle state change on the Redis pub/sub channel.
// ---------------------------------------------------------------------------
export async function publishToggleChange(key, state) {
  try {
    const redis = getRedisClient();
    const msg = JSON.stringify({ key, state, timestamp: Date.now() });
    if (isRedisLive()) {
      await redis.publish(TOGGLE_PUBSUB_CHANNEL, msg);
    } else {
      // In-memory fallback: store the last message for polling
      _lastPubSubMsg = msg;
    }
  } catch (err) {
    console.error(`[toggles] publishToggleChange failed: ${err.message}`);
  }
}

// In-memory fallback for pub/sub when Redis is not live
let _lastPubSubMsg = null;
export function _getLastTogglePubSubMsg() {
  return _lastPubSubMsg;
}

// ---------------------------------------------------------------------------
// subscribeToggleChanges(callback)
//   Subscribe to toggle change notifications (Redis pub/sub).
//   Returns an unsubscribe function.
//   In fallback mode, this is a no-op (returns a no-op unsubscribe).
// ---------------------------------------------------------------------------
export async function subscribeToggleChanges(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('subscribeToggleChanges expects a function');
  }
  if (!isRedisLive()) {
    // Fallback: no pub/sub — caller must poll getEffectiveTogglesForUser
    return () => {};
  }
  try {
    const redis = getRedisClient();
    const subscriber = redis.duplicate();
    await subscriber.subscribe(TOGGLE_PUBSUB_CHANNEL);
    subscriber.on('message', (channel, msg) => {
      if (channel === TOGGLE_PUBSUB_CHANNEL) {
        try {
          const parsed = JSON.parse(msg);
          callback(parsed);
        } catch (e) {
          // ignore malformed messages
        }
      }
    });
    return () => {
      try {
        subscriber.unsubscribe(TOGGLE_PUBSUB_CHANNEL);
        subscriber.disconnect();
      } catch (e) {
        // best-effort
      }
    };
  } catch (err) {
    console.error(`[toggles] subscribeToggleChanges failed: ${err.message}`);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// enforceToggle(key, userContext)
//   Middleware helper: returns { ok: true } if the toggle is enabled for the
//   user, or { ok: false, status: 403, error } if disabled.
//   This is the server-authoritative gate that prevents devtools bypass.
// ---------------------------------------------------------------------------
export async function enforceToggle(key, userContext = {}) {
  const enabled = await isToggleEnabled(key, userContext);
  if (!enabled) {
    return {
      ok: false,
      status: 403,
      error: `This feature (${key}) is currently disabled by the administrator.`,
    };
  }
  return { ok: true };
}

export default {
  TOGGLE_REGISTRY,
  resolveToggles,
  getEffectiveTogglesForUser,
  getToggle,
  isToggleEnabled,
  isToggleVisible,
  updateToggle,
  publishToggleChange,
  subscribeToggleChanges,
  enforceToggle,
};
