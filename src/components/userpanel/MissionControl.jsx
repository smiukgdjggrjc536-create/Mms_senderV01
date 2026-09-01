// ============================================================================
// V7 P9.3 — MissionControl: cinematic 4-step send experience
// ----------------------------------------------------------------------------
// A premium full-screen modal that walks the operator through a cinematic
// 4-step launch sequence:
//
//   Step 1 — AUDIENCE LOCK-IN:  confirm recipient count, sender accounts,
//            quota check.  Shows a "ready" badge when all clear.
//   Step 2 — MESSAGE REVIEW:    subject + body preview with AI verdict
//            (Composure Coach score from P9.1).  Operator confirms message.
//   Step 3 — THROTTLE DIAL:     visual speed/rate dial (maps to existing
//            speedModes).  Shows estimated send time.
//   Step 4 — LAUNCH GO/NO-GO:   checklist of pre-flight items (credentials
//            connected, quota > 0, message set, terms agreed).  Big LAUNCH
//            button only enables when all green.  Live send-wave viz on send.
//
// Pause/resume is wired to the existing threshold-resume engine via the
// onPause/onResume props (PRESERVE: thresholdStatus contract).
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular file.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { cx, SURFACE, ACCENT, RADIUS, Z, MOTION } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';
import { scoreComposure } from '@/components/userpanel/Orchestrator.jsx';
import { StaggerItem } from '@/components/userpanel/PageTransition.jsx';

// ---------------------------------------------------------------------------
// Step indicator (cinematic progress dots)
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'audience', label: 'Audience', icon: 'Users' },
  { key: 'message',  label: 'Message',  icon: 'Edit' },
  { key: 'throttle', label: 'Throttle', icon: 'Sliders' },
  { key: 'launch',   label: 'Launch',   icon: 'Rocket' },
];

