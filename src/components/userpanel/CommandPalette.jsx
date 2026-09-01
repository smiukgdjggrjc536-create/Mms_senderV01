// ============================================================================
// V7 P9.6 — Command Palette (Ctrl+K)
// ----------------------------------------------------------------------------
// A power-user jump-to-anything palette. Opens with Ctrl+K (or Cmd+K on Mac).
// Fuzzy-matches across a command registry (tabs, campaigns, actions) and
// executes the selected command on Enter. Keyboard-first, mouse-optional.
//
// Props:
//   { open, onClose, commands }
//     commands: array of { id, label, hint?, icon?, group?, action: ()=>void }
//
// STYLE LAW: theme.js tokens, static Tailwind classes, try/catch, camelCase.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/userpanel/icons.jsx';
import { SURFACE, cx } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// Minimal fuzzy scorer — substring + character-sequence match.
// Returns a score (higher = better) or -1 (no match).
// ---------------------------------------------------------------------------
function fuzzyScore(query, label) {
  try {
    if (!query) return 0;
    const q = query.toLowerCase();
    const l = String(label || '').toLowerCase();
    if (l.includes(q)) return 100 - (l.indexOf(q));
    // Character-sequence match
    let qi = 0;
    for (let i = 0; i < l.length && qi < q.length; i++) {
      if (l[i] === q[qi]) qi++;
    }
    return qi === q.length ? 10 : -1;
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------
export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after render
      const t = setTimeout(() => {
        try { inputRef.current?.focus(); } catch { /* ignore */ }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Filtered + scored commands
  const filtered = useMemo(() => {
    try {
      if (!commands || commands.length === 0) return [];
      const scored = commands
        .map((cmd) => ({ cmd, score: fuzzyScore(query, cmd.label) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score);
      return scored.map((x) => x.cmd);
    } catch {
      return [];
    }
  }, [commands, query]);

  // Keep activeIndex in bounds
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    try {
      const el = listRef.current?.querySelector?.(`[data-cp-idx="${activeIndex}"]`);
      el?.scrollIntoView?.({ block: 'nearest' });
    } catch { /* ignore */ }
  }, [activeIndex]);

  // Keyboard handler
  const handleKeyDown = (e) => {
    try {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd && typeof cmd.action === 'function') {
          cmd.action();
          onClose();
        }
        return;
      }
    } catch { /* ignore */ }
  };

  if (!open) return null;

  // Group filtered commands by group label
  const groups = useMemo(() => {
    try {
      const map = new Map();
      for (const cmd of filtered) {
        const g = cmd.group || 'Actions';
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(cmd);
      }
      return Array.from(map.entries());
    } catch {
      return [];
    }
  }, [filtered]);

  // Flatten for index tracking
  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        onClick={onClose}
      />

      {/* Palette panel */}
      <div
        className={cx(
          'relative w-full max-w-xl rounded-2xl border overflow-hidden',
          'border-white/10 backdrop-blur-2xl',
        )}
        style={{ backgroundColor: 'rgba(14,20,36,0.95)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
          <Icon.Command className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="Search commands, tabs, campaigns…"
            className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-500 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto v7-scroll p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Icon.Eye className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm text-slate-500">
                No commands match “{query}”.
              </p>
            </div>
          ) : (
            groups.map(([groupLabel, cmds]) => (
              <div key={groupLabel} className="mb-1.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-600 px-2 py-1.5 font-medium">
                  {groupLabel}
                </div>
                {cmds.map((cmd) => {
                  runningIndex++;
                  const idx = runningIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-cp-idx={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => { cmd.action(); onClose(); }}
                      className={cx(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition',
                        isActive ? 'bg-cyan-500/10 text-white' : 'text-slate-400 hover:bg-white/5',
                      )}
                    >
                      {cmd.icon ? (
                        <cmd.icon className={cx('w-4 h-4 shrink-0', isActive ? 'text-cyan-400' : 'text-slate-500')} />
                      ) : (
                        <span className="w-4 h-4 shrink-0" />
                      )}
                      <span className="flex-1 text-sm truncate">{cmd.label}</span>
                      {cmd.hint && (
                        <span className="text-[10px] text-slate-600 font-mono shrink-0">{cmd.hint}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↵</kbd>
              select
            </span>
          </div>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
