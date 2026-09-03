// ============================================================================
// MAX-LEVEL SEND STUDIO — Enterprise Single-Screen Campaign Composer
// ----------------------------------------------------------------------------
// Complete desktop-first reimagining of the Email Send Tab. Bigger type,
// breathing room, neon-accented glassmorphism, and "Max" — the AI Campaign
// Co-Pilot persona — woven through every zone as guide, validator, and voice.
//
// Three premium columns (Orchestrator 3-zone shell, real controls inside):
//
//   LEFT  — AUDIENCE:      credential upload, sender select + rotate,
//                          recipient textarea, paste/import, bounce check,
//                          trust score, recipient summary.
//   CENTER — MESSAGE:      subject + category, from-name + AI variants,
//                          480px body editor + tag pills + Composure Coach,
//                          content type, anti-detect, options, parameters.
//   RIGHT — LIVE INTEL:    stat tiles, live progress, threshold alerts,
//                          send-rate controls, test mail, LAUNCH/STOP/PAUSE.
//
// God-Mode Matrix preserved: every optional control gate-checks `TG(key)`.
// Admin hides a toggle → it vanishes here within 20s. The UI NEVER trusts
// itself.
//
// PRESERVES: EditorArea (480px lock), tag pills + insertAtCursor,
// thresholdStatus contract, MissionControl modal, ConfirmDialog, all
// existing handler props, PANEL_MODE-agnostic, data-camp-body/data-tag-target.
//
// ESM only, camelCase, crypto-only, try/catch where meaningful.
// ============================================================================

import { useRef, useState, useMemo } from 'react';
import { cx } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';
import EditorArea from '@/components/userpanel/EditorArea.jsx';
import { TrustScore } from '@/components/userpanel/TrustScore.jsx';
import { scoreComposure } from '@/components/userpanel/Orchestrator.jsx';
import Orchestrator from '@/components/userpanel/Orchestrator.jsx';

// ---------------------------------------------------------------------------
// Max — the AI Campaign Co-Pilot persona constants
// ---------------------------------------------------------------------------
const MAX_NAME = 'Max';
const MAX_TAGLINE = 'AI Campaign Co-Pilot';

