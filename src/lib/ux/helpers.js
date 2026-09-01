// ============================================================================
// V7 P6.4 — UX Helpers (loading, empty, confirm, optimistic, keyboard, copy, timezone)
// ============================================================================
// Reusable utilities for premium UX behavior:
//   - Loading state helpers (skeleton, spinner states)
//   - Empty state helpers
//   - Confirm dialog helpers (safe, non-blocking)
//   - Optimistic UI helpers (apply → revert on error)
//   - Keyboard shortcut manager
//   - Copy-paste safety (sanitize clipboard, strip dangerous chars)
//   - Timezone-correct date formatting (Asia/Dhaka, ISO, relative)
//
// Exports:
//   LoadingState, EmptyState, ConfirmDialog,
//   optimisticUpdate, useOptimistic,
//   KeyboardShortcuts, registerShortcut, unregisterShortcut,
//   safePaste, sanitizeClipboard,
//   formatDate, formatDateTime, formatRelative, formatDateISO,
//   TIMEZONE
// ============================================================================

// ---------------------------------------------------------------------------
// Timezone — all dates displayed in Asia/Dhaka (Bangladesh timezone, UTC+6)
// ---------------------------------------------------------------------------

export const TIMEZONE = 'Asia/Dhaka';

/**
 * Format a date in Asia/Dhaka timezone.
 * @param {Date|string|number} date
 * @param {object} opts - Intl.DateTimeFormatOptions
 * @returns {string}
 */
export function formatDate(date, opts = {}) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: TIMEZONE,
    ...opts,
  };
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Format a date with time in Asia/Dhaka timezone.
 */
export function formatDateTime(date, opts = {}) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TIMEZONE,
    ...opts,
  };
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Format a date as ISO 8601 string (for API / sorting).
 */
export function formatDateISO(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * Format a date as relative time (e.g. "5 minutes ago", "2 hours ago").
 * Returns Bangla relative time strings.
 */
export function formatRelative(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'এইমাত্র';
  if (diffMin < 60) return `${diffMin} মিনিট আগে`;
  if (diffHour < 24) return `${diffHour} ঘন্টা আগে`;
  if (diffDay < 7) return `${diffDay} দিন আগে`;
  return formatDate(d);
}

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

export const LoadingState = {
  /**
   * Create a loading state descriptor for a component.
   * @param {string} label - what's loading (e.g. "Loading campaigns...")
   * @param {string} variant - 'spinner' | 'skeleton' | 'progress'
   * @returns {object}
   */
  create(label = 'লোড হচ্ছে...', variant = 'spinner') {
    return { loading: true, label, variant, timestamp: Date.now() };
  },

  /**
   * Check if a loading state is stale (older than maxAgeMs).
   * @param {object} state - loading state
   * @param {number} maxAgeMs - max age in milliseconds
   * @returns {boolean}
   */
  isStale(state, maxAgeMs = 30000) {
    if (!state || !state.timestamp) return true;
    return Date.now() - state.timestamp > maxAgeMs;
  },
};

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

export const EmptyState = {
  /**
   * Create an empty state descriptor.
   * @param {string} icon - emoji or icon name
   * @param {string} title - empty state title
   * @param {string} description - empty state description
   * @param {string} actionLabel - CTA button label (optional)
   * @param {function} action - CTA callback (optional)
   * @returns {object}
   */
  create(icon, title, description, actionLabel = null, action = null) {
    return { empty: true, icon, title, description, actionLabel, action };
  },

  /**
   * Check if data is empty (null, undefined, empty array, empty object).
   * @param {*} data
   * @returns {boolean}
   */
  isEmpty(data) {
    if (data == null) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    if (typeof data === 'string') return data.trim().length === 0;
    return false;
  },
};

// ---------------------------------------------------------------------------
// Confirm dialog — safe, non-blocking, promise-based
// ---------------------------------------------------------------------------

export const ConfirmDialog = {
  /**
   * Show a confirmation dialog. Returns a promise that resolves to true/false.
   * In a browser environment, uses window.confirm as a fallback.
   * In a headless/test environment, resolves to the defaultValue.
   *
   * @param {string} message - confirmation message
   * @param {object} opts - { title, defaultValue, confirmLabel, cancelLabel }
   * @returns {Promise<boolean>}
   */
  async show(message, opts = {}) {
    const title = opts.title || 'নিশ্চিত করুন';
    const defaultValue = opts.defaultValue != null ? opts.defaultValue : false;

    // Browser environment — use native confirm (simple, reliable)
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }

    // Headless / test environment — return default
    return defaultValue;
  },

  /**
   * Wrap an async action with a confirmation dialog.
   * Only executes the action if the user confirms.
   * @param {string} message
   * @param {function} action - async function to run if confirmed
   * @param {object} opts
   * @returns {Promise<*>} result of action, or null if cancelled
   */
  async confirmAndRun(message, action, opts = {}) {
    const confirmed = await ConfirmDialog.show(message, opts);
    if (!confirmed) return null;
    return action();
  },
};

// ---------------------------------------------------------------------------
// Optimistic UI — apply update immediately, revert on error
// ---------------------------------------------------------------------------

