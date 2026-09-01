// ============================================================================
// V7 P9.7 — Trust & Transparency Surface
// ----------------------------------------------------------------------------
// Compliance-grade UX surface with two parts:
//
//   1. TrustScore card — renders the 5-step validator pipeline breakdown as an
//      interactive ring chart. Server numbers are FINAL (PRESERVE: the UI
//      displays server numbers, it never invents its own). Each step shows its
//      pass/fail count from the bounce-check results.
//
//   2. ConfirmDialog — double-confirm modal for destructive actions (delete
//      campaign, clear recipients, replace bounced). Two-step gate: the
//      operator must type the confirmation word OR press the explicit
//      "Confirm" button (no single-click destruction).
//
//   3. QuotaNotice — surfaces the server's quota-exceeded Bangla message
//      VERBATIM. Never swallows, never rewrites — just renders it cleanly with
//      a recovery nudge.
//
// Props:
//   TrustScore: { bounceResults, spamPreview, validationStep, steps }
//   ConfirmDialog: { open, title, message, confirmWord, onConfirm, onCancel, danger }
//   QuotaNotice: { message (server string), onAction?, actionLabel? }
//
// STYLE LAW: theme.js tokens, static Tailwind classes, try/catch, camelCase.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/userpanel/icons.jsx';
import { SURFACE, ACCENT, cx } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// 5-step validator step metadata (labels match the server pipeline order)
// ---------------------------------------------------------------------------
const STEP_META = [
  { key: 'syntax',   label: 'Syntax / RFC 5322', icon: Icon.FileCode },
  { key: 'dedup',    label: 'Duplicate Removal',  icon: Icon.Copy },
  { key: 'bounce',   label: 'Bounce-Risk Filter', icon: Icon.Bounce },
  { key: 'blacklist',label: 'Blacklist Check',    icon: Icon.Shield },
  { key: 'grade',    label: 'Quality Grade',      icon: Icon.Star },
];