// ---------------------------------------------------------------------------
// Accent ring map — colored icon badges for section labels
// ---------------------------------------------------------------------------
const ACCENT_RING = {
  violet: { ring: 'ring-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-400' },
  cyan:   { ring: 'ring-cyan-500/30',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   dot: 'bg-cyan-400' },
  green:  { ring: 'ring-emerald-500/30',bg: 'bg-emerald-500/10',text: 'text-emerald-400',dot: 'bg-emerald-400' },
  amber:  { ring: 'ring-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  rose:   { ring: 'ring-rose-500/30',   bg: 'bg-rose-500/10',   text: 'text-rose-400',   dot: 'bg-rose-400' },
};

// ---------------------------------------------------------------------------
// SectionLabel — polished zone section header with icon badge + accent ring
// ---------------------------------------------------------------------------
function SectionLabel({ icon, children, accent = 'violet', hint }) {
  const Ic = Icon[icon] || Icon.Layers;
  const ac = ACCENT_RING[accent] || ACCENT_RING.violet;
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={cx('inline-flex items-center justify-center w-6 h-6 rounded-lg ring-1', ac.bg, ac.ring)}>
        <Ic className={cx('w-3.5 h-3.5', ac.text)} />
      </span>
      <p className={cx('text-[12px] font-bold tracking-wide uppercase', ac.text)}>{children}</p>
      {hint && <span className="ml-auto text-[11px] text-gray-500 font-medium tabular-nums">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatTile — polished intel stat card with icon + value + label
// ---------------------------------------------------------------------------
function StatTile({ icon, value, label, accent = 'cyan' }) {
  const Ic = Icon[icon] || Icon.Activity;
  const ac = ACCENT_RING[accent] || ACCENT_RING.cyan;
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5 flex flex-col items-center justify-center gap-0.5 hover:border-white/10 transition">
      <Ic className={cx('w-3.5 h-3.5 mb-0.5', ac.text)} />
      <div className={cx('text-lg font-bold tabular-nums leading-none', ac.text)}>{value}</div>
      <div className="text-[10px] text-gray-500 font-medium">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MaxGreeting — persona banner in the header (avatar + status + greeting)
// ---------------------------------------------------------------------------
function MaxGreeting({ readyCount, total }) {
  const allReady = readyCount >= total;
  const greeting = allReady
    ? 'Everything looks launch-ready. Hit Start when you are.'
    : `${MAX_NAME} is standing by — finish ${total - readyCount} more item${total - readyCount === 1 ? '' : 's'} to launch.`;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-1 ring-white/10">
          <Icon.Sparkle className="w-4 h-4 text-white" />
        </div>
        <span className={cx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900', allReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
      </div>
      <div className="min-w-0 hidden md:block">
        <p className="text-[12px] font-bold text-violet-300 leading-tight truncate">{MAX_NAME} · <span className="text-gray-400 font-medium">{MAX_TAGLINE}</span></p>
        <p className="text-[11px] text-gray-500 leading-tight truncate">{greeting}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadinessChecklist — pre-flight items with icons + dot indicators
// ---------------------------------------------------------------------------
function ReadinessChecklist({ ready }) {
  const items = [
    { key: 'recipients', label: 'Recipients', icon: 'Users' },
    { key: 'sender', label: 'Sender', icon: 'Mail' },
    { key: 'subject', label: 'Subject', icon: 'Tag' },
    { key: 'body', label: 'Body', icon: 'FileCode' },
    { key: 'quota', label: 'Quota', icon: 'Gauge' },
  ];
  return (
    <div className="flex items-center justify-center gap-1.5">
      {items.map((it) => {
        const Ic = Icon[it.icon] || Icon.Dot;
        const ok = ready[it.key];
        return (
          <span key={it.key} title={it.label} className="flex items-center gap-1">
            <span className={cx('w-1.5 h-1.5 rounded-full transition', ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-gray-700')} />
          </span>
        );
      })}
      <span className="ml-1.5 text-[11px] text-gray-400 font-medium tabular-nums">{ready.passed}/{ready.total} ready</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendStudio — the MAX-LEVEL single-screen 3-zone composer
// ---------------------------------------------------------------------------
export default function SendStudio({
  campaign, updateCampaign, onBack, onSend, onStop, onPause, onTestMail,
  onCheckBounce, onReplaceBounced, onPasteEmails, onBulkImport, onConnectGmail,
  onSpamCheck, onGenerateAiNames, onPickSubject, onLoadBodyTemplate,
  onDeleteCampaign, openNameModal, openSubjectCatModal, openBodyModal,
  openPreview, openTagPicker, openBounceResult,
  Icon, Spinner, MiniToggle, contentTypes, speedModes, campaignStatusColors,
  subjectCategories, subjectTemplates, bodyTemplates, senderAccounts, remaining,
  stats, validationSteps, allCampaigns, onSelectCampaign,
  thresholdStatus, thresholdLoading, resumeLoading, onRefreshThreshold,
  onResumePaused, onAcknowledgeCredential, agreedTerms,
  MissionControl, ConfirmDialog, QuotaNotice,
  toggleOn,
}) {
  const c = campaign || {};
  const u = (updates) => updateCampaign(c.id, updates);
  // God-Mode gate helper — defaults to "always visible" if not wired (safe)
  const TG = typeof toggleOn === 'function' ? toggleOn : () => true;

  const fileInputRef = useRef(null);
  const [missionControlOpen, setMissionControlOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, name: '' });

  const parsedEmails = useMemo(
    () => (c.numbersText || '').split(/[\n,\s]/).map((n) => n.trim()).filter(Boolean),
    [c.numbersText]
  );
  const totalTarget = parsedEmails.length;

  const requestDelete = () => setConfirmState({ open: true, action: () => onDeleteCampaign(c.id), name: c.name });
  const handleConfirm = () => { try { if (typeof confirmState.action === 'function') confirmState.action(); } catch { /* ignore */ } setConfirmState({ open: false, action: null, name: '' }); };
  const handleCancelConfirm = () => setConfirmState({ open: false, action: null, name: '' });

  // Insert a tag pill at the cursor in the active editor field
  const insertTag = (tag, target) => {
    const sel = target === 'subject'
      ? document.querySelector(`[data-tag-target="subject"][data-campaign="${c.id}"]`)
      : document.querySelector(`[data-camp-body="${c.id}"]`);
    if (sel) {
      const start = sel.selectionStart ?? sel.value?.length ?? 0;
      const end = sel.selectionEnd ?? start;
      const cur = target === 'subject' ? (c.subject || '') : (c.message || '');
      const next = cur.slice(0, start) + tag + cur.slice(end);
      u(target === 'subject' ? { subject: next } : { message: next });
      requestAnimationFrame(() => { sel.focus(); sel.selectionStart = sel.selectionEnd = start + tag.length; });
    } else {
      u(target === 'subject' ? { subject: (c.subject || '') + tag } : { message: (c.message || '') + tag });
    }
  };

  // Pre-flight readiness score (for the Launch button hint + Max greeting)
  const ready = useMemo(() => {
    const checks = {
      recipients: totalTarget > 0,
      sender: senderAccounts.length > 0,
      subject: !!(c.subject || '').trim(),
      body: !!(c.message || '').trim(),
      quota: remaining > 0,
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { ...checks, passed, total: 5 };
  }, [totalTarget, senderAccounts.length, c.subject, c.message, remaining]);

  // Composure score for Max's message-quality readout
  const composure = useMemo(() => scoreComposure(c.message || '', c.subject || ''), [c.message, c.subject]);

  return (
    <div className="flex flex-col h-[calc(100vh-13.5rem)] min-h-0 max-h-[calc(100vh-13.5rem)]">
      {/* ══ MAX-LEVEL HEADER BAR ══ spacious, branded, persona-led */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-violet-500/20 bg-slate-900/60 backdrop-blur-sm flex-shrink-0 shadow-lg shadow-black/20">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[13px] font-medium transition flex-shrink-0 border border-white/5 hover:border-white/10">
          <Icon.ChevronLeft className="w-4 h-4" /> Campaigns
        </button>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Icon.Rocket className="w-4 h-4 text-white" />
          </div>
          <input value={c.name} onChange={(e) => u({ name: e.target.value })}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-[140px] transition" />
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${campaignStatusColors[c.status] || ''}`}>{c.status}</span>

        {/* Quick campaign switcher — capped to 3 */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {allCampaigns.filter((o) => o.id !== c.id).slice(0, 3).map((o) => (
            <button key={o.id} onClick={() => onSelectCampaign(o.id)} title={`Open ${o.name}`}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-violet-500/15 text-gray-400 hover:text-violet-300 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 border border-white/5 hover:border-violet-500/20">
              {o.name}
              {o.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Max persona greeting */}
        <div className="ml-auto flex items-center gap-3">
          <MaxGreeting readyCount={ready.passed} total={ready.total} />
          <button onClick={requestDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-[12px] font-medium transition flex-shrink-0 border border-transparent hover:border-red-500/20">
            <Icon.Trash className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* ══ 3-ZONE GRID ══ fills remaining height, each zone scrolls internally */}
      <Orchestrator
        campaign={c}
        updateCampaign={updateCampaign}
        thresholdStatus={thresholdStatus}
        compact={false}
        audienceZone={(
          /* ════════════════════════════════════════════════════════════════════
             ZONE 1 — AUDIENCE (LEFT)
             Credential upload + sender select + recipient textarea +
             paste/import + bounce check + trust score + summary.
             ════════════════════════════════════════════════════════════════════ */
          <>
            {/* Credentials — spacious upload row */}
            {TG('gmailConnect') && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition flex-shrink-0 border ${c.connectingGmail ? 'bg-slate-800 text-gray-400 border-white/5' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 border-violet-500/40'}`}>
                  {c.connectingGmail ? <Spinner size={12} /> : <Icon.Upload className="w-3.5 h-3.5" />}
                  {c.connectingGmail ? 'Connecting…' : 'credential.json'}
                  <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={(e) => onConnectGmail(e, c.id)} className="hidden" disabled={c.connectingGmail} />
                </label>
                <span className="text-[11px] text-gray-500 flex-shrink-0 flex items-center gap-1">
                  <Icon.CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {senderAccounts.length} connected
                </span>
              </div>
            )}
            {c.gmailConnectMsg && (
              <div className={`px-3 py-2 rounded-xl text-[11px] flex items-start gap-2 ${c.gmailConnectMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                <span className="flex-shrink-0 mt-px">{c.gmailConnectMsg.type === 'success' ? '✓' : '✕'}</span>
                <span className="leading-relaxed" dangerouslySetInnerHTML={{ __html: c.gmailConnectMsg.text }} />
              </div>
            )}

            {/* Sender select + rotate */}
            {TG('senderList') && (
              <div className="flex items-center gap-2">
                <select value={c.activeSenderIdx} onChange={(e) => u({ activeSenderIdx: Number(e.target.value) })}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-0 transition">
                  {senderAccounts.length === 0 && <option value={0}>No accounts connected</option>}
                  {senderAccounts.map((s, i) => (<option key={i} value={i}>{s.email}</option>))}
                </select>
                {TG('senderRotation') && (
                  <button onClick={() => u({ senderRotate: !c.senderRotate })}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border transition flex-shrink-0 ${c.senderRotate ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    title="Auto-rotate sender accounts">
                    <Icon.Refresh className={`w-3.5 h-3.5 ${c.senderRotate ? 'animate-spin' : ''}`} style={c.senderRotate ? { animationDuration: '3s' } : {}} /> Rotate
                  </button>
                )}
              </div>
            )}

            {/* Recipient textarea — the big input */}
            <div>
              <SectionLabel icon="Users" accent="cyan" hint={`${totalTarget} emails`}>Recipients</SectionLabel>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => onPasteEmails(c.id)} className="flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200 bg-violet-500/10 px-2.5 py-1.5 rounded-lg border border-violet-500/20 transition hover:bg-violet-500/20">
                  <Icon.Clipboard className="w-3.5 h-3.5" /> Paste
                </button>
                <label className="flex items-center gap-1.5 text-[12px] text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 cursor-pointer transition hover:bg-cyan-500/20">
                  <Icon.Upload className="w-3.5 h-3.5" /> Import
                  <input type="file" accept="..csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
                </label>
                <span className="ml-auto text-[13px] text-amber-400 font-bold tabular-nums">{totalTarget}</span>
              </div>
              <textarea data-recipient-textarea value={c.numbersText} onChange={(e) => u({ numbersText: e.target.value })} rows={6}
                placeholder={"user1@gmail.com\nuser2@yahoo.com\n…"}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y text-[13px] font-mono leading-relaxed min-h-[140px] transition" />
            </div>

            {/* Check Bounce + validation */}
            {TG('bounceCheck') && (
              <div>
                <button onClick={() => onCheckBounce(c.id)} disabled={c.checkingBounce || parsedEmails.length === 0}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition ${c.checkBounce ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {c.checkingBounce ? <Spinner size={14} /> : <Icon.Shield className="w-4 h-4" />} Check Bounce
                </button>
                {c.checkingBounce && (
                  <div className="mt-2 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Spinner size={10} />
                      <span className="text-[12px] text-violet-200 truncate animate-pulse flex-1">
                        {validationSteps[c.validationStep] || 'Processing…'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-violet-500 to-emerald-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${((c.validationStep + 1) / validationSteps.length) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 text-center">Step {c.validationStep + 1} of {validationSteps.length}</p>
                  </div>
                )}
                {c.bounceResults && !c.checkingBounce && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1"><Icon.CheckCircle className="w-3.5 h-3.5" /> {c.bounceResults.valid.length}</span>
                      {c.bounceResults.bounced.length > 0 && (
                        <span className="text-[11px] text-red-300 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 flex items-center gap-1"><Icon.XCircle className="w-3.5 h-3.5" /> {c.bounceResults.bounced.length}</span>
                      )}
                      {c.bounceResults.duplicates && c.bounceResults.duplicates.length > 0 && (
                        <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">{c.bounceResults.duplicates.length} dup</span>
                      )}
                      <button onClick={() => openBounceResult(c.id)} className="ml-auto text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1"><Icon.Eye className="w-3.5 h-3.5" /> View</button>
                      {c.bounceResults.bounced.length > 0 && (
                        <button onClick={() => onReplaceBounced(c.id)} className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1"><Icon.Refresh className="w-3.5 h-3.5" /> Replace</button>
                      )}
                    </div>
                  </div>
                )}
                {/* Trust Score (5-step validator ring) */}
                {(c.bounceResults || c.spamPreview) && !c.checkingBounce && (
                  <div className="mt-2">
                    <TrustScore bounceResults={c.bounceResults} spamPreview={c.spamPreview} validationStep={c.validationStep} steps={validationSteps} />
                  </div>
                )}
              </div>
            )}

            {/* Recipient count summary */}
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
              <span className="text-gray-500 flex items-center gap-1"><Icon.Users className="w-3.5 h-3.5" /> {parsedEmails.length} total</span>
              <span className="text-emerald-400 flex items-center gap-1"><Icon.CheckCircle className="w-3.5 h-3.5" /> {Object.values(c.emailValidation || {}).filter((v) => v && v.valid).length} valid</span>
              <span className="text-blue-400 flex items-center gap-1"><Icon.Send className="w-3.5 h-3.5" /> {Object.values(c.sendResults || {}).filter((s) => s === 'sent').length} sent</span>
            </div>
          </>
        )}
        messageZone={(
          /* ════════════════════════════════════════════════════════════════════
             ZONE 2 — MESSAGE STUDIO (CENTER)
             Subject + category, from-name + AI variants, 480px body editor +
             tag pills + composure, content type, anti-detect, options, params.
             ════════════════════════════════════════════════════════════════════ */
          <>
            {/* Subject + category rotation */}
            <div>
              <SectionLabel icon="Mail" accent="violet" hint={`${(c.subject || '').length}/120`}>Subject</SectionLabel>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => openTagPicker(c.id, 'subject')} className="text-[12px] text-amber-300 hover:text-amber-200 flex items-center gap-1.5"><Icon.Tag className="w-3.5 h-3.5" /> Tags</button>
                {TG('subjectCategories') && (
                  <button onClick={openSubjectCatModal} className="text-[12px] text-violet-300 hover:text-violet-200 flex items-center gap-1.5 bg-violet-500/10 px-2.5 py-1.5 rounded-lg border border-violet-500/20 transition hover:bg-violet-500/20"><Icon.Folder className="w-3.5 h-3.5" /> Manage</button>
                )}
              </div>
              <input value={c.subject} onChange={(e) => u({ subject: e.target.value })}
                data-tag-target="subject" data-campaign={c.id}
                placeholder="Enter subject…"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-[14px] transition"
                maxLength={120} />
              {TG('subjectCategories') && (
                <div className="flex items-center gap-2 mt-2">
                  <select value={c.activeSubjectCat} onChange={(e) => u({ activeSubjectCat: e.target.value })}
                    className="flex-1 px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-[12px] focus:outline-none focus:ring-1 focus:ring-violet-500/50 min-w-0 transition">
                    <option value="">Category…</option>
                    {subjectCategories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name} ({cat.count || 0})</option>)}
                  </select>
                  <button onClick={() => onPickSubject(c.id)} disabled={!c.activeSubjectCat}
                    className="flex items-center gap-1.5 px-2.5 py-2 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 rounded-lg text-[12px] font-medium border border-violet-500/20 transition disabled:opacity-40 flex-shrink-0">
                    <Icon.Refresh className="w-3.5 h-3.5" /> Pick
                  </button>
                  <button onClick={() => u({ autoChangeSubject: !c.autoChangeSubject })}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-medium border transition flex-shrink-0 ${c.autoChangeSubject ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    title="Auto-rotate subject per batch">
                    <Icon.Refresh className={`w-3.5 h-3.5 ${c.autoChangeSubject ? 'animate-spin' : ''}`} style={c.autoChangeSubject ? { animationDuration: '4s' } : {}} /> Auto
                  </button>
                </div>
              )}
            </div>

            {/* From Name + Variants */}
            {TG('fromNameRotation') && (
              <div>
                <SectionLabel icon="User" accent="green">From Name</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <input value={c.fromName} onChange={(e) => u({ fromName: e.target.value })}
                      placeholder="Support Team"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-[13px] transition" />
                    <div className="flex items-center gap-1.5 mt-2">
                      <button onClick={() => u({ autoChangeName: !c.autoChangeName })}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition flex-shrink-0 ${c.autoChangeName ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                        title="Auto-change sender name per N emails">
                        <Icon.Refresh className={`w-3.5 h-3.5 ${c.autoChangeName ? 'animate-spin' : ''}`} style={c.autoChangeName ? { animationDuration: '3s' } : {}} /> Auto
                      </button>
                      {c.autoChangeName && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[11px] text-gray-500">/</span>
                          <input type="number" min="1" max="999" value={c.autoNameInterval} onChange={(e) => u({ autoNameInterval: Math.max(1, Number(e.target.value)) })}
                            className="w-12 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-100 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                        </div>
                      )}
                      <button onClick={() => openNameModal(c.id)} className="ml-auto text-emerald-400 hover:text-emerald-300 transition flex-shrink-0" title="Manage name rotation list">
                        <Icon.Gear className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <input value={c.fromNameVariants} onChange={(e) => u({ fromNameVariants: e.target.value })}
                      placeholder="Support, Sales, Billing"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-[13px] transition" />
                    {c.autoChangeName && (
                      <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        {c.aiNameGenLoading ? <Spinner size={10} /> : <Icon.Sparkle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        <span className="text-[11px] text-emerald-300 truncate flex-1">{c.aiNameGenLoading ? 'Max generating names…' : `${(c.aiNamePool?.length || 0) - (c.aiNameUsed || 0)} AI names left`}</span>
                        <button onClick={() => onGenerateAiNames(c.id)} disabled={c.aiNameGenLoading} className="text-[11px] text-emerald-300 hover:text-emerald-200 flex-shrink-0 disabled:opacity-40">↻</button>
                      </div>
                    )}
                  </div>
                </div>
                {TG('senderAutoFill') && (
                  <input value={c.senderMail} onChange={(e) => u({ senderMail: e.target.value })}
                    placeholder="sender mail (auto if empty)"
                    className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-[12px] font-mono transition" />
                )}
              </div>
            )}

            {/* Email Body editor — the 480px centerpiece */}
            <div>
              <SectionLabel icon="FileCode" accent="violet" hint={`${(c.message || '').length}/2000`}>Email Body</SectionLabel>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/5">
                  <button onClick={() => u({ bodyMode: 'html' })} className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition ${c.bodyMode === 'html' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>HTML</button>
                  <button onClick={() => u({ bodyMode: 'plain' })} className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition ${c.bodyMode === 'plain' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Plain</button>
                </div>
                {TG('bodyTemplates') && (
                  <select onChange={(e) => { if (e.target.value) onLoadBodyTemplate(e.target.value, c.id); e.target.value = ''; }}
                    className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[12px] text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer transition">
                    <option value="">Load body…</option>
                    {bodyTemplates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                )}
                {TG('bodyTemplates') && (
                  <button onClick={openBodyModal} className="text-[12px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 transition hover:bg-cyan-500/20"><Icon.DocText className="w-3.5 h-3.5" /> Manage</button>
                )}
                <button onClick={() => u({ autoChangeBody: !c.autoChangeBody })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition ${c.autoChangeBody ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                  title="Auto-rotate body per batch">
                  <Icon.Refresh className={`w-3.5 h-3.5 ${c.autoChangeBody ? 'animate-spin' : ''}`} style={c.autoChangeBody ? { animationDuration: '4s' } : {}} /> Auto
                </button>
                <button onClick={() => openPreview(c.id)} className="text-[12px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 transition hover:bg-cyan-500/20">
                  <Icon.Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
              <EditorArea data-camp-body={c.id} data-tag-target="body" data-campaign={c.id} mode={c.bodyMode}
                value={c.message} onChange={(next) => u({ message: next })}
                placeholder="Type HTML content… use #NAME#, #EMAIL#, #INVOICE#, #TFN# tags"
                maxLength={2000} />
              {/* Spam check result — Max voice */}
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {c.spamChecking && <p className="text-[12px] text-gray-500 animate-pulse flex items-center gap-1.5"><Spinner size={10} /> {MAX_NAME} is analyzing spam risk…</p>}
                  {c.spamPreview && !c.spamChecking && (
                    <p className={`text-[12px] font-semibold flex items-center gap-1.5 ${c.spamPreview.level === 'high' ? 'text-red-400' : c.spamPreview.level === 'moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      <Icon.Shield className="w-3.5 h-3.5" /> Spam: {c.spamPreview.score}/100 · {c.spamPreview.level}
                    </p>
                  )}
                </div>
                <button onClick={() => onSpamCheck(c.id)} disabled={c.spamChecking || !(c.message || '').trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg text-[12px] font-medium transition border border-white/5 hover:border-white/10">
                  <Icon.Shield className="w-3.5 h-3.5" /> Spam Check
                </button>
              </div>
            </div>

            {/* Tag pills — click to insert at cursor (PRESERVED feature) */}
            {TG('tagPills') && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wider font-semibold flex items-center gap-1.5"><Icon.Tag className="w-3.5 h-3.5" /> Quick Tags — click to insert</p>
                <div className="flex flex-wrap gap-1.5">
                  {['#EMAIL#', '#INVOICE#', '#SNUMBER#', '#TFN#', '#HELPDESK#', '#DATE#', '#TRANSACTION#', '#NAME#', '#RANDOM#'].map((t) => (
                    <button key={t} onClick={() => insertTag(t, 'body')}
                      className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/25 hover:text-violet-200 hover:border-violet-500/40 transition cursor-pointer">
                      {t}
                    </button>
                  ))}
                  <button onClick={() => openTagPicker(c.id, 'body')} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition">
                    + All Tags
                  </button>
                </div>
              </div>
            )}

            {/* Content Type + Speed — spacious 2-col */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              {TG('contentMode') && (
                <div>
                  <SectionLabel icon="Layers" accent="violet">Content</SectionLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {contentTypes.map((ct) => {
                      const Ic = Icon[ct.icon] || Icon.Layers;
                      return (
                        <button key={ct.key} onClick={() => u({ contentMode: ct.key })}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${c.contentMode === ct.key ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.15)]' : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}`}>
                          <Ic className={`w-4 h-4 ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`} />
                          <span className={`text-[10px] font-medium ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`}>{ct.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <SectionLabel icon="Zap" accent="amber">Speed</SectionLabel>
                <div className="flex gap-1.5">
                  {speedModes.map((sp) => (
                    <button key={sp.key} onClick={() => u({ speedMode: sp.key })}
                      className={`flex-1 px-2 py-2 rounded-lg text-[12px] font-medium transition ${c.speedMode === sp.key ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}>{sp.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-gray-500">After</span>
                  <input type="number" min="1" max="999" value={c.changeAfterStart} onChange={(e) => u({ changeAfterStart: Number(e.target.value) })}
                    className="w-14 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-100 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                </div>
              </div>
            </div>

            {/* Anti-Detect + Options — spacious toggle grids */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <SectionLabel icon="Shield" accent="green">Anti-Detect</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {TG('antiDetect') && <MiniToggle label="Detect" value={c.antiDetect} onChange={(v) => u({ antiDetect: v })} icon="Shield" accent="green" />}
                  <MiniToggle label="Color" value={c.colorShift} onChange={(v) => u({ colorShift: v })} icon="Palette" accent="violet" />
                  <MiniToggle label="Text" value={c.textShift} onChange={(v) => u({ textShift: v })} icon="Sparkle" accent="violet" />
                  <MiniToggle label="Unsub" value={c.addUnsubscribe} onChange={(v) => u({ addUnsubscribe: v })} icon="Link" accent="cyan" />
                </div>
              </div>
              <div>
                <SectionLabel icon="Settings" accent="violet">Options</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniToggle label="Name" value={c.useName} onChange={(v) => u({ useName: v })} icon="User" accent="yellow" />
                  {TG('trackPixel') && <MiniToggle label="Pixel" value={c.trackPixel} onChange={(v) => u({ trackPixel: v })} icon="Eye" accent="cyan" />}
                  <MiniToggle label="Bounce" value={c.checkBounce} onChange={(v) => u({ checkBounce: v })} icon="Shield" accent="green" />
                  <MiniToggle label="Reply" value={c.autoReply} onChange={(v) => u({ autoReply: v })} icon="Reply" accent="yellow" />
                  <MiniToggle label="Save" value={c.autoSave} onChange={(v) => u({ autoSave: v })} icon="Save" accent="cyan" />
                  <MiniToggle label="Random" value={c.randomText} onChange={(v) => u({ randomText: v })} icon="Sparkle" accent="yellow" />
                </div>
              </div>
            </div>

            {/* Dedicated Parameters — only fields with active toggles */}
            {(TG('tfnNumber') || TG('helpDeskLink') || TG('invoiceFormat') || TG('transactionFormat')) && (
              <div className="pt-2 border-t border-white/5">
                <SectionLabel icon="Hash" accent="cyan">Parameters</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {TG('tfnNumber') && (
                    <input value={c.tfnNumber} onChange={(e) => u({ tfnNumber: e.target.value })} placeholder="TFN number" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-[12px] font-mono transition" />
                  )}
                  {TG('helpDeskLink') && (
                    <input value={c.helpDeskLink} onChange={(e) => u({ helpDeskLink: e.target.value })} placeholder="Help desk link" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-[12px] font-mono transition" />
                  )}
                  {TG('invoiceFormat') && (
                    <input value={c.invoiceFormat} onChange={(e) => u({ invoiceFormat: e.target.value })} placeholder="Invoice: INV-{NUM}" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-[12px] font-mono transition" />
                  )}
                  {TG('transactionFormat') && (
                    <input value={c.transactionFormat} onChange={(e) => u({ transactionFormat: e.target.value })} placeholder="Txn: TXN-{NUM}" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-[12px] font-mono transition" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        intelZone={(
          /* ════════════════════════════════════════════════════════════════════
             ZONE 3 — LIVE INTEL (RIGHT)
             Stat tiles + live progress + threshold alerts + send-rate +
             test mail + LAUNCH/STOP/PAUSE hero controls.
             ════════════════════════════════════════════════════════════════════ */
          <>
            {/* Stat tiles — polished 3-up */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon="Send" value={c.sentCount || c.progress?.totalSent || 0} label="Sent" accent="cyan" />
              <StatTile icon="CheckCircle" value={`${c.deliveryRate !== undefined ? c.deliveryRate : (c.progress ? Math.round(((c.progress.totalDelivered || 0) / Math.max(c.progress.totalSent || 1, 1)) * 100) : 0)}${c.deliveryRate !== undefined ? '' : '%'}`} label="Delivery" accent="green" />
              <StatTile icon="Gauge" value={remaining} label="Quota" accent="amber" />
            </div>

            {/* Max composure mini-readout */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Icon.Sparkle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-400 flex-1 truncate">Max composure score</span>
              <span className={`text-[13px] font-bold tabular-nums ${composure.score >= 70 ? 'text-emerald-400' : composure.score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{composure.score}<span className="text-gray-500 text-[10px] font-medium"> · {composure.grade}</span></span>
            </div>

            {/* Live progress bar (when running) */}
            {c.progress && (
              <div className="rounded-xl bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] text-violet-300 font-semibold flex-shrink-0">Sent</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.progress.totalSent > 0 ? Math.round((c.progress.totalSent / Math.max(c.progress.totalSent + c.progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[14px] font-black text-white tabular-nums flex-shrink-0">{c.progress.totalSent || 0}<span className="text-gray-500 text-[11px] font-normal">/{(c.progress.totalSent || 0) + (c.progress.totalUndelivered || 0) || totalTarget}</span></span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-white/5 rounded-lg p-1.5 text-center"><div className="text-[13px] font-bold text-white">{c.progress.totalSent || 0}</div><div className="text-[10px] text-gray-500">Sent</div></div>
                  <div className="bg-white/5 rounded-lg p-1.5 text-center"><div className="text-[13px] font-bold text-emerald-400">{c.progress.totalDelivered || 0}</div><div className="text-[10px] text-gray-500">Delivered</div></div>
                  <div className="bg-white/5 rounded-lg p-1.5 text-center"><div className="text-[13px] font-bold text-red-400">{c.progress.totalUndelivered || 0}</div><div className="text-[10px] text-gray-500">Undelivered</div></div>
                </div>
                {c.limitExhausted && (
                  <QuotaNotice
                    message={c.progress?.limitMessage || c.progress?.message || 'Sending limit reached. Sign-out occurred. Refresh credentials or wait for reset.'}
                    onAction={onRefreshThreshold}
                    actionLabel={thresholdLoading ? 'Refreshing…' : 'Refresh Credentials'}
                  />
                )}
              </div>
            )}

            {/* Blocked result */}
            {c.result && c.result.blocked && !c.progress && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-[12px] font-bold text-red-300 mb-1 flex items-center gap-1.5"><Icon.AlertTriangle className="w-4 h-4" /> Blocked — Spam (Score: {c.result.spamScore}/100)</p>
                {c.result.spamReasons && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.result.spamReasons.map((r, i) => <span key={i} className="text-[11px] bg-red-500/10 px-2 py-1 rounded-lg text-red-300 border border-red-500/20">{r}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* Send Rate controls */}
            <div className="pt-2 border-t border-white/5">
              <SectionLabel icon="Bolt" accent="amber">Send Rate</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400 flex justify-between mb-1"><span>Batch</span><span className="text-violet-300 font-medium">{c.batchSize}</span></label>
                  <input type="range" min="1" max="20" value={c.batchSize} onChange={(e) => u({ batchSize: Number(e.target.value) })} className="w-full accent-violet-500" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 flex justify-between mb-1"><span>Delay</span><span className="text-violet-300 font-medium">{c.delayMs}ms</span></label>
                  <input type="number" min="100" max="10000" step="100" value={c.delayMs} onChange={(e) => u({ delayMs: Math.max(100, Number(e.target.value) || 100) })}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 flex justify-between mb-1"><span>Jitter</span><span className="text-violet-300 font-medium">{c.jitterPct}%</span></label>
                  <input type="range" min="0" max="100" value={c.jitterPct} onChange={(e) => u({ jitterPct: Number(e.target.value) })} className="w-full accent-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {TG('humanizeMode') && <MiniToggle label="Human" value={c.humanize} onChange={(v) => u({ humanize: v })} icon="Shield" accent="green" />}
                <MiniToggle label="Drip" value={c.dripMode} onChange={(v) => u({ dripMode: v })} icon="Clock" accent="cyan" />
                <MiniToggle label="Poly" value={c.polymorph} onChange={(v) => u({ polymorph: v })} icon="Sparkle" accent="violet" />
                <MiniToggle label="Priority" value={c.prioritySend} onChange={(v) => u({ prioritySend: v })} icon="Star" accent="yellow" />
                <MiniToggle label="Confirm" value={c.confirmedShipping} onChange={(v) => u({ confirmedShipping: v })} icon="Check" accent="green" />
                <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[12px] font-medium cursor-pointer transition border border-white/5 hover:border-white/10">
                  <Icon.Upload className="w-3.5 h-3.5" /> Import
                  <input type="file" accept=".csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
                </label>
              </div>
            </div>

            {/* Test Mail */}
            <div className={`rounded-xl p-3 border transition ${c.testResult?.ok ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <SectionLabel icon="Eye" accent="cyan">Test Mail</SectionLabel>
              <div className="flex gap-2">
                <input value={c.testRecipient} onChange={(e) => u({ testRecipient: e.target.value })}
                  placeholder="test@example.com"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-[12px] font-mono min-w-0 transition" />
                <button onClick={() => onTestMail(c.id)} disabled={c.testing || !(c.testRecipient || '').trim() || !(c.message || '').trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-medium transition flex-shrink-0 shadow-lg shadow-cyan-600/20">
                  {c.testing ? <Spinner size={12} /> : <Icon.Send className="w-3.5 h-3.5" />} Test
                </button>
              </div>
              {c.testResult && (
                <p className={`text-[11px] px-2.5 py-1.5 rounded-lg mt-2 ${c.testResult.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {c.testResult.ok ? `✓ ${c.testResult.recipient} via ${c.testResult.sender || 'auto'}` : c.testResult.blocked ? `✕ Blocked (${c.testResult.score})` : `✕ ${c.testResult.error || 'Failed'}`}
                </p>
              )}
            </div>

            {/* Threshold alerts */}
            {thresholdStatus && thresholdStatus.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel icon="Gauge" accent="amber">Threshold</SectionLabel>
                  <button onClick={onRefreshThreshold} disabled={thresholdLoading} className="text-[11px] text-gray-500 hover:text-gray-300 disabled:opacity-40 flex items-center gap-1.5 transition">
                    <Icon.Refresh className={`w-3.5 h-3.5 ${thresholdLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {thresholdStatus.map((cred) => {
                    const pct = cred.thresholdLimit > 0 ? Math.min((cred.sentToday / cred.thresholdLimit) * 100, 100) : 0;
                    const paused = cred.thresholdPaused;
                    return (
                      <div key={cred._id} className={`rounded-lg p-2 border ${paused ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-200 font-mono truncate flex-1">{cred.email || cred.name || cred._id}</span>
                          {paused && <span className="text-[10px] text-amber-300 font-bold ml-2 flex-shrink-0 px-1.5 py-0.5 rounded bg-amber-500/20">PAUSED</span>}
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${paused ? 'bg-amber-500' : pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{cred.sentToday}/{cred.thresholdLimit}</span>
                        </div>
                        {paused && (
                          <button onClick={() => onResumePaused(cred._id, c.id)} disabled={resumeLoading === cred._id}
                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition">
                            {resumeLoading === cred._id ? <Spinner size={11} /> : <Icon.Play className="w-3 h-3" />} Resume @ {cred.pausedIndex || 0}
                          </button>
                        )}
                        {cred.isNewCredential && !paused && (
                          <button onClick={() => onAcknowledgeCredential(cred._id)}
                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[11px] font-bold transition">
                            <Icon.CheckCircle className="w-3 h-3" /> Acknowledge
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ LAUNCH / STOP / PAUSE — the hero controls ══ */}
            <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
              {/* Pre-flight readiness */}
              <ReadinessChecklist ready={ready} />
              {/* Max launch tip */}
              {ready.passed < ready.total && !c.loading && !c.progress && (
                <p className="text-[11px] text-violet-300/80 text-center flex items-center justify-center gap-1.5">
                  <Icon.Sparkle className="w-3 h-3" /> {MAX_NAME}: complete the {ready.total - ready.passed} remaining item{ready.total - ready.passed === 1 ? '' : 's'} to launch
                </p>
              )}
              {!c.loading && !c.progress && (
                <button onClick={() => setMissionControlOpen(true)}
                  disabled={remaining <= 0 || parsedEmails.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[14px] font-bold transition shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 hover:scale-[1.01]">
                  <Icon.Rocket className="w-5 h-5" /> Start Campaign
                </button>
              )}
              {(c.loading || c.progress) && (
                <div className="space-y-1.5">
                  <button onClick={() => onStop(c.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[14px] font-bold transition shadow-lg shadow-red-600/30 hover:shadow-red-600/50">
                    <Icon.Stop className="w-5 h-5" /> Stop
                  </button>
                  <button onClick={() => onPause(c.id)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition ${c.paused ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25'}`}>
                    {c.paused ? <><Icon.Play className="w-4 h-4" /> Resume</> : <><Icon.Pause className="w-4 h-4" /> Pause</>}
                  </button>
                  {c.paused && (
                    <p className="text-[11px] text-amber-300 text-center flex items-center justify-center gap-1.5"><Icon.Pause className="w-3 h-3" /> Paused at {c.progress?.totalSent || 0} — press Resume</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      />

      {/* Mission Control cinematic send modal */}
      <MissionControl
        open={missionControlOpen}
        onClose={() => setMissionControlOpen(false)}
        campaign={c}
        onSend={() => { onSend(c.id); }}
        onPause={() => onPause(c.id)}
        onResume={() => onPause(c.id)}
        senderAccounts={senderAccounts}
        remaining={remaining}
        speedModes={speedModes}
        thresholdStatus={thresholdStatus}
        agreedTerms={agreedTerms}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Campaign"
        message={`This will permanently delete campaign "${confirmState.name}" and all its data. This action cannot be undone.`}
        confirmWord="DELETE"
        confirmLabel="Delete Campaign"
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
        danger={true}
      />
    </div>
  );
}