function StepIndicator({ current, max }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {STEPS.map((s, i) => {
        const Ic = Icon[s.icon] || Icon.Activity;
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={cx(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300',
                done ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : active ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300 scale-110'
                  : 'bg-white/5 border border-white/10 text-gray-600'
              )}
            >
              {done ? <Icon.CheckCircle className="w-3.5 h-3.5" /> : <Ic className="w-3.5 h-3.5" />}
            </div>
            {i < max - 1 && (
              <div className={cx('w-8 h-px transition-all duration-500', done ? 'bg-emerald-500/40' : 'bg-white/10')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendWaveViz — animated wave visualization during active send
// ---------------------------------------------------------------------------

function SendWaveViz({ active, sent = 0, total = 0 }) {
  const pct = total > 0 ? Math.min((sent / total) * 100, 100) : 0;
  if (!active) return null;
  return (
    <div className="relative h-20 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
      {/* wave fill */}
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600/30 to-cyan-500/30 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
      {/* wave bars */}
      <div className="absolute inset-0 flex items-end justify-around px-2 pb-2">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-cyan-400/40 animate-pulse"
            style={{
              height: `${20 + Math.abs(Math.sin((Date.now() / 300) + i)) * 60}%`,
              animationDelay: `${i * 50}ms`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white tabular-nums">{sent} / {total}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MissionControl — main component
// ---------------------------------------------------------------------------

/**
 * @param {object}   props
 * @param {boolean}  props.open          — modal visibility
 * @param {function} props.onClose       — () => void
 * @param {object}   props.campaign      — the campaign state
 * @param {function} props.onSend        — () => void  (triggers actual send)
 * @param {function} [props.onPause]     — () => void
 * @param {function} [props.onResume]    — () => void
 * @param {array}    [props.senderAccounts]
 * @param {number}   [props.remaining]
 * @param {array}    [props.speedModes]  — [{key,label,rate}]
 * @param {object}   [props.thresholdStatus]
 * @param {boolean}  [props.agreedTerms]
 */
export default function MissionControl({
  open,
  onClose,
  campaign,
  onSend,
  onPause,
  onResume,
  senderAccounts = [],
  remaining = 0,
  speedModes = [],
  thresholdStatus,
  agreedTerms = false,
}) {
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  // Reset to step 0 when opened
  useEffect(() => {
    if (open) { setStep(0); setLaunching(false); }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !launching) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, launching, onClose]);

  const c = campaign || {};
  const parsedEmails = (c.numbersText || '').split(/[\n,\s]/).map((n) => n.trim()).filter(Boolean);
  const totalTarget = parsedEmails.length;
  const { score, grade, tips } = useMemo(
    () => scoreComposure(c.message || '', c.subject || ''),
    [c.message, c.subject]
  );

  // Pre-flight checklist
  const checklist = useMemo(() => [
    { label: 'Sender credentials connected', ok: senderAccounts.length > 0 },
    { label: 'Recipients added', ok: totalTarget > 0 },
    { label: 'Subject line set', ok: !!(c.subject || '').trim() },
    { label: 'Message body set', ok: !!(c.message || '').trim() },
    { label: 'Quota available', ok: remaining > 0 },
    { label: 'Terms agreed', ok: agreedTerms },
    { label: 'AI composure score ≥ 50', ok: score >= 50 },
  ], [senderAccounts.length, totalTarget, c.subject, c.message, remaining, agreedTerms, score]);

  const allGreen = checklist.every((item) => item.ok);
  const greenCount = checklist.filter((i) => i.ok).length;

  if (!open) return null;

  const handleLaunch = () => {
    if (!allGreen) return;
    setLaunching(true);
    setStep(3);
    try { onSend && onSend(); } catch { /* ignore */ }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ zIndex: Z.modal }}
      role="dialog"
      aria-modal="true"
      aria-label="Mission Control — Send Sequence"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => !launching && onClose()} />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 p-5 v7-glass-modal max-h-[90vh] overflow-y-auto v7-scroll animate-[scaleIn_0.3s_ease-out]"
        style={{ backgroundColor: 'rgba(14,20,36,0.95)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Icon.Rocket className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Mission Control</p>
              <p className="text-[10px] text-gray-500">{c.name || 'Untitled campaign'}</p>
            </div>
          </div>
          {!launching && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition">
              <Icon.Close className="w-4 h-4" />
            </button>
          )}
        </div>

        <StepIndicator current={step} max={STEPS.length} />

        {/* Step content */}
        <div className="min-h-[200px]">
          {/* Step 1: Audience Lock-In */}
          {step === 0 && (
            <StaggerItem index={0} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2">Step 1 — Audience Lock-In</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Recipients</p>
                  <p className="text-lg font-bold text-cyan-400">{totalTarget}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Senders</p>
                  <p className="text-lg font-bold text-violet-400">{senderAccounts.length}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Quota</p>
                  <p className="text-lg font-bold text-emerald-400">{remaining}</p>
                </div>
              </div>
              {totalTarget > remaining && remaining > 0 && (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Icon.Alert className="w-3 h-3" /> Recipients exceed quota — only {remaining} will send.
                </p>
              )}
              {totalTarget === 0 && (
                <p className="text-[10px] text-rose-400 flex items-center gap-1">
                  <Icon.Alert className="w-3 h-3" /> No recipients added — add emails before launch.
                </p>
              )}
            </StaggerItem>
          )}

          {/* Step 2: Message Review + AI Verdict */}
          {step === 1 && (
            <StaggerItem index={1} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-2">Step 2 — Message Review</p>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Subject</p>
                <p className="text-sm text-gray-200 font-medium">{c.subject || <span className="text-gray-600 italic">Not set</span>}</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Body</p>
                <p className="text-[11px] text-gray-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto v7-scroll">{c.message || <span className="text-gray-600 italic">Not set</span>}</p>
              </div>
              {/* AI Verdict */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                  background: `conic-gradient(${score >= 70 ? ACCENT.success : score >= 45 ? ACCENT.warning : ACCENT.danger} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                }}>
                  <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{score}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1">
                    <Icon.Sparkle className="w-3 h-3" /> AI Verdict — Grade {grade}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {score >= 70 ? 'Excellent composure — clear to launch.' :
                     score >= 50 ? 'Acceptable — consider improvements below.' :
                     'Needs work — see tips before sending.'}
                  </p>
                  {tips.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {tips.slice(0, 2).map((t, i) => (
                        <li key={i} className="text-[9px] text-gray-500">• {t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </StaggerItem>
          )}

          {/* Step 3: Throttle Dial */}
          {step === 2 && (
            <StaggerItem index={2} className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Step 3 — Throttle Dial</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {speedModes.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { /* parent controls speed via campaign state */ }}
                    className={cx(
                      'px-4 py-3 rounded-xl border transition-all flex flex-col items-center gap-1 min-w-[80px]',
                      c.speedMode === s.key
                        ? 'border-amber-500/50 bg-amber-500/15 scale-105'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    )}
                  >
                    <Icon.Sliders className={cx('w-4 h-4', c.speedMode === s.key ? 'text-amber-400' : 'text-gray-500')} />
                    <span className={cx('text-[10px] font-bold', c.speedMode === s.key ? 'text-amber-300' : 'text-gray-400')}>{s.label}</span>
                    {s.rate && <span className="text-[8px] text-gray-500">{s.rate}/min</span>}
                  </button>
                ))}
              </div>
              {totalTarget > 0 && c.speedMode && (
                <p className="text-center text-[10px] text-gray-500">
                  Est. send time: ~{Math.ceil(totalTarget / (speedModes.find((s) => s.key === c.speedMode)?.rate || 10))} min
                </p>
              )}
            </StaggerItem>
          )}

          {/* Step 4: Launch Go/No-Go */}
          {step === 3 && (
            <StaggerItem index={3} className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Step 4 — Launch Go/No-Go</p>
              {/* Checklist */}
              <div className="space-y-1">
                {checklist.map((item, i) => (
                  <div key={i} className={cx(
                    'flex items-center gap-2 p-2 rounded-lg border transition-all',
                    item.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
                  )}>
                    {item.ok
                      ? <Icon.CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <Icon.XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    <span className={cx('text-[10px]', item.ok ? 'text-gray-300' : 'text-gray-400')}>{item.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] text-gray-500">{greenCount}/{checklist.length} checks passed</p>

              {/* Send wave viz */}
              {launching && (
                <SendWaveViz active={launching} sent={c.sentCount || 0} total={totalTarget} />
              )}

              {/* Pause/Resume (threshold engine) */}
              {launching && onPause && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={onPause} className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/25 transition flex items-center gap-1">
                    <Icon.Pause className="w-3 h-3" /> Pause
                  </button>
                  {onResume && (
                    <button onClick={onResume} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold hover:bg-emerald-500/25 transition flex items-center gap-1">
                      <Icon.Play className="w-3 h-3" /> Resume
                    </button>
                  )}
                </div>
              )}
            </StaggerItem>
          )}
        </div>

        {/* Footer nav */}
        {!launching && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : onClose()}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] font-medium transition flex items-center gap-1"
            >
              <Icon.ChevronLeft className="w-3 h-3" /> {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-lg shadow-violet-600/30"
              >
                Continue <Icon.ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={!allGreen}
                className={cx(
                  'px-6 py-2 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5',
                  allGreen
                    ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] v7-primary-glow'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                )}
              >
                <Icon.Rocket className="w-3.5 h-3.5" /> LAUNCH
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