/**
 * Perform an optimistic update: apply the update to local state immediately,
 * then call the async action. If the action fails, revert to the previous state.
 *
 * @param {function} applyFn - sync function that applies the optimistic update
 * @param {function} actionFn - async function that performs the real action
 * @param {function} revertFn - sync function that reverts on error (optional)
 * @returns {Promise<{ ok, result, error, reverted }>}
 */
export async function optimisticUpdate(applyFn, actionFn, revertFn = null) {
  // Apply optimistic update immediately
  if (typeof applyFn === 'function') applyFn();

  try {
    const result = await actionFn();
    return { ok: true, result, error: null, reverted: false };
  } catch (err) {
    // Revert on error
    if (typeof revertFn === 'function') revertFn();
    return { ok: false, result: null, error: err, reverted: true };
  }
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts — global registry
// ---------------------------------------------------------------------------

const _shortcuts = new Map();

/**
 * Register a keyboard shortcut.
 * @param {string} combo - e.g. 'ctrl+s', 'ctrl+k', 'esc'
 * @param {function} handler - called when shortcut is pressed
 * @param {object} opts - { description, preventDefault }
 * @returns {function} unregister function
 */
export function registerShortcut(combo, handler, opts = {}) {
  const key = combo.toLowerCase().trim();
  _shortcuts.set(key, { handler, description: opts.description || '', preventDefault: opts.preventDefault !== false });

  // Register global listener (only in browser)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const listener = (e) => {
      const parts = key.split('+');
      const hasCtrl = parts.includes('ctrl') || parts.includes('cmd') || parts.includes('meta');
      const hasShift = parts.includes('shift');
      const hasAlt = parts.includes('alt');
      const mainKey = parts[parts.length - 1];

      const ctrlMatch = hasCtrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
      const shiftMatch = hasShift ? e.shiftKey : !e.shiftKey;
      const altMatch = hasAlt ? e.altKey : !e.altKey;
      const keyMatch = e.key.toLowerCase() === mainKey;

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        const entry = _shortcuts.get(key);
        if (entry) {
          if (entry.preventDefault) e.preventDefault();
          entry.handler(e);
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      _shortcuts.delete(key);
      document.removeEventListener('keydown', listener);
    };
  }

  return () => { _shortcuts.delete(key); };
}

/**
 * Unregister a keyboard shortcut.
 */
export function unregisterShortcut(combo) {
  _shortcuts.delete(combo.toLowerCase().trim());
}

/**
 * List all registered shortcuts (for help/discovery UI).
 */
export function listShortcuts() {
  return Array.from(_shortcuts.entries()).map(([combo, entry]) => ({
    combo,
    description: entry.description,
  }));
}

export const KeyboardShortcuts = { register: registerShortcut, unregister: unregisterShortcut, list: listShortcuts };

// ---------------------------------------------------------------------------
// Copy-paste safety — sanitize clipboard content
// ---------------------------------------------------------------------------

/**
 * Sanitize pasted text: strip control characters, normalize line endings,
 * remove null bytes, limit length, trim.
 *
 * @param {string} text - raw clipboard text
 * @param {object} opts - { maxLength, allowNewlines, stripHtml }
 * @returns {string} sanitized text
 */
export function sanitizeClipboard(text, opts = {}) {
  if (!text || typeof text !== 'string') return '';
  const maxLength = opts.maxLength || 1000000;
  const allowNewlines = opts.allowNewlines !== false;
  const stripHtml = opts.stripHtml || false;

  let cleaned = text;

  // Strip null bytes and control characters (except tab/newline)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip HTML tags if requested
  if (stripHtml) {
    cleaned = cleaned.replace(/<[^>]*>/g, '');
  }

  // Normalize line endings
  if (allowNewlines) {
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  } else {
    cleaned = cleaned.replace(/[\r\n]+/g, ' ');
  }

  // Collapse multiple spaces (but preserve newlines)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned.trim();
}

/**
 * Safe paste handler — extracts and sanitizes text from a clipboard event.
 * Works in browser (ClipboardEvent) and returns sanitized string.
 *
 * @param {ClipboardEvent|string} eventOrText
 * @param {object} opts
 * @returns {string} sanitized text
 */
export function safePaste(eventOrText, opts = {}) {
  let raw = '';
  if (typeof eventOrText === 'string') {
    raw = eventOrText;
  } else if (eventOrText && eventOrText.clipboardData) {
    raw = eventOrText.clipboardData.getData('text/plain') || '';
  } else if (eventOrText && typeof eventOrText === 'object') {
    raw = String(eventOrText);
  }
  return sanitizeClipboard(raw, opts);
}

/**
 * Parse pasted emails — split by newline/comma/semicolon, dedup, sanitize each.
 *
 * @param {string} text
 * @returns {string[]} array of cleaned email strings
 */
export function parsePastedEmails(text) {
  const sanitized = sanitizeClipboard(text, { allowNewlines: true });
  if (!sanitized) return [];
  const parts = sanitized.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(p);
    }
  }
  return result;
}

export default {
  TIMEZONE,
  formatDate,
  formatDateTime,
  formatDateISO,
  formatRelative,
  LoadingState,
  EmptyState,
  ConfirmDialog,
  optimisticUpdate,
  KeyboardShortcuts,
  registerShortcut,
  unregisterShortcut,
  listShortcuts,
  sanitizeClipboard,
  safePaste,
  parsePastedEmails,
};
