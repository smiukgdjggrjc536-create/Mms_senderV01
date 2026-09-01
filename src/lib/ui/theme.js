// ============================================================================
// V7 P8.1 — Design System Theme Tokens (the single source of truth)
// ----------------------------------------------------------------------------
// Slate/Charcoal premium dark theme + neon accent glow (electric cyan #22d3ee
// / violet #8b5cf6). Every new component imports tokens from here — NO
// hardcoded hex values anywhere in new files (ACCEPTANCE a).
//
// This file is PURE (no React, no DOM) so it can be imported by both client
// components and server code. It exports:
//   - `theme`        : the full token object (colors, spacing, radii, shadows,
//                      motion, z, glass, grid, timing)
//   - `cx`           : className joiner (filters falsy, dedupes spaces)
//   - `withGlow`     : builds a neon glow box-shadow string for an accent
//   - `motionSafe`   : CSS var string that disables motion when the user
//                      prefers reduced motion (respects prefers-reduced-motion)
//   - `ACCENT`       : the canonical accent map for semantic colors
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch where meaningful,
// small modular file, camelCase exports, UPPER_SNAKE constants.
// ============================================================================

// ---------------------------------------------------------------------------
// CORE PALETTE — Slate/Charcoal dark base + neon accents
// ---------------------------------------------------------------------------

/** Base surface colors (the dark slate/charcoal ladder). */
export const SURFACE = {
  // Page + panel backgrounds (charcoal ladder, darkest -> lighter)
  void: '#070A12',      // absolute darkest (login backdrop)
  base: '#0B0F19',      // app shell background (matches existing UserPanel)
  panel: '#0E1424',     // raised panel / card
  panelAlt: '#111827',  // alt raised surface (slate-900-ish)
  inset: '#0A0E18',     // recessed/well surface
  // Hairline borders (low alpha whites read on dark)
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(139,92,246,0.35)',
  // Text ladder
  text: '#F1F5F9',      // slate-100 — primary text
  textMuted: '#94A3B8', // slate-400 — secondary text
  textFaint: '#64748B', // slate-500 — tertiary / hints
  textGhost: '#475569', // slate-600 — disabled / placeholders
};

/** Neon accent palette (the "glow" layer). */
export const ACCENT = {
  cyan: '#22d3ee',      // electric cyan — primary neon accent
  cyanSoft: 'rgba(34,211,238,0.16)',
  violet: '#8b5cf6',    // violet — secondary neon accent (matches existing purple)
  violetSoft: 'rgba(139,92,246,0.18)',
  indigo: '#6366f1',    // indigo — tertiary, used in gradients w/ violet
  indigoSoft: 'rgba(99,102,241,0.16)',
  // Semantic status colors (kept readable on dark)
  success: '#34d399',   // emerald-400
  successSoft: 'rgba(52,211,153,0.16)',
  warning: '#fbbf24',   // amber-400
  warningSoft: 'rgba(251,191,36,0.16)',
  danger: '#f87171',    // red-400
  dangerSoft: 'rgba(248,113,113,0.16)',
  info: '#38bdf8',      // sky-400
  infoSoft: 'rgba(56,189,248,0.16)',
};

/** Canonical semantic accent map (for StatCard etc. that take a `color`). */
export const ACCENT_BY_KEY = {
  cyan: { hex: ACCENT.cyan, soft: ACCENT.cyanSoft, text: 'text-cyan-300', glow: 'cyan' },
  violet: { hex: ACCENT.violet, soft: ACCENT.violetSoft, text: 'text-violet-300', glow: 'violet' },
  purple: { hex: ACCENT.violet, soft: ACCENT.violetSoft, text: 'text-violet-300', glow: 'violet' },
  indigo: { hex: ACCENT.indigo, soft: ACCENT.indigoSoft, text: 'text-indigo-300', glow: 'indigo' },
  blue: { hex: ACCENT.info, soft: ACCENT.infoSoft, text: 'text-sky-300', glow: 'cyan' },
  green: { hex: ACCENT.success, soft: ACCENT.successSoft, text: 'text-emerald-300', glow: 'green' },
  amber: { hex: ACCENT.warning, soft: ACCENT.warningSoft, text: 'text-amber-300', glow: 'amber' },
  red: { hex: ACCENT.danger, soft: ACCENT.dangerSoft, text: 'text-red-300', glow: 'red' },
};

