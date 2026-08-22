// ============================================================================
// MODULE 2: Dynamic Config Endpoint — Runtime Limits/Delay WITHOUT Restart
// ============================================================================
// GET  /api/admin/gateway/dynamic        → Retrieve all dynamic config values
// POST /api/admin/gateway/dynamic        → Set dynamic config values
//
// Stores runtime-configurable values in Redis so admins can change them
// WITHOUT restarting the Node.js process. Supported keys:
//   • routingDelayMs       — micro-delay between dispatches (ms)
//   • batchSizePerAccount  — messages per account before rotation
//   • maxConcurrency       — concurrent queue workers
//   • queuePaused          — pause/resume the dispatch queue
//   • aiPolymorphEnabled   — toggle AI rewriting on/off
//   • safetyFilterEnabled  — toggle the phishing/keyword filter
//
// Falls back to SystemConfig (Mongo) defaults when a Redis key is unset.
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth helpers.
// ============================================================================

import { connectDB, verifyToken, jsonResponse, SystemConfig, logActivity, pauseQueue, resumeQueue } from '@/lib/core';
import { getDynamicConfig, setDynamicConfig } from '@/lib/redis';
import { DYNAMIC_CONFIG_KEYS } from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Auth helpers (mirrors /api/admin/gateway/route.js)
// ---------------------------------------------------------------------------
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

async function verifyAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    return { error: 'Forbidden: Admin only', code: 403 };
  }
  return { decoded };
}

// ---------------------------------------------------------------------------
// Validation map — each dynamic config key has a type + range
// ---------------------------------------------------------------------------
const DYNAMIC_CONFIG_SCHEMA = {
  routingDelayMs: { type: 'number', min: 0, max: 60000 },
  batchSizePerAccount: { type: 'number', min: 1, max: 1000 },
  maxConcurrency: { type: 'number', min: 1, max: 20 },
  queuePaused: { type: 'boolean' },
  aiPolymorphEnabled: { type: 'boolean' },
  safetyFilterEnabled: { type: 'boolean' },
};

function validateDynamicValue(key, value) {
  const schema = DYNAMIC_CONFIG_SCHEMA[key];
  if (!schema) return { valid: false, error: `Unknown config key: ${key}` };

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return { valid: false, error: `${key} must be a boolean` };
    return { valid: true, value };
  }

  if (schema.type === 'number') {
    const num = Number(value);
    if (!Number.isFinite(num)) return { valid: false, error: `${key} must be a number` };
    if (num < schema.min || num > schema.max) {
      return { valid: false, error: `${key} must be between ${schema.min} and ${schema.max}` };
    }
    return { valid: true, value: num };
  }

  return { valid: false, error: `Unsupported type for ${key}` };
}

// ---------------------------------------------------------------------------
// Resolve the effective value for a key (Redis → SystemConfig → default)
// ---------------------------------------------------------------------------
async function resolveEffectiveValue(key) {
  // Try Redis dynamic config first.
  const redisVal = await getDynamicConfig(key, null);
  if (redisVal !== null) {
    return { value: redisVal, source: 'redis' };
  }

  // Fall back to SystemConfig (Mongo).
  await connectDB();
  const cfg = await SystemConfig.findOne({}).lean() || {};

  switch (key) {
    case DYNAMIC_CONFIG_KEYS.routingDelayMs:
      return { value: (cfg.routingDelaySeconds || 3) * 1000, source: 'systemconfig' };
    case DYNAMIC_CONFIG_KEYS.batchSizePerAccount:
      return { value: cfg.batchSizePerAccount || 5, source: 'systemconfig' };
    case DYNAMIC_CONFIG_KEYS.maxConcurrency:
      return { value: 1, source: 'default' };
    case DYNAMIC_CONFIG_KEYS.queuePaused:
      return { value: false, source: 'default' };
    case DYNAMIC_CONFIG_KEYS.aiPolymorphEnabled:
      return { value: cfg.aiPolymorphEnabled !== false, source: 'systemconfig' };
    case DYNAMIC_CONFIG_KEYS.safetyFilterEnabled:
      return { value: cfg.enablePhishingFilter !== false, source: 'systemconfig' };
    default:
      return { value: null, source: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// GET handler — retrieve all dynamic config values
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const keys = Object.keys(DYNAMIC_CONFIG_KEYS);
    const config = {};
    for (const key of keys) {
      const resolved = await resolveEffectiveValue(key);
      config[key] = resolved;
    }

    return jsonResponse({
      success: true,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[gateway/dynamic GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST handler — set dynamic config values
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const body = await req.json();
    const updates = {};
    const errors = [];

    // Process each key in the body.
    for (const [key, value] of Object.entries(body)) {
      if (!(key in DYNAMIC_CONFIG_KEYS)) {
        errors.push(`Unknown config key: ${key}`);
        continue;
      }

      const validation = validateDynamicValue(key, value);
      if (!validation.valid) {
        errors.push(validation.error);
        continue;
      }

      // Store in Redis.
      await setDynamicConfig(key, validation.value);
      updates[key] = validation.value;
    }

    // Special handling: if queuePaused is being toggled, also pause/resume
    // the BullMQ queue directly.
    if ('queuePaused' in updates) {
      try {
        if (updates.queuePaused === true) {
          await pauseQueue();
        } else {
          await resumeQueue();
        }
      } catch (_e) {
        // Queue engine might not be running on serverless — non-critical.
      }
    }

    // Audit log.
    const changedKeys = Object.keys(updates);
    if (changedKeys.length > 0) {
      await logActivity(
        auth.decoded.userId || auth.decoded.id || null,
        auth.decoded.role || 'admin',
        auth.decoded.email || 'admin',
        'dynamic_config_update',
        `Updated dynamic config: ${changedKeys.join(', ')} → ${JSON.stringify(updates)}`,
        null
      ).catch(() => {});
    }

    return jsonResponse({
      success: true,
      message: errors.length > 0
        ? `Updated ${changedKeys.length} config(s) with ${errors.length} error(s)`
        : `Updated ${changedKeys.length} config(s)`,
      updates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[gateway/dynamic POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
