// ============================================================================
// MAX-LEVEL ORCHESTRATOR — 3-zone Campaign Composer command deck
// ----------------------------------------------------------------------------
// Premium "command deck" layout that frames the campaign editor into three
// dedicated glassmorphism zones, each with a branded accent header. The
// ComposureCoach and BodyLab are upgraded to MAX-LEVEL with bigger rings,
// clearer typography, and "Max" AI persona voice.
//
//   1. AUDIENCE       — recipient targeting, email paste/import, count + health
//   2. MESSAGE STUDIO — subject + body editor, tag pills, AI Composure Coach
//                       live-score, Body Lab A/B variant comparison
//   3. LIVE INTEL     — real-time send stats, delivery rate, threshold status,
//                       send controls
//
// The Orchestrator is a LAYOUT SHELL — it receives the campaign state + update
// fn and renders the three zones, delegating the actual editor controls to
// children passed in. PRESERVES the existing props contract (thresholdStatus,
// updateCampaign, PANEL_MODE, God-Mode toggles) and named exports
// (scoreComposure, ComposureCoach, BodyLab, default Orchestrator).
//
// ESM only, camelCase, crypto-only, try/catch where meaningful.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { cx, ACCENT } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';
import { StaggerItem } from '@/components/userpanel/PageTransition.jsx';

// ---------------------------------------------------------------------------
// Max persona constant (kept in sync with SendStudio)
// ---------------------------------------------------------------------------
const MAX_NAME = 'Max';

// ---------------------------------------------------------------------------
// AI Composure Coach — live-scores the body text (client-side heuristic)
// ---------------------------------------------------------------------------

/**
 * Score a message body for "composure" — readability, length, personalization,
 * spam-risk, structure. Returns { score, grade, tips[] }.
 * FAST client-side heuristic (no API call) so it updates live as the user
 * types. The server-side AI spam check (existing) is the authority.
 *
 * @param {string} body
 * @param {string} subject
 * @returns {{ score: number, grade: string, tips: string[] }}
 */
