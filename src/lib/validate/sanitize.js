// ============================================================================
// P1.5 — Input Sanitization & Validation (zod-free)
// ============================================================================
// Validates and sanitizes every API input BEFORE processing:
//   • Email lists, campaign configs, admin toggles, credential payloads.
//   • Strips $-prefixed keys (NoSQL injection protection).
//   • Type-checks required fields with explicit shape validation.
//   • Returns { valid, data, errors } — never throws.
//
// This module is zod-FREE (per script style law — no new deps unless
// required). All validation is explicit shape checking.
//
// USAGE:
//   import { sanitizeInput, stripDollarKeys, validateEmailList,
//            validateCampaignConfig, validateAdminToggle } from
//            '@/lib/validate/sanitize';
//   const { valid, data, errors } = sanitizeInput(body, {
//     emailList: 'string',
//     message: 'string',
//     batchSize: 'number',
//   });
// ============================================================================

// ---------------------------------------------------------------------------
// Strip all keys that start with $ (NoSQL injection protection).
// Recursively walks objects and arrays. Returns a clean deep clone.
// ---------------------------------------------------------------------------
export function stripDollarKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => stripDollarKeys(item));
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip $-prefixed keys (MongoDB operators — never user-supplied)
    if (key.startsWith('$')) continue;
    // Skip keys with dots (MongoDB path injection)
    if (key.includes('.')) continue;
    clean[key] = stripDollarKeys(value);
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Type validators
// ---------------------------------------------------------------------------
const _isString = (v) => typeof v === 'string';
const _isNumber = (v) => typeof v === 'number' && !isNaN(v) && isFinite(v);
const _isBoolean = (v) => typeof v === 'boolean';
const _isArray = (v) => Array.isArray(v);
const _isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const _isEmail = (v) => _isString(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const _isPhone = (v) => _isString(v) && /^\+?[\d\s\-\(\)]{7,20}$/.test(v);
const _isUrl = (v) => {
  if (!_isString(v)) return false;
  try { new URL(v); return true; } catch { return false; }
};

// ---------------------------------------------------------------------------
// Sanitize a generic input object against a schema spec.
// schema = { fieldName: 'type' | { type, required, min, max, enum } }
// Returns { valid, data, errors }
// ---------------------------------------------------------------------------
export function sanitizeInput(rawInput, schema) {
  const errors = [];
  if (!_isObject(rawInput)) {
    return { valid: false, data: {}, errors: ['Input must be an object'] };
  }

  // Step 1: strip $-keys (NoSQL injection protection)
  const stripped = stripDollarKeys(rawInput);
  const data = {};

  // Step 2: validate each field in the schema
  for (const [field, spec] of Object.entries(schema)) {
    const type = typeof spec === 'string' ? spec : spec.type;
    const required = typeof spec === 'object' ? spec.required : false;
    const value = stripped[field];

    // Check required
    if (value === undefined || value === null || value === '') {
      if (required) {
        errors.push(`Field "${field}" is required`);
      }
      continue;
    }

    // Type check
    let valid = true;
    let coerced = value;

    switch (type) {
      case 'string':
        if (!_isString(value)) {
          valid = false;
          errors.push(`Field "${field}" must be a string`);
        } else if (spec.min && value.length < spec.min) {
          valid = false;
          errors.push(`Field "${field}" must be at least ${spec.min} characters`);
        } else if (spec.max && value.length > spec.max) {
          valid = false;
          errors.push(`Field "${field}" must be at most ${spec.max} characters`);
        }
        break;
      case 'number':
        if (!_isNumber(value)) {
          // Try to coerce string→number
          const num = Number(value);
          if (!isNaN(num) && isFinite(num)) {
            coerced = num;
          } else {
            valid = false;
            errors.push(`Field "${field}" must be a number`);
          }
        } else if (spec.min !== undefined && coerced < spec.min) {
          valid = false;
          errors.push(`Field "${field}" must be >= ${spec.min}`);
        } else if (spec.max !== undefined && coerced > spec.max) {
          valid = false;
          errors.push(`Field "${field}" must be <= ${spec.max}`);
        }
        break;
      case 'boolean':
        if (!_isBoolean(value)) {
          valid = false;
          errors.push(`Field "${field}" must be a boolean`);
        }
        break;
      case 'array':
        if (!_isArray(value)) {
          valid = false;
          errors.push(`Field "${field}" must be an array`);
        } else if (spec.maxItems && value.length > spec.maxItems) {
          valid = false;
          errors.push(`Field "${field}" must have at most ${spec.maxItems} items`);
        }
        break;
      case 'object':
        if (!_isObject(value)) {
          valid = false;
          errors.push(`Field "${field}" must be an object`);
        }
        break;
      case 'email':
        if (!_isEmail(value)) {
          valid = false;
          errors.push(`Field "${field}" must be a valid email address`);
        }
        break;
      case 'phone':
        if (!_isPhone(value)) {
          valid = false;
          errors.push(`Field "${field}" must be a valid phone number`);
        }
        break;
      case 'url':
        if (!_isUrl(value)) {
          valid = false;
          errors.push(`Field "${field}" must be a valid URL`);
        }
        break;
      case 'enum':
        if (!spec.values || !spec.values.includes(value)) {
          valid = false;
          errors.push(`Field "${field}" must be one of: ${(spec.values || []).join(', ')}`);
        }
        break;
      default:
        // Unknown type — allow but warn
        valid = false;
        errors.push(`Unknown type "${type}" for field "${field}"`);
    }

    if (valid) {
      data[field] = coerced;
    }
  }

  // Step 3: check for unexpected $-keys that were stripped (flag as error in strict mode)
  const rawKeys = Object.keys(rawInput);
  const strippedKeys = Object.keys(stripped);
  const dollarKeys = rawKeys.filter((k) => k.startsWith('$') || k.includes('.'));
  if (dollarKeys.length > 0) {
    errors.push(`Blocked NoSQL injection keys: ${dollarKeys.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
    strippedDollarKeys: dollarKeys,
  };
}

// ---------------------------------------------------------------------------
// Specialized validators for common API inputs
// ---------------------------------------------------------------------------

// Validate an email list (array of strings or newline/comma separated string)
export function validateEmailList(input) {
  let emails = [];
  if (_isArray(input)) {
    emails = input;
  } else if (_isString(input)) {
    emails = input.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  } else {
    return { valid: false, data: [], errors: ['Email list must be an array or string'] };
  }

  const errors = [];
  const valid = [];
  for (let i = 0; i < emails.length; i++) {
    const email = String(emails[i]).trim();
    if (!email) continue;
    // Block NoSQL injection — only block $-prefixed entries, not normal dots
    if (email.startsWith('$')) {
      errors.push(`Entry ${i + 1}: blocked potential injection ($-prefixed)`);
      continue;
    }
    if (_isEmail(email)) {
      valid.push(email);
    } else {
      errors.push(`Entry ${i + 1}: invalid email "${email}"`);
    }
  }

  return {
    valid: valid.length > 0,
    data: valid,
    errors,
  };
}

// Validate campaign config
export function validateCampaignConfig(input) {
  return sanitizeInput(input, {
    name: { type: 'string', required: true, min: 1, max: 200 },
    message: { type: 'string', required: false, max: 5000 },
    batchSize: { type: 'number', required: false, min: 1, max: 1000 },
    delayMs: { type: 'number', required: false, min: 0, max: 3600000 },
    senderId: { type: 'string', required: false, max: 100 },
    provider: { type: 'enum', required: false, values: ['twilio', 'vonage', 'messagebird', 'custom', 'email_mms'] },
  });
}

// Validate admin toggle (boolean on/off)
export function validateAdminToggle(input) {
  return sanitizeInput(input, {
    enabled: { type: 'boolean', required: true },
    feature: { type: 'string', required: true, max: 100 },
  });
}

// Validate credential payload
export function validateCredentialPayload(input) {
  return sanitizeInput(input, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6, max: 200 },
    provider: { type: 'enum', required: true, values: ['gmail', 'outlook', 'smtp', 'custom'] },
    label: { type: 'string', required: false, max: 100 },
    dailyLimit: { type: 'number', required: false, min: 1, max: 100000 },
  });
}

// ---------------------------------------------------------------------------
// Test helper — exports for the acceptance test
// ---------------------------------------------------------------------------
export function _testNoSqlInjection() {
  const malicious = {
    email: 'test@example.com',
    $where: 'this.password == "admin"',
    '$gt': '',
    'user.name': 'injected',
    password: 'valid123',
  };
  const result = sanitizeInput(malicious, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6 },
  });
  return {
    blocked: result.strippedDollarKeys.length > 0,
    noDollarKeysInData: !Object.keys(result.data).some((k) => k.startsWith('$') || k.includes('.')),
    result,
  };
}

export default {
  stripDollarKeys,
  sanitizeInput,
  validateEmailList,
  validateCampaignConfig,
  validateAdminToggle,
  validateCredentialPayload,
  _testNoSqlInjection,
};
