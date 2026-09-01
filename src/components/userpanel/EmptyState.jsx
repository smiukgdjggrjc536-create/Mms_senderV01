// ============================================================================
// V7 P9.5 — Empty States with Personality
// ----------------------------------------------------------------------------
// Each empty screen gets a unique illustrated icon composition + a one-line
// nudge guiding the next action. Replaces the flat "no data" blocks across the
// panel so every empty surface feels intentional, on-brand, and helpful.
//
// STYLE LAW: theme.js tokens, static Tailwind classes, camelCase, try/catch.
// ============================================================================
import Icon from '@/components/userpanel/icons.jsx';
import { ACCENT, cx } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// Preset catalog — each preset has an icon, accent, gradient, title, nudge.
// Bangla nudges are included per the language law (operator-facing copy).
// ---------------------------------------------------------------------------
const PRESETS = {
  campaigns: {
    icon: Icon.Send,
    accent: 'violet',
    glow: 'rgba(139,92,246,0.10)',
    title: 'No campaigns yet',
    nudge: 'Head to the Send Email tab to launch your first campaign.',
  },
  reports: {
    icon: Icon.Activity,
    accent: 'cyan',
    glow: 'rgba(34,211,238,0.10)',
    title: 'No delivery data yet',
    nudge: 'Once you send a campaign, per-recipient delivery reports appear here.',
  },
  inbox: {
    icon: Icon.Inbox,
    accent: 'indigo',
    glow: 'rgba(99,102,241,0.10)',
    title: 'Inbox is quiet',
    nudge: 'When your email provider webhook is configured, inbound messages land here.',
  },
  templates: {
    icon: Icon.Clipboard,
    accent: 'emerald',
    glow: 'rgba(52,211,153,0.10)',
    title: 'No templates saved',
    nudge: 'Save a campaign message as a template to reuse it later.',
  },
  credentials: {
    icon: Icon.Key,
    accent: 'amber',
    glow: 'rgba(251,191,36,0.10)',
    title: 'No credentials connected',
    nudge: 'Connect a Gmail account or ask your admin to assign a sender pool.',
  },
  search: {
    icon: Icon.Eye,
    accent: 'sky',
    glow: 'rgba(56,189,248,0.10)',
    title: 'No matches found',
    nudge: 'Try a different search term or clear your filters.',
  },
  generic: {
    icon: Icon.Sparkle,
    accent: 'violet',
    glow: 'rgba(139,92,246,0.08)',
    title: 'Nothing here yet',
    nudge: 'Your content will appear in this space once available.',
  },
};

// Accent ring color mapping (static classes; no dynamic Tailwind builds)
const ACCENT_RING = {
  violet: 'text-violet-400',
  cyan: 'text-cyan-400',
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  sky: 'text-sky-400',
};

// ---------------------------------------------------------------------------
// EmptyState — illustrated empty surface
//   preset: key from PRESETS (campaigns, reports, inbox, templates, ...)
//   title / nudge: optional overrides
//   action: optional { label, onClick } for a primary CTA button
//   icon: optional override (an Icon.X component)
// ---------------------------------------------------------------------------
export default function EmptyState({
  preset = 'generic',
  title,
  nudge,
  action,
  icon,
  className,
}) {
  try {
    const p = PRESETS[preset] || PRESETS.generic;
    const IconCmp = icon || p.icon;
    const ringCls = ACCENT_RING[p.accent] || ACCENT_RING.violet;

    return (
      <div className={cx('text-center py-14 px-4', className)}>
        {/* Illustrated icon composition — concentric soft rings + glow */}
        <div className="relative inline-flex items-center justify-center mb-5">
          <div
            className="absolute w-20 h-20 rounded-full blur-xl"
            style={{ backgroundColor: p.glow }}
          />
          <div
            className="absolute w-16 h-16 rounded-2xl rotate-6 opacity-30"
            style={{ backgroundColor: p.glow }}
          />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 bg-white/[0.03]">
            <IconCmp className={cx('w-7 h-7', ringCls)} />
          </div>
        </div>

        <h3 className="text-base font-semibold text-white mb-1.5">
          {title || p.title}
        </h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          {nudge || p.nudge}
        </p>

        {action && action.label && typeof action.onClick === 'function' && (
          <button
            onClick={action.onClick}
            className={cx(
              'mt-5 inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium transition',
              'border border-violet-500/30 bg-violet-500/10 text-violet-300',
              'hover:bg-violet-500/20 active:scale-[0.98]',
            )}
          >
            <Icon.Plus className="w-4 h-4" />
            {action.label}
          </button>
        )}
      </div>
    );
  } catch {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Nothing here yet.
      </div>
    );
  }
}

// Named export of presets for programmatic use
export { PRESETS };