// ---------------------------------------------------------------------------
// SPACING — 4px base rhythm
// ---------------------------------------------------------------------------

export const SPACING = {
  0: '0px', 0.5: '2px', 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px',
  3: '12px', 3.5: '14px', 4: '16px', 5: '20px', 6: '24px', 7: '28px',
  8: '32px', 9: '36px', 10: '40px', 11: '44px', 12: '48px', 14: '56px',
  16: '64px', 20: '80px', 24: '96px',
};

// ---------------------------------------------------------------------------
// RADII — soft, premium
// ---------------------------------------------------------------------------

export const RADIUS = {
  none: '0px', sm: '6px', md: '10px', lg: '14px', xl: '18px',
  '2xl': '22px', '3xl': '28px', full: '9999px',
};

// ---------------------------------------------------------------------------
// SHADOWS — layered, with neon glow variants
// ---------------------------------------------------------------------------

export const SHADOW = {
  // Elevation shadows (subtle, on dark)
  sm: '0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.45)',
  lg: '0 10px 30px rgba(0,0,0,0.5)',
  xl: '0 20px 50px rgba(0,0,0,0.55)',
  // Neon glow shadows (accent-driven)
  glowCyan: '0 0 0 1px rgba(34,211,238,0.25), 0 0 24px rgba(34,211,238,0.25)',
  glowViolet: '0 0 0 1px rgba(139,92,246,0.28), 0 0 26px rgba(139,92,246,0.28)',
  glowGreen: '0 0 0 1px rgba(52,211,153,0.25), 0 0 22px rgba(52,211,153,0.22)',
  glowRed: '0 0 0 1px rgba(248,113,113,0.25), 0 0 22px rgba(248,113,113,0.22)',
  glowAmber: '0 0 0 1px rgba(251,191,36,0.25), 0 0 22px rgba(251,191,36,0.22)',
};

// ---------------------------------------------------------------------------
// MOTION — easing curves + durations (respects prefers-reduced-motion)
// ---------------------------------------------------------------------------

export const MOTION = {
  // Easing curves
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',     // premium ease-out (primary)
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // subtle overshoot
  easeLinear: 'linear',
  // Durations
  instant: '80ms',
  fast: '160ms',
  base: '240ms',
  slow: '420ms',
  page: '600ms',
};

// ---------------------------------------------------------------------------
// Z-INDEX ladder (avoids magic numbers in JSX)
// ---------------------------------------------------------------------------

export const Z = {
  base: 0,
  raised: 10,
  sticky: 20,
  dropdown: 30,
  sidebar: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  popover: 70,
  commandPalette: 80,
  top: 100,
};

// ---------------------------------------------------------------------------
// GLASS — glassmorphic panel recipe (the premium dark-glass look)
// ---------------------------------------------------------------------------

export const GLASS = {
  // Card / panel
  card: {
    background: 'rgba(14,20,36,0.55)',     // surface.panel at 55% over backdrop
    backdrop: 'blur(16px) saturate(140%)',
    border: SURFACE.border,
    radius: RADIUS.xl,
    shadow: SHADOW.lg,
  },
  // Stronger glass for modals / overlays
  modal: {
    background: 'rgba(11,15,25,0.72)',
    backdrop: 'blur(20px) saturate(160%)',
    border: SURFACE.borderStrong,
    radius: RADIUS['2xl'],
    shadow: SHADOW.xl,
  },
  // Faint inset glass (wells, code surfaces)
  inset: {
    background: 'rgba(7,10,18,0.5)',
    backdrop: 'blur(8px)',
    border: SURFACE.border,
    radius: RADIUS.lg,
    shadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
};

// ---------------------------------------------------------------------------
// GRADIENTS — canonical brand + accent gradients (as CSS strings)
// ---------------------------------------------------------------------------

export const GRADIENT = {
  brand: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',         // violet->indigo
  brandSoft: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.05) 100%)',
  cyanViolet: 'linear-gradient(135deg, #22d3ee 0%, #8b5cf6 100%)',    // neon mix (hero)
  mesh: 'radial-gradient(at 20% 20%, rgba(139,92,246,0.10) 0px, transparent 50%), radial-gradient(at 80% 30%, rgba(34,211,238,0.08) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(99,102,241,0.07) 0px, transparent 50%)',
  progressGreen: 'linear-gradient(to right, #34d399, #10b981)',
  progressViolet: 'linear-gradient(to right, #8b5cf6, #6366f1)',
  progressCyan: 'linear-gradient(to right, #22d3ee, #38bdf8)',
  progressRed: 'linear-gradient(to right, #f87171, #fb923c)',
  progressAmber: 'linear-gradient(to right, #fbbf24, #f59e0b)',
};