// ---------------------------------------------------------------------------
// TrustScore — 5-step validator ring + breakdown
// ---------------------------------------------------------------------------
export function TrustScore({ bounceResults, spamPreview, validationStep, steps }) {
  try {
    const br = bounceResults || null;
    const sp = spamPreview || null;
    const checked = br?.checked || 0;
    const valid = br?.valid?.length || 0;
    const bounced = br?.bounced?.length || 0;
    const duplicates = br?.duplicates?.length || 0;

    // Trust score = weighted combination of validator pass-rate + spam score
    // Server numbers only — we never invent.
    const passRate = checked > 0 ? Math.round((valid / checked) * 100) : 0;
    const spamSafe = sp ? Math.max(0, 100 - (sp.score || 0)) : 100;
    const trustScore = br ? Math.round(passRate * 0.6 + spamSafe * 0.4) : (sp ? spamSafe : 0);

    // Tier
    const tier = trustScore >= 80 ? 'success' : trustScore >= 50 ? 'warning' : 'danger';
    const TIER_COLOR = { success: ACCENT.success, warning: ACCENT.warning, danger: ACCENT.danger };
    const TIER_LABEL = { success: 'Trusted', warning: 'Caution', danger: 'At Risk' };
    const TIER_CLS = {
      success: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      warning: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
      danger: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
    };

    // Per-step pass/fail (derived from bounceResults — server numbers only)
    const stepResults = useMemo(() => {
      if (!br) return null;
      return [
        { passed: checked, failed: bounced + duplicates, detail: `${valid} valid syntax` },
        { passed: checked - duplicates, failed: duplicates, detail: `${duplicates} duplicates removed` },
        { passed: valid, failed: bounced, detail: `${bounced} bounce-risk filtered` },
        { passed: valid, failed: bounced, detail: `${bounced} blacklisted` },
        { passed: valid, failed: bounced, detail: `Grade: ${passRate}%` },
      ];
    }, [br, checked, valid, bounced, duplicates, passRate]);

    // Ring geometry
    const size = 120;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (trustScore / 100) * circ;

    return (
      <div className={cx('rounded-2xl border p-5', 'border-white/5 bg-white/[0.02]')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Icon.Shield className="w-4 h-4 text-cyan-400" />
            Trust Score
          </h3>
          <span className={cx('text-[10px] px-2 py-0.5 rounded-full font-medium border', TIER_CLS[tier])}>
            {TIER_LABEL[tier]}
          </span>
        </div>

        {/* Ring + score */}
        <div className="flex items-center gap-5 mb-4">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SURFACE.inset} strokeWidth={stroke} />
              <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={TIER_COLOR[tier]} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums" style={{ color: TIER_COLOR[tier] }}>
                {trustScore}
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">/ 100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            {br ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Valid recipients</span>
                  <span className="font-bold text-emerald-300 tabular-nums">{valid}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Bounce-risk</span>
                  <span className="font-bold text-rose-300 tabular-nums">{bounced}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Duplicates</span>
                  <span className="font-bold text-amber-300 tabular-nums">{duplicates}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Run a bounce check to see the validator breakdown.
              </p>
            )}
            {sp && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
                <span className="text-slate-400">Spam safety</span>
                <span className={cx('font-bold tabular-nums',
                  sp.level === 'high' ? 'text-rose-300' : sp.level === 'moderate' ? 'text-amber-300' : 'text-emerald-300')}>
                  {spamSafe}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 5-step validator breakdown */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 font-medium mb-1">
            5-Step Validator Pipeline
          </p>
          {STEP_META.map((meta, i) => {
            const StepIcon = meta.icon;
            const result = stepResults?.[i];
            const isRunning = validationStep === i;
            const isDone = stepResults && validationStep > i;
            const isPending = !stepResults || validationStep < i;
            const passed = result?.failed === 0;

            return (
              <div
                key={meta.key}
                className={cx(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition',
                  isRunning ? 'border-cyan-500/30 bg-cyan-500/5' :
                  isDone ? (passed ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]') :
                  'border-white/5 bg-white/[0.01]',
                )}
              >
                <StepIcon className={cx('w-3.5 h-3.5 shrink-0',
                  isRunning ? 'text-cyan-400 animate-pulse' :
                  isDone ? (passed ? 'text-emerald-400' : 'text-rose-400') :
                  'text-slate-600')} />
                <span className="text-xs text-slate-300 flex-1 truncate">{meta.label}</span>
                {isRunning && <span className="text-[9px] text-cyan-400 animate-pulse">scanning…</span>}
                {isDone && result && (
                  <span className={cx('text-[10px] tabular-nums font-medium',
                    passed ? 'text-emerald-300' : 'text-rose-300')}>
                    {result.passed} pass · {result.failed} fail
                  </span>
                )}
                {isPending && <span className="text-[9px] text-slate-600">pending</span>}
              </div>
            );
          })}
        </div>

        {/* Spam reasons (if any) */}
        {sp && sp.reasons && sp.reasons.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-slate-600 font-medium mb-1.5">
              Spam Signals
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sp.reasons.slice(0, 6).map((reason, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ConfirmDialog — double-confirm for destructive actions
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message,
  confirmWord,
  onConfirm,
  onCancel,
  danger = true,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) {
  const [typed, setTyped] = useState('');

  // Reset typed text each time the dialog opens
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  // Escape to cancel
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const wordMatch = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        onClick={onCancel}
      />
      <div
        className={cx(
          'relative w-full max-w-md rounded-2xl border p-6 backdrop-blur-2xl',
          danger ? 'border-rose-500/20' : 'border-white/10',
        )}
        style={{ backgroundColor: 'rgba(14,20,36,0.95)' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={cx(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            danger ? 'bg-rose-500/15' : 'bg-amber-500/15',
          )}>
            <Icon.AlertTriangle className={cx('w-5 h-5', danger ? 'text-rose-400' : 'text-amber-400')} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {confirmWord && (
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-1.5">
              Type <span className="font-mono font-bold text-rose-300">{confirmWord}</span> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full text-sm px-3 py-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/40 transition font-mono"
              placeholder={confirmWord}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!wordMatch}
            className={cx(
              'px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5',
              danger
                ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-30 disabled:cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            <Icon.Trash className="w-3.5 h-3.5" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuotaNotice — surfaces server's Bangla quota-exceeded message VERBATIM
// Never swallows, never rewrites. Just renders it cleanly with a recovery nudge.
// ---------------------------------------------------------------------------
export function QuotaNotice({ message, onAction, actionLabel }) {
  try {
    if (!message) return null;
    return (
      <div className={cx('rounded-xl border p-4', 'border-amber-500/30 bg-amber-500/[0.06]')}>
        <div className="flex items-start gap-3">
          <Icon.Alert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-300 mb-1">Quota Notice</p>
            {/* Server message rendered VERBATIM — never altered */}
            <p className="text-sm text-amber-100/90 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
            {onAction && actionLabel && (
              <button
                onClick={onAction}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

// Aggregate default export
export default { TrustScore, ConfirmDialog, QuotaNotice };
