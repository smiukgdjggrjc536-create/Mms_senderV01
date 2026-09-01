// ============================================================================
// V7 P9.2 — LivingDashboard: real-time animated counters + live pulse
// ----------------------------------------------------------------------------
// Turns the static dashboard numbers into "living" counters that:
//   • animate (count-up) when values change — smooth, not jarring
//   • show a live pulse indicator ("LIVE") while polling
//   • poll on a configurable interval (default 10s for active dashboard)
//   • respect prefers-reduced-motion (instant update, no animation)
//
// This is a USER-PANEL component (not admin). It polls /api/system with
// action=getUserDashboard — the same endpoint the existing dashboard uses,
// so no new API surface is required and the existing auth/contract is
// preserved.
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular file.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { cx, ACCENT, motionSafe } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';

// ---------------------------------------------------------------------------
// useCountUp — animate a number from prev → next over `duration` ms
// Returns the current animated value.  Respects prefers-reduced-motion.
// ---------------------------------------------------------------------------

export function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    // Skip animation if reduced motion or no change
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || target === display) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    fromRef.current = display;
    startRef.current = 0;
    const from = fromRef.current;
    const delta = target - from;

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic for natural deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

// ---------------------------------------------------------------------------
// LiveCounter — a single animated stat with label + optional icon + accent
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} props.value
 * @param {string} props.label
 * @param {string} [props.icon]    — Icon key
 * @param {string} [props.accent]  — 'cyan'|'violet'|'emerald'|'amber'|'rose'
 * @param {string} [props.suffix]  — e.g. '%', 'ms'
 * @param {number} [props.duration] — animation ms
 */
export function LiveCounter({ value = 0, label, icon, accent = 'cyan', suffix = '', duration = 600 }) {
  const animated = useCountUp(value, duration);
  const Ic = icon ? (Icon[icon] || Icon.Activity) : null;
  const colorMap = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 v7-stagger">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</span>
        {Ic && <Ic className={cx('w-3.5 h-3.5', colorMap[accent] || colorMap.cyan)} />}
      </div>
      <div className={cx('text-2xl font-bold tabular-nums', colorMap[accent] || colorMap.cyan)}>
        {animated.toLocaleString()}{suffix}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LivePulse — the "LIVE" indicator with pulsing dot
// ---------------------------------------------------------------------------

export function LivePulse({ active = true, label = 'LIVE' }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
      <span
        className={cx(
          'w-1.5 h-1.5 rounded-full',
          active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
        )}
      />
      <span className={active ? 'text-emerald-400' : 'text-gray-500'}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useLivePoll — poll an async fn on an interval, return { data, loading, error }
// ---------------------------------------------------------------------------

/**
 * @param {function} fetcher  — async () => data
 * @param {number}   intervalMs — default 10000
 * @param {boolean}  enabled  — default true
 * @returns {{ data, loading, error, refresh }}
 */
export function useLivePoll(fetcher, intervalMs = 10000, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err?.message || 'Polling error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs, enabled]);

  return { data, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// LivingDashboard — grid of LiveCounters with live pulse header
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {object} props.stats  — { sent, limit, todaySent, todayDelivered, ... }
 * @param {function} [props.onRefresh] — manual refresh trigger
 * @param {boolean} [props.live] — show LIVE pulse
 */
export default function LivingDashboard({ stats, onRefresh, live = true }) {
  const sent = stats?.sent || 0;
  const limit = stats?.limit || 0;
  const remaining = Math.max(limit - sent, 0);
  const todaySent = stats?.todaySent || 0;
  const todayDelivered = stats?.todayDelivered || 0;
  const deliveryRate = todaySent > 0 ? Math.round((todayDelivered / todaySent) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
          <Icon.Activity className="w-3.5 h-3.5 text-emerald-400" /> Live Overview
        </p>
        <div className="flex items-center gap-3">
          {live && <LivePulse active={!stats?._stale} />}
          {onRefresh && (
            <button onClick={onRefresh} className="text-gray-500 hover:text-gray-300 transition" title="Refresh">
              <Icon.Refresh className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <LiveCounter value={sent} label="Total Sent" icon="Send" accent="blue" />
        <LiveCounter value={remaining} label="Remaining" icon="FuelGauge" accent="emerald" />
        <LiveCounter value={todaySent} label="Today Sent" icon="TrendUp" accent="cyan" />
        <LiveCounter value={deliveryRate} label="Delivery Rate" icon="CheckCircle" accent="violet" suffix="%" />
      </div>
    </div>
  );
}