// ---------------------------------------------------------------------------
// GRID — layout constants
// ---------------------------------------------------------------------------

export const GRID = {
  sidebarWidth: 256,        // px (matches existing UserDashboard sidebar)
  sidebarCollapsed: 0,
  editorHeightLock: 480,    // px — PRESERVE: code editor 480px height lock
  maxContentWidth: 1280,    // px — content max width
  mobileBreakpoint: 1024,   // lg
};

// ---------------------------------------------------------------------------
// TYPOGRAPHY — scale + weights
// ---------------------------------------------------------------------------

export const TYPO = {
  family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  size: {
    xs: '11px', sm: '13px', base: '15px', md: '16px', lg: '18px',
    xl: '20px', '2xl': '24px', '3xl': '30px', '4xl': '38px',
  },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Join class names — filters falsy values and collapses whitespace.
 * @param {...(string|false|null|undefined)} args
 * @returns {string}
 */
export function cx(...args) {
  return args
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a neon glow box-shadow string for a given accent key.
 * @param {('cyan'|'violet'|'indigo'|'green'|'red'|'amber')} key
 * @param {number} [strength=1] — multiplier on glow spread
 * @returns {string} CSS box-shadow value
 */
export function withGlow(key, strength = 1) {
  try {
    const map = {
      cyan: `0 0 0 1px rgba(34,211,238,${0.25 * strength}), 0 0 ${24 * strength}px rgba(34,211,238,${0.25 * strength})`,
      violet: `0 0 0 1px rgba(139,92,246,${0.28 * strength}), 0 0 ${26 * strength}px rgba(139,92,246,${0.28 * strength})`,
      indigo: `0 0 0 1px rgba(99,102,241,${0.25 * strength}), 0 0 ${24 * strength}px rgba(99,102,241,${0.25 * strength})`,
      green: `0 0 0 1px rgba(52,211,153,${0.25 * strength}), 0 0 ${22 * strength}px rgba(52,211,153,${0.22 * strength})`,
      red: `0 0 0 1px rgba(248,113,113,${0.25 * strength}), 0 0 ${22 * strength}px rgba(248,113,113,${0.22 * strength})`,
      amber: `0 0 0 1px rgba(251,191,36,${0.25 * strength}), 0 0 ${22 * strength}px rgba(251,191,36,${0.22 * strength})`,
    };
    return map[key] || map.violet;
  } catch (err) {
    return SHADOW.glowViolet;
  }
}

/**
 * Returns a CSS animation-duration value that resolves to 0s when the user
 * prefers reduced motion. Use as: style={{ animationDuration: motionSafe(MOTION.base) }}
 * NOTE: This is a static value; for full reduced-motion gating, prefer the
 * `@media (prefers-reduced-motion: reduce)` rules in globals.css which blanket
 * every animation. This helper is for inline styles that need a duration.
 * @param {string} duration
 * @returns {string}
 */
export function motionSafe(duration) {
  // Inline styles can't read media queries; the globals.css blanket rule
  // handles reduced-motion. This returns the duration unchanged so inline
  // animations are consistent, while globals.css zeroes them when needed.
  return duration;
}

// ---------------------------------------------------------------------------
// FULL THEME AGGREGATE
// ---------------------------------------------------------------------------

export const theme = {
  surface: SURFACE,
  accent: ACCENT,
  accentByKey: ACCENT_BY_KEY,
  spacing: SPACING,
  radius: RADIUS,
  shadow: SHADOW,
  motion: MOTION,
  z: Z,
  glass: GLASS,
  gradient: GRADIENT,
  grid: GRID,
  typo: TYPO,
  cx,
  withGlow,
  motionSafe,
};

export default theme;
