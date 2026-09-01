// ============================================================================
// V7 P8.4 — Skeleton: shimmer skeleton loaders for premium loading UX
// ----------------------------------------------------------------------------
// Replaces spinner-only loading with content-shaped skeletons that match the
// real layout, so the user perceives instant structure (CLS = 0).
//
// Components:
//   • Skeleton           — base bar (configurable w/h/radius)
//   • SkeletonText       — multi-line text block (lines prop)
//   • SkeletonCard       — card-shaped skeleton (avatar + title + lines)
//   • SkeletonList       — n rows of SkeletonCard (staggered shimmer)
//   • SkeletonStatGrid   — stat-card grid skeleton (for dashboards)
//
// All use the .v7-skeleton shimmer class from globals.css, which is disabled
// under prefers-reduced-motion (static gray fallback).
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular file.
// ============================================================================

import { cx, RADIUS } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// Skeleton — base shimmer bar
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {string|number} [props.width='100%']
 * @param {string|number} [props.height='1em']
 * @param {string} [props.radius]   — border-radius token (RADIUS key) or CSS
 * @param {string} [props.className]
 */
export function Skeleton({ width = '100%', height = '1em', radius = 'md', className = '' }) {
  const r = (typeof radius === 'string' && RADIUS[radius]) ? RADIUS[radius] : radius;
  return (
    <div
      className={cx('v7-skeleton bg-white/10', className)}
      style={{ width, height, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// SkeletonText — multi-line text block
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} [props.lines=3]
 * @param {string} [props.className]
 */
export function SkeletonText({ lines = 3, className = '' }) {
  const arr = Array.from({ length: lines }, (_, i) => i);
  return (
    <div className={cx('flex flex-col gap-1.5', className)} aria-hidden="true">
      {arr.map((i) => (
        <Skeleton
          key={i}
          height="0.8em"
          width={i === arr.length - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard — card with avatar + title + lines
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {boolean} [props.avatar=true]
 * @param {number}  [props.lines=2]
 * @param {string}  [props.className]
 */
export function SkeletonCard({ avatar = true, lines = 2, className = '' }) {
  return (
    <div className={cx('flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5', className)} aria-hidden="true">
      {avatar && <Skeleton width={36} height={36} radius="full" />}
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton height="0.9em" width="40%" />
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonList — n staggered skeleton cards
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} [props.count=5]
 * @param {string} [props.className]
 */
export function SkeletonList({ count = 5, className = '' }) {
  const arr = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={cx('flex flex-col gap-2', className)} aria-hidden="true" role="status" aria-label="Loading">
      {arr.map((i) => (
        <div key={i} className="v7-stagger" style={{ animationDelay: `${i * 60}ms` }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonStatGrid — dashboard stat-card grid skeleton
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} [props.cols=4]
 * @param {string} [props.className]
 */
export function SkeletonStatGrid({ cols = 4, className = '' }) {
  const arr = Array.from({ length: cols }, (_, i) => i);
  return (
    <div
      className={cx('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-hidden="true"
      role="status"
      aria-label="Loading stats"
    >
      {arr.map((i) => (
        <div key={i} className="v7-stagger p-3 rounded-xl bg-white/[0.02] border border-white/5" style={{ animationDelay: `${i * 80}ms` }}>
          <Skeleton height="0.7em" width="50%" />
          <div style={{ height: 6 }} />
          <Skeleton height="1.6em" width="70%" />
        </div>
      ))}
    </div>
  );
}

export default { Skeleton, SkeletonText, SkeletonCard, SkeletonList, SkeletonStatGrid };
