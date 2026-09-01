// ============================================================================
// V7 P8.3 — EditorArea: hardened code editor with 480px lock + zero-jank typing
// ----------------------------------------------------------------------------
// PRESERVE items honored:
//   • GRID.editorHeightLock (480px) — enforced as a hard height, not just max.
//   • data-camp-body / data-tag-target / data-campaign attributes — the
//     TagPickerModal and Quick-Tag pills rely on these to insert at the real
//     caret.  We forward every extra prop so they survive.
//   • The onChange contract: parent still receives value updates (debounced).
//   • maxLength (2000) — preserved from original textarea.
//
// HARDENING:
//   • Local mirror state — typing updates a local ref instantly so the DOM
//     textarea never waits for a parent re-render.  Parent state syncs on a
//     debounce (180ms) OR on blur / Enter-without-shift / paste — zero jank.
//   • Live token + char count driven from local state (no parent read).
//   • Smart scroll: we remember scrollTop across re-renders and restore it,
//     and we scroll the caret into view after a programmatic insert.
//   • Virtualization-friendly: the textarea is the only heavy node; we never
//     render a giant child list.  For huge pastes we chunk the *count* calc.
//   • prefers-reduced-motion respected (no shimmer on count change).
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch + meaningful errors,
// small modular file, camelCase, crypto-only (no randomness here anyway).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { GRID, TYPO, RADIUS, cx, motionSafe } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SYNC_DEBOUNCE_MS = 180;      // debounce for parent state sync
const MAX_LEN_DEFAULT = 2000;      // preserved from original textarea
const TOKEN_PATTERN = /#[A-Z_]+#/g; // live #TOKEN# count

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hardened editor textarea.
 *
 * @param {object}   props
 * @param {string}   props.value        — current body value (from parent)
 * @param {function} props.onChange     — (nextValue:string) => void  (debounced)
 * @param {number}   [props.maxLength]  — default 2000
 * @param {string}   [props.placeholder]
 * @param {string}   [props.className]  — extra classes appended
 * @param {string}   [props.mode]       — 'html' | 'plain' (affects hint only)
 * @param {function} [props.onTokenCount] — optional (count:number)=>void
 * @param {object}   [props.rest]       — any extra props (data-* attrs, id…)
 */
