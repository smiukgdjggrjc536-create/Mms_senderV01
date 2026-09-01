// ============================================================================
// V7 P8.4 — Toast: hardened auto-dismiss toast stack with exit animation
// ----------------------------------------------------------------------------
// Replaces the inline single-toast in UserPanel with a proper stack that:
//   • supports success / error / warning / info
//   • auto-dismisses (configurable, default 4s; errors stay 6s)
//   • stacks multiple toasts (max 5, oldest evicted)
//   • exit animation (slideUp) — respects prefers-reduced-motion
//   • manual dismiss (click)
//   • ARIA live region (assertive for error, polite otherwise)
//   • glassmorphic styling matching the V7 design system
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular file,
// camelCase, crypto-only (no randomness needed).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, Z } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_VISIBLE = 5;
const DEFAULT_MS = 4000;
const ERROR_MS = 6000;
const TYPES = {
  success: { icon: 'CheckCircle', cls: 'bg-emerald-600/90 border-emerald-400/30', aria: 'polite' },
  error:   { icon: 'XCircle',     cls: 'bg-red-600/90 border-red-400/30',         aria: 'assertive' },
  warning: { icon: 'Alert',       cls: 'bg-amber-600/90 border-amber-400/30',     aria: 'assertive' },
  info:    { icon: 'Info',        cls: 'bg-indigo-600/90 border-indigo-400/30',   aria: 'polite' },
};

let _idCounter = 0;
const nextId = () => `toast-${Date.now()}-${_idCounter++}`;

// ---------------------------------------------------------------------------
// Hook: useToastStack
// Returns { toasts, show, dismiss }.
//   show(msg, type='info', ms?)  → pushes a toast
//   dismiss(id)                  → removes a toast
// ---------------------------------------------------------------------------

export function useToastStack() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    try {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      const tm = timers.current.get(id);
      if (tm) { clearTimeout(tm); timers.current.delete(id); }
    } catch { /* ignore */ }
  }, []);

  const show = useCallback((msg, type = 'info', ms) => {
    try {
      const id = nextId();
      const duration = ms ?? (type === 'error' || type === 'warning' ? ERROR_MS : DEFAULT_MS);
      setToasts((prev) => {
        const next = [...prev, { id, msg, type, duration }];
        // evict oldest if over cap
        while (next.length > MAX_VISIBLE) next.shift();
        return next;
      });
      const tm = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, tm);
      return id;
    } catch { return null; }
  }, [dismiss]);

  // cleanup all timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => {
      try { map.forEach((tm) => clearTimeout(tm)); map.clear(); } catch { /* ignore */ }
    };
  }, []);

  return { toasts, show, dismiss };
}

// ---------------------------------------------------------------------------
// Component: ToastStack
// Renders the stack of toasts.  Place once near the root.
//
// @param {object}   props
// @param {array}    props.toasts   — [{ id, msg, type, duration }]
// @param {function} props.dismiss  — (id) => void
// ---------------------------------------------------------------------------

export default function ToastStack({ toasts = [], dismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
      style={{ zIndex: Z.toast }}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const cfg = TYPES[t.type] || TYPES.info;
        const Ic = Icon[cfg.icon] || Icon.Info;
        return (
          <div
            key={t.id}
            role="status"
            aria-live={cfg.aria}
            onClick={() => dismiss && dismiss(t.id)}
            className={cx(
              'pointer-events-auto cursor-pointer',
              'px-5 py-3 rounded-xl shadow-2xl text-sm font-medium',
              'flex items-center gap-2.5 backdrop-blur-xl border',
              'animate-[slideDown_0.3s_ease-out]',
              cfg.cls,
              'text-white'
            )}
            title="Click to dismiss"
          >
            <Ic className="w-5 h-5 shrink-0" />
            <span className="max-w-[80vw] sm:max-w-md">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
