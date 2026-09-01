// ============================================================================
// V7 P8.4 — PageTransition: fade+slide transition wrapper + staggered list
// ----------------------------------------------------------------------------
// Provides smooth transitions between tabs / views and staggered entrance
// animations for lists, so the UI feels alive without jank.
//
// Components:
//   • PageTransition    — wraps a view; fades+slides in on mount/key change
//   • StaggerList       — wraps a list; cascades children entrance
//   • StaggerItem       — single staggered child (used inside StaggerList)
//
// All animations use the .v7-stagger / .animate-* classes from globals.css,
// which are blanket-disabled under prefers-reduced-motion.
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular file.
// ============================================================================

import { Children, cloneElement, useEffect, useState } from 'react';
import { cx } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// PageTransition — fade + slide-up on mount or when `transitionKey` changes
// ---------------------------------------------------------------------------

/**
 * @param {object}   props
 * @param {*}        props.transitionKey  — when this changes, re-trigger animation
 * @param {node}     props.children
 * @param {string}   [props.className]
 * @param {number}   [props.duration=300] — ms (informational; CSS drives timing)
 */
export function PageTransition({ transitionKey, children, className = '', duration = 300 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    // next frame → trigger enter animation
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [transitionKey]);

  return (
    <div
      key={transitionKey}
      className={cx(
        'transition-opacity',
        visible ? 'opacity-100 animate-[fadeIn_0.3s_ease-out]' : 'opacity-0',
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaggerList — cascades children entrance with incremental delay
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {node}   props.children    — list of elements
 * @param {number} [props.delay=50]  — ms between each child
 * @param {number} [props.start=0]   — starting delay ms
 * @param {string} [props.className]
 */
export function StaggerList({ children, delay = 50, start = 0, className = '' }) {
  const items = Children.toArray(children);
  return (
    <div className={cx(className)}>
      {items.map((child, i) => (
        <div
          key={child.key ?? i}
          className="v7-stagger"
          style={{ animationDelay: `${start + i * delay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaggerItem — single staggered item (alternative to StaggerList wrapper)
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} [props.index=0]   — position in list
 * @param {number} [props.delay=50]  — ms per step
 * @param {number} [props.start=0]   — starting delay ms
 * @param {node}   props.children
 * @param {string} [props.className]
 */
export function StaggerItem({ index = 0, delay = 50, start = 0, children, className = '' }) {
  return (
    <div className={cx('v7-stagger', className)} style={{ animationDelay: `${start + index * delay}ms` }}>
      {children}
    </div>
  );
}

export default { PageTransition, StaggerList, StaggerItem };
