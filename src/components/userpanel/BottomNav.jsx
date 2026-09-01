// ============================================================================
// V7 P9.6 — Mobile Bottom Navigation
// ----------------------------------------------------------------------------
// Native-feeling bottom-nav for small screens (≤1024px). Shows the 5 primary
// destinations with icon + label, active-state pill, and a safe-area inset so
// it never overlaps the iOS/Android home indicator. Replaces the horizontal
// scroll tab-bar on mobile for a more app-native feel.
//
// Props:
//   { tabs, activeTab, onChange }
//     tabs: array of { k, l, I (icon component) }
//
// STYLE LAW: theme.js tokens, static Tailwind classes, try/catch, camelCase.
// ============================================================================
import Icon from '@/components/userpanel/icons.jsx';
import { cx } from '@/lib/ui/theme.js';

export default function BottomNav({ tabs, activeTab, onChange }) {
  try {
    // Show at most 5 items on the bottom nav (script: 1-4 sandbox tabs + dashboard)
    const navItems = (tabs || []).slice(0, 5);

    return (
      <nav
        className={cx(
          'lg:hidden fixed bottom-0 left-0 right-0 z-30',
          'flex items-stretch justify-around',
          'border-t border-white/10 backdrop-blur-2xl',
        )}
        style={{
          backgroundColor: 'rgba(14,20,36,0.92)',
          // Safe-area inset so the nav never overlaps the home indicator
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Primary navigation"
      >
        {navItems.map(({ k, l, I }) => {
          const active = activeTab === k;
          return (
            <button
              key={k}
              onClick={() => onChange(k)}
              className={cx(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 transition',
                active ? 'text-cyan-300' : 'text-slate-500',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={cx(
                  'flex items-center justify-center w-9 h-7 rounded-lg transition',
                  active ? 'bg-cyan-500/15' : 'bg-transparent',
                )}
              >
                <I className={cx('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]')} />
              </span>
              <span className={cx('text-[9px] font-medium leading-none truncate max-w-full px-1', active && 'font-semibold')}>
                {l}
              </span>
            </button>
          );
        })}
      </nav>
    );
  } catch {
    return null;
  }
}