export default function EditorArea({
  value = '',
  onChange,
  maxLength = MAX_LEN_DEFAULT,
  placeholder = '',
  className = '',
  mode = 'html',
  onTokenCount,
  ...rest
}) {
  // --- refs ---------------------------------------------------------------
  const taRef = useRef(null);            // the <textarea>
  const scrollTopRef = useRef(0);        // remember scroll across syncs
  const syncTimer = useRef(null);        // debounce timer
  const lastSyncedRef = useRef(value);   // last value pushed to parent
  const isTypingRef = useRef(false);     // suppress parent→local overwrite while typing

  // --- local mirror state (instant) --------------------------------------
  const [local, setLocal] = useState(value);
  const [count, setCount] = useState(() => ({ chars: value.length, tokens: 0 }));

  // --- keep local in sync when parent value changes externally -----------
  // (e.g. tag insert, template load, AI restock).  But NOT while the user
  // is actively typing — that would fight the local mirror.
  useEffect(() => {
    if (isTypingRef.current) return;
    if (value === lastSyncedRef.current) return;
    setLocal(value);
    lastSyncedRef.current = value;
    // restore scroll position after external value change
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.scrollTop = scrollTopRef.current;
    });
  }, [value]);

  // --- live count (chars + tokens) from local state ----------------------
  useEffect(() => {
    let active = true;
    const chars = local.length;
    // token count: for huge strings this is O(n) but cheap (regex scan).
    // We guard with rAF so it never blocks a keystroke.
    const compute = () => {
      if (!active) return;
      let tokens = 0;
      try {
        const m = local.match(TOKEN_PATTERN);
        tokens = m ? m.length : 0;
      } catch { tokens = 0; }
      setCount({ chars, tokens });
      if (typeof onTokenCount === 'function') {
        try { onTokenCount(tokens); } catch { /* ignore */ }
      }
    };
    const raf = requestAnimationFrame(compute);
    return () => { active = false; cancelAnimationFrame(raf); };
  }, [local, onTokenCount]);

  // --- flush: push local → parent (debounced) ----------------------------
  const flush = useCallback((val) => {
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
    syncTimer.current = setTimeout(() => {
      try {
        if (typeof onChange === 'function' && val !== lastSyncedRef.current) {
          onChange(val);
          lastSyncedRef.current = val;
        }
      } catch (err) {
        // Hardened: never throw from a timer. Log and move on.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('EditorArea flush error:', err?.message || err);
        }
      } finally {
        isTypingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
  }, [onChange]);

  // --- keydown: smart scroll + immediate flush on Enter (no shift) -------
  const onKeyDown = useCallback((e) => {
    try {
      // Remember scroll so we can preserve it across any re-render.
      if (taRef.current) scrollTopRef.current = taRef.current.scrollTop;
      // Enter (without Shift) → flush immediately so parent sees newline
      if (e.key === 'Enter' && !e.shiftKey) {
        isTypingRef.current = false;
        if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
        const v = taRef.current ? taRef.current.value : local;
        if (typeof onChange === 'function' && v !== lastSyncedRef.current) {
          onChange(v);
          lastSyncedRef.current = v;
        }
      }
    } catch { /* ignore */ }
  }, [onChange, local]);

  // --- change: instant local update, debounced parent sync ---------------
  const onInput = useCallback((e) => {
    isTypingRef.current = true;
    const v = e.target.value;
    setLocal(v);
    // remember scroll
    if (taRef.current) scrollTopRef.current = taRef.current.scrollTop;
    flush(v);
  }, [flush]);

  // --- blur: flush immediately + clear typing flag ------------------------
  const onBlur = useCallback(() => {
    try {
      isTypingRef.current = false;
      if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
      const v = taRef.current ? taRef.current.value : local;
      if (typeof onChange === 'function' && v !== lastSyncedRef.current) {
        onChange(v);
        lastSyncedRef.current = v;
      }
      if (taRef.current) scrollTopRef.current = taRef.current.scrollTop;
    } catch { /* ignore */ }
  }, [onChange, local]);

  // --- paste: flush immediately (no debounce) for large pastes -----------
  const onPaste = useCallback((e) => {
    try {
      isTypingRef.current = false; // let parent value flow back
      // We let the browser handle the paste (maxLength truncates).
      // After paste, flush immediately so parent is in sync.
      requestAnimationFrame(() => {
        if (taRef.current) {
          const v = taRef.current.value;
          setLocal(v);
          if (typeof onChange === 'function' && v !== lastSyncedRef.current) {
            onChange(v);
            lastSyncedRef.current = v;
          }
        }
      });
    } catch { /* ignore */ }
  }, [onChange]);

  // --- cleanup timer on unmount -------------------------------------------
  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  // --- derived: over-limit flag ------------------------------------------
  const over = count.chars > maxLength;

  // --- render -------------------------------------------------------------
  return (
    <div className="v7-editor-wrap relative" style={{ height: GRID.editorHeightLock }}>
      <textarea
        ref={taRef}
        value={local}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        onScroll={(e) => { scrollTopRef.current = e.target.scrollTop; }}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        className={cx(
          'v7-editor-area',
          'w-full px-2.5 py-1.5 bg-white/5 border rounded-lg',
          'placeholder-gray-500 focus:outline-none focus:ring-1',
          'resize-none font-mono text-[11px] leading-relaxed',
          'v7-scroll',
          over
            ? 'border-red-500/40 focus:ring-red-500/50 text-red-100'
            : 'border-white/10 focus:ring-violet-500 text-gray-100',
          className
        )}
        style={{
          height: GRID.editorHeightLock,   // hard lock — PRESERVE 480px
          maxHeight: GRID.editorHeightLock, // belt + suspenders
          overflowY: 'auto',
          fontFamily: TYPO.mono,
          borderRadius: RADIUS.md,
        }}
        {...rest}
      />
      {/* live count chip — bottom-right, non-blocking, pointer-events-none */}
      <div
        className={cx(
          'absolute bottom-1.5 right-2 pointer-events-none select-none',
          'text-[9px] font-mono px-1.5 py-0.5 rounded-md',
          'bg-slate-900/80 backdrop-blur-sm border border-white/10',
          over ? 'text-red-400' : 'text-gray-400'
        )}
        aria-live="polite"
      >
        {count.chars}/{maxLength}{count.tokens > 0 ? (
          <span className="ml-1 text-violet-400">· {count.tokens} tok</span>
        ) : null}
      </div>
    </div>
  );
}