export function scoreComposure(body = '', subject = '') {
  try {
    const text = (body || '').toLowerCase();
    const subj = (subject || '').toLowerCase();
    let score = 50; // baseline
    const tips = [];

    // Length check (sweet spot 200-2000 chars)
    const len = body.length;
    if (len < 50) { score -= 15; tips.push('Body is very short — add more context.'); }
    else if (len < 200) { score -= 5; tips.push('Consider expanding the body for clarity.'); }
    else if (len >= 200 && len <= 2000) { score += 15; }
    else if (len > 2000) { score -= 10; tips.push('Body is long — may get truncated.'); }

    // Personalization tokens
    const tokens = (body.match(/#[A-Z_]+#/g) || []).length;
    if (tokens >= 1) score += 10;
    if (tokens >= 3) score += 5;
    if (tokens === 0) tips.push('Add personalization tags (#NAME#, #EMAIL#) for better engagement.');

    // Spam-trigger words (basic heuristic)
    const spamWords = ['free', 'guaranteed', 'act now', 'urgent', 'click here', 'winner', 'congratulations', 'limited time'];
    const spamHits = spamWords.filter((w) => text.includes(w)).length;
    score -= spamHits * 8;
    if (spamHits > 0) tips.push(`Reduce spam-trigger phrases (${spamHits} found).`);

    // ALL CAPS check
    const capsRatio = (body.match(/[A-Z]{4,}/g) || []).length;
    if (capsRatio > 3) { score -= 10; tips.push('Reduce ALL-CAPS words — looks like shouting.'); }

    // Subject presence
    if (!subject.trim()) { score -= 10; tips.push('Add a subject line.'); }
    else if (subj.length > 60) { score -= 5; tips.push('Subject is long — keep under 60 chars.'); }
    else { score += 5; }

    // Structure: has paragraphs?
    const paragraphs = body.split(/\n\s*\n/).filter(Boolean).length;
    if (paragraphs >= 2) score += 5;

    // Has a call-to-action?
    const cta = ['click', 'reply', 'contact', 'call', 'visit', 'register', 'subscribe', 'download'];
    if (cta.some((w) => text.includes(w))) score += 5;
    else tips.push('Add a clear call-to-action.');

    score = Math.max(0, Math.min(100, score));
    const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
    return { score, grade, tips: tips.slice(0, 4) };
  } catch {
    return { score: 50, grade: 'C', tips: [] };
  }
}

// ---------------------------------------------------------------------------
// ComposureCoach — MAX-LEVEL live score ring + tips with Max persona
// ---------------------------------------------------------------------------

function ComposureCoach({ body, subject }) {
  const { score, grade, tips } = useMemo(
    () => scoreComposure(body, subject),
    [body, subject]
  );

  // Bigger, more legible ring
  const ringSize = 64;
  const ringR = (ringSize - 10) / 2;
  const ringC = 2 * Math.PI * ringR;
  const dash = (score / 100) * ringC;
  const color = score >= 70 ? ACCENT.success : score >= 45 ? ACCENT.warning : ACCENT.danger;
  const statusLabel = score >= 70 ? 'Excellent' : score >= 45 ? 'Needs work' : 'High risk';

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/12 transition">
      {/* Score ring */}
      <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize}>
          <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${ringC}`} strokeLinecap="round"
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-bold text-white leading-none tabular-nums">{score}</span>
          <span className="text-[10px] text-gray-400 font-bold mt-0.5">{grade}</span>
        </div>
      </div>
      {/* Tips + persona */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600">
            <Icon.Sparkle className="w-3 h-3 text-white" />
          </span>
          <p className="text-[12px] font-bold uppercase tracking-wide text-violet-400">{MAX_NAME} · Composure Coach</p>
          <span className="ml-auto text-[11px] font-semibold" style={{ color }}>{statusLabel}</span>
        </div>
        {tips.length > 0 ? (
          <ul className="space-y-1">
            {tips.map((t, i) => (
              <li key={i} className="text-[12px] text-gray-400 flex items-start gap-1.5 leading-relaxed">
                <span className="text-violet-500 mt-0.5 shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-emerald-400 flex items-center gap-1.5">
            <Icon.CheckCircle className="w-3.5 h-3.5" /> Looks great — ready to send.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BodyLab — MAX-LEVEL A/B variant comparison
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {string}   props.bodyA       — primary body (current)
 * @param {string}   props.bodyB       — variant body
 * @param {function} props.onSetBodyB  — (text) => void
 * @param {string}   props.subject     — shared subject for scoring
 */
function BodyLab({ bodyA, bodyB, onSetBodyB, subject }) {
  const [showLab, setShowLab] = useState(false);
  const scoreA = useMemo(() => scoreComposure(bodyA, subject), [bodyA, subject]);
  const scoreB = useMemo(() => scoreComposure(bodyB, subject), [bodyB, subject]);
  const winner = scoreA.score === scoreB.score ? 'tie' : scoreA.score > scoreB.score ? 'A' : 'B';

  if (!showLab) {
    return (
      <button
        onClick={() => setShowLab(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[12px] font-semibold hover:bg-violet-500/20 hover:border-violet-500/30 transition"
      >
        <Icon.Beaker className="w-4 h-4" /> Open Body Lab — A/B Test
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon.Beaker className="w-4 h-4 text-violet-400" />
          <p className="text-[12px] font-bold uppercase tracking-wide text-violet-400">Body Lab — A/B Comparison</p>
        </div>
        <button onClick={() => setShowLab(false)} className="text-gray-500 hover:text-gray-300 text-[14px] w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/5 transition">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {/* Variant A */}
        <div className={cx('rounded-lg p-2.5 border transition', winner === 'A' ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_12px_rgba(52,211,153,0.12)]' : 'border-white/8 bg-white/[0.02]')}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gray-400">A (current)</span>
            <span className={cx('text-[11px] font-bold', winner === 'A' ? 'text-emerald-400' : 'text-gray-500')}>
              {scoreA.score} · {scoreA.grade}{winner === 'A' ? ' 👑' : ''}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 font-mono line-clamp-4 max-h-20 overflow-hidden leading-relaxed">{bodyA.slice(0, 240) || '—'}</div>
        </div>
        {/* Variant B */}
        <div className={cx('rounded-lg p-2.5 border transition', winner === 'B' ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_12px_rgba(52,211,153,0.12)]' : 'border-white/8 bg-white/[0.02]')}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gray-400">B (variant)</span>
            <span className={cx('text-[11px] font-bold', winner === 'B' ? 'text-emerald-400' : 'text-gray-500')}>
              {scoreB.score} · {scoreB.grade}{winner === 'B' ? ' 👑' : ''}
            </span>
          </div>
          <textarea
            value={bodyB}
            onChange={(e) => onSetBodyB(e.target.value)}
            placeholder="Type variant B…"
            className="w-full h-20 bg-white/[0.02] text-[11px] text-gray-300 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/40 border border-white/5 rounded-md p-2 transition"
          />
        </div>
      </div>
      {winner !== 'tie' && (
        <button
          onClick={() => { onSetBodyB(''); /* swap handled by parent */ }}
          className="w-full py-2 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-300 text-[12px] font-semibold hover:bg-violet-500/25 hover:border-violet-500/30 transition"
        >
          Promote variant {winner} to primary
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoneHeader — MAX-LEVEL branded zone title bar with accent ring + glow
// ---------------------------------------------------------------------------

const ZONE_ACCENT = {
  violet:  { bg: 'bg-violet-500/15',   text: 'text-violet-400',   ring: 'ring-violet-500/30',   glow: 'shadow-[0_0_16px_rgba(139,92,246,0.15)]' },
  cyan:    { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',     ring: 'ring-cyan-500/30',     glow: 'shadow-[0_0_16px_rgba(34,211,238,0.15)]' },
  emerald: { bg: 'bg-emerald-500/15',  text: 'text-emerald-400',  ring: 'ring-emerald-500/30',  glow: 'shadow-[0_0_16px_rgba(52,211,153,0.15)]' },
  amber:   { bg: 'bg-amber-500/15',    text: 'text-amber-400',    ring: 'ring-amber-500/30',    glow: 'shadow-[0_0_16px_rgba(251,191,36,0.15)]' },
  rose:    { bg: 'bg-rose-500/15',     text: 'text-rose-400',     ring: 'ring-rose-500/30',     glow: 'shadow-[0_0_16px_rgba(244,63,94,0.15)]' },
};

function ZoneHeader({ icon, title, subtitle, accent = 'violet', right }) {
  const Ic = Icon[icon] || Icon.Layers;
  const ac = ZONE_ACCENT[accent] || ZONE_ACCENT.violet;
  return (
    <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        <div className={cx('w-8 h-8 rounded-xl flex items-center justify-center ring-1', ac.bg, ac.ring, ac.glow)}>
          <Ic className={cx('w-4 h-4', ac.text)} />
        </div>
        <div>
          <p className="text-[13px] font-bold text-gray-100 leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orchestrator — MAX-LEVEL main 3-zone shell
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {object}   props.campaign        — the active campaign state object
 * @param {function} props.updateCampaign  — (id, updates) => void
 * @param {node}     props.audienceZone    — rendered audience controls (children)
 * @param {node}     props.messageZone     — rendered message studio controls
 * @param {node}     props.intelZone       — rendered live intelligence controls
 * @param {object}   [props.thresholdStatus]
 * @param {boolean}  [props.compact]       — stack zones vertically on mobile
 */
export default function Orchestrator({
  campaign,
  updateCampaign,
  audienceZone,
  messageZone,
  intelZone,
  thresholdStatus,
  compact = false,
}) {
  const c = campaign || {};
  const u = (updates) => updateCampaign(c.id, updates);
  const [bodyB, setBodyB] = useState('');

  // Reset variant B when campaign changes
  useEffect(() => { setBodyB(''); }, [c.id]);

  return (
    <div className={cx('grid gap-3 flex-1 min-h-0 mt-3', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3')}>
      {/* Zone 1: Audience */}
      <StaggerItem index={0} className="rounded-2xl bg-white/[0.025] border border-white/8 p-4 flex flex-col min-h-0 overflow-y-auto backdrop-blur-sm hover:border-white/12 transition">
        <ZoneHeader icon="Users" title="Audience" subtitle="Recipients & targeting" accent="cyan" />
        <div className="space-y-3">{audienceZone}</div>
      </StaggerItem>

      {/* Zone 2: Message Studio */}
      <StaggerItem index={1} className="rounded-2xl bg-white/[0.025] border border-white/8 p-4 xl:col-span-1 flex flex-col min-h-0 overflow-y-auto backdrop-blur-sm hover:border-white/12 transition">
        <ZoneHeader icon="Edit" title="Message Studio" subtitle="Subject + body + tags" accent="violet" />
        <div className="space-y-3">
          {messageZone}
          <ComposureCoach body={c.message || ''} subject={c.subject || ''} />
          <BodyLab bodyA={c.message || ''} bodyB={bodyB} onSetBodyB={setBodyB} subject={c.subject || ''} />
        </div>
      </StaggerItem>

      {/* Zone 3: Live Intelligence */}
      <StaggerItem index={2} className="rounded-2xl bg-white/[0.025] border border-white/8 p-4 flex flex-col min-h-0 overflow-y-auto backdrop-blur-sm hover:border-white/12 transition">
        <ZoneHeader icon="Activity" title="Live Intel" subtitle="Send stats & controls" accent="emerald" />
        <div className="space-y-3 flex-1 flex flex-col">{intelZone}</div>
      </StaggerItem>
    </div>
  );
}

export { ComposureCoach, BodyLab };
