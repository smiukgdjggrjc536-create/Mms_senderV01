// ============================================================================
// V7 P8.2 — Cursor-aware tag insertion + keyboard navigation helpers
// ----------------------------------------------------------------------------
// PRESERVE: the existing tag-pill insertion behavior (insert a #TOKEN# into the
// subject or body field). This module HARDENS it with true cursor-position
// insertion (when the field is focused) and graceful end-append fallback (when
// it is not), so we never break the existing onInsert/onClose contract.
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch + meaningful errors,
// small modular file (8-15 KB), camelCase exports.
// ============================================================================

/**
 * Insert a tag string into a textarea/input at the actual caret position.
 * Returns { value, caret } so the caller can set the field value and restore
 * focus+selection. Falls back to end-append when the element is not focused
 * (the original behavior) — behavior-preserving hardening.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement|null} el — the target field
 * @param {string} tag — the tag string to insert (e.g. "#INVOICE#")
 * @param {string} currentValue — current field value (fallback append target)
 * @returns {{ value: string, caret: number, atCursor: boolean }}
 */
export function insertAtCaret(el, tag, currentValue = '') {
  try {
    // No element or not in the DOM → end-append fallback (preserves old behavior)
    if (!el || typeof el.selectionStart !== 'number' || document.activeElement !== el) {
      const next = (currentValue || '') + tag;
      return { value: next, caret: next.length, atCursor: false };
    }
    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? currentValue.length;
    const before = currentValue.slice(0, start);
    const after = currentValue.slice(end);
    const next = before + tag + after;
    const caret = start + tag.length;
    return { value: next, caret, atCursor: true };
  } catch (err) {
    // Hardened: never throw — fall back to end-append
    const next = (currentValue || '') + tag;
    return { value: next, caret: next.length, atCursor: false };
  }
}

/**
 * Restore caret position on an element after a value update. Uses
 * requestAnimationFrame so React has flushed the DOM change first.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement|null} el
 * @param {number} caret
 * @returns {void}
 */
export function restoreCaret(el, caret) {
  try {
    if (!el || typeof caret !== 'number') return;
    requestAnimationFrame(() => {
      try {
        el.focus();
        if (typeof el.setSelectionRange === 'function') {
          el.setSelectionRange(caret, caret);
        }
      } catch {
        /* ignore — best-effort caret restore */
      }
    });
  } catch {
    /* ignore */
  }
}

/**
 * Find the currently-focused subject or body field by a CSS selector.
 * Returns the element or null. Used so the picker can insert at the real
 * caret when the user has a field focused.
 *
 * @param {('subject'|'body')} target
 * @param {string} [campaignId]
 * @returns {HTMLInputElement|HTMLTextAreaElement|null}
 */
export function findTargetField(target, campaignId) {
  try {
    if (typeof document === 'undefined') return null;
    // Prefer the currently-focused matching field (true caret insertion).
    const active = document.activeElement;
    if (active && active.dataset && active.dataset.tagTarget === target) {
      return active;
    }
    // Otherwise look up by data attributes (data-campaign + data-tag-target).
    const sel = campaignId
      ? `[data-campaign="${CSS.escape(campaignId)}"][data-tag-target="${target}"]`
      : `[data-tag-target="${target}"]`;
    return document.querySelector(sel) || null;
  } catch {
    return null;
  }
}

/**
 * Roving-index keyboard navigation for a flat list of pill buttons.
 * Returns the next index given the current index, list length, and key.
 *
 * @param {number} current — current focused index (-1 if none)
 * @param {number} length — number of items
 * @param {string} key — the key pressed (ArrowDown/ArrowUp/ArrowRight/ArrowLeft/Home/End)
 * @param {object} [opts] — { columns } for grid layouts (default 1)
 * @returns {number} next index to focus
 */
export function nextPillIndex(current, length, key, opts = {}) {
  try {
    if (length <= 0) return -1;
    const columns = opts.columns || 1;
    const clamp = (i) => Math.max(0, Math.min(length - 1, i));
    const at = current < 0 ? -1 : current;
    switch (key) {
      case 'ArrowDown':
        return clamp(at < 0 ? 0 : at + columns);
      case 'ArrowUp':
        return clamp(at < 0 ? 0 : at - columns);
      case 'ArrowRight':
        return clamp(at < 0 ? 0 : at + 1);
      case 'ArrowLeft':
        return clamp(at <= 0 ? 0 : at - 1);
      case 'Home':
        return 0;
      case 'End':
        return length - 1;
      default:
        return at < 0 ? 0 : at;
    }
  } catch {
    return 0;
  }
}

export default { insertAtCaret, restoreCaret, findTargetField, nextPillIndex };
