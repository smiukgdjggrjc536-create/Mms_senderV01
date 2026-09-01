// ============================================================================
// V7 P9.6 — Keyboard Shortcuts Hook
// ----------------------------------------------------------------------------
// Registers global keyboard shortcuts for the user panel power-user layer.
// Invisible to casual users, loved by pros.
//
// Shortcuts (per script P9.6):
//   Ctrl+K / Cmd+K  → open command palette
//   N               → new campaign (switch to send tab)
//   1               → dashboard tab
//   2               → send tab
//   3               → inbox tab
//   4               → reports tab
//   Space           → pause/resume current send (if a send is running)
//   /               → focus search / open palette
//
// All shortcuts are ignored when the user is typing in an input/textarea/
// contenteditable or when a modifier (Alt/Meta except Cmd+K) is held.
//
// STYLE LAW: try/catch, camelCase, zero side-effects on cleanup.
// ============================================================================
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// isTyping — true if the active element is a text-input surface
// ---------------------------------------------------------------------------
function isTyping() {
  try {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      // Checkbox/radio/range are not "typing" inputs
      return !['checkbox', 'radio', 'range', 'file', 'submit', 'button', 'image', 'reset'].includes(type);
    }
    if (tag === 'TEXTAREA') return true;
    if (tag === 'SELECT') return false;
    if (el.isContentEditable) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// useKeyboardShortcuts
//   handlers: { onPalette, onNewCampaign, onTab(key), onPauseToggle, onSearch }
// ---------------------------------------------------------------------------
export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const onKeyDown = (e) => {
      try {
        // Ctrl+K / Cmd+K → always open palette (even while typing)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (typeof handlers.onPalette === 'function') handlers.onPalette();
          return;
        }

        // Ignore all other shortcuts while typing or with modifiers
        if (isTyping()) return;
        if (e.altKey) return;
        // Allow Shift for some keys but not as a blanket modifier

        const key = e.key.toLowerCase();

        // N → new campaign
        if (key === 'n' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (typeof handlers.onNewCampaign === 'function') handlers.onNewCampaign();
          return;
        }

        // 1-4 → tab switch
        if (['1', '2', '3', '4'].includes(key) && !e.shiftKey) {
          e.preventDefault();
          const tabMap = { '1': 'dashboard', '2': 'send', '3': 'inbox', '4': 'reports' };
          if (typeof handlers.onTab === 'function') handlers.onTab(tabMap[key]);
          return;
        }

        // Space → pause/resume current send
        if (e.code === 'Space' && !e.shiftKey) {
          e.preventDefault();
          if (typeof handlers.onPauseToggle === 'function') handlers.onPauseToggle();
          return;
        }

        // / → focus search / open palette
        if (key === '/' && !e.shiftKey) {
          e.preventDefault();
          if (typeof handlers.onSearch === 'function') handlers.onSearch();
          else if (typeof handlers.onPalette === 'function') handlers.onPalette();
          return;
        }
      } catch { /* never let a shortcut error break the app */ }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}

export { isTyping };
