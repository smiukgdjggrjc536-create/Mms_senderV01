// ============================================================================
// V7 SEND STUDIO — God-Level Enterprise Single-Screen Campaign Composer
// ----------------------------------------------------------------------------
// Replaces the old cluttered CampaignEditor body. Everything fits on ONE
// 1080p desktop screen — no scrolling, no random buttons, no "habijabi".
//
// Three clean columns (the Orchestrator 3-zone shell, but with the REAL
// controls moved inside each zone instead of stat cards above a classic grid):
//
//   LEFT  — AUDIENCE:    credentials (compact), sender select, recipient
//                         textarea, paste/import, check bounce, trust score,
//                         recipient count summary.
//   CENTER — MESSAGE:     subject + category, from-name + variants, email body
//                         editor + tag pills + AI composure coach, content
//                         type, anti-detect, options, dedicated params.
//   RIGHT — LIVE INTEL:   status + sent/delivered, delivery rate, threshold
//                         alerts, send-rate controls, test mail, live progress,
//                         and the big LAUNCH / STOP / PAUSE controls.
//
// God-Mode Matrix: every optional control gate-checks `TG(key)` before
// rendering. Admin hides a toggle → it vanishes here within 20s. The UI
// NEVER trusts itself.
//
// PRESERVES: EditorArea (480px lock), tag pills + insertAtCursor,
// thresholdStatus contract, MissionControl modal, ConfirmDialog, all
// existing handler props, PANEL_MODE-agnostic.
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, try/catch, small modular,
// camelCase, crypto-only.
// ============================================================================

import { useRef, useState, useMemo } from 'react';
import { cx, SURFACE, ACCENT } from '@/lib/ui/theme.js';
import Icon from '@/components/userpanel/icons.jsx';
import EditorArea from '@/components/userpanel/EditorArea.jsx';
import { TrustScore } from '@/components/userpanel/TrustScore.jsx';
import { scoreComposure } from '@/components/userpanel/Orchestrator.jsx';
import Orchestrator from '@/components/userpanel/Orchestrator.jsx';

// ---------------------------------------------------------------------------
// Compact collapsible section header (saves vertical space on the screen)
// ---------------------------------------------------------------------------
function SectionLabel({ icon, children, accent = 'violet' }) {
  const Ic = Icon[icon] || Icon.Layers;
  const ac = {
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
  }[accent] || 'text-violet-400';
  return (
    <p className={`text-[9px] uppercase tracking-wider font-bold flex items-center gap-1 ${ac} mb-1`}>
      <Ic className="w-2.5 h-2.5" /> {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// SendStudio — the single-screen 3-zone composer
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

  // Pre-flight readiness score (for the Launch button hint)
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

  return (
    <div className="flex flex-col h-[calc(100vh-13.5rem)] min-h-0 max-h-[calc(100vh-13.5rem)]">
      {/* ── COMPACT HEADER BAR ── single row, no wrap clutter */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/20 bg-slate-900/50 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[11px] font-medium transition flex-shrink-0">
          <Icon.ChevronLeft className="w-3.5 h-3.5" /> Campaigns
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Icon.Rocket className="w-3.5 h-3.5 text-white" />
          </div>
          <input value={c.name} onChange={(e) => u({ name: e.target.value })}
            className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-100 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[120px]" />
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${campaignStatusColors[c.status] || ''}`}>{c.status}</span>

        {/* Quick campaign switcher — capped to 3 to avoid overflow */}
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {allCampaigns.filter((o) => o.id !== c.id).slice(0, 3).map((o) => (
            <button key={o.id} onClick={() => onSelectCampaign(o.id)} title={`Open ${o.name}`}
              className="px-2 py-1 bg-white/5 hover:bg-violet-500/15 text-gray-400 hover:text-violet-300 rounded-md text-[9px] font-medium transition flex items-center gap-1">
              {o.name}
              {o.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            </button>
          ))}
        </div>

        <button onClick={requestDelete}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md text-[10px] font-medium transition flex-shrink-0">
          <Icon.Trash className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {/* ── 3-ZONE GRID ── fills remaining height, each zone scrolls internally */}
      <Orchestrator
        campaign={c}
        updateCampaign={updateCampaign}
        thresholdStatus={thresholdStatus}
        compact={false}
        audienceZone={(
          /* ════════════════════════════════════════════════════════════════
             ZONE 1 — AUDIENCE (LEFT)
             Credentials (compact) + sender select + recipient textarea +
             paste/import + check bounce + trust score + count summary.
             ════════════════════════════════════════════════════════════════ */
          <>
            {/* Credentials — compact inline row, no big separate bar */}
            {TG('gmailConnect') && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <label className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition flex-shrink-0 ${c.connectingGmail ? 'bg-slate-700 text-gray-400' : 'bg-violet-600 hover:bg-violet-500 text-white shadow'}`}>
                  {c.connectingGmail ? <Spinner size={10} /> : <Icon.Upload className="w-3 h-3" />}
                  {c.connectingGmail ? '…' : 'credential.json'}
                  <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={(e) => onConnectGmail(e, c.id)} className="hidden" disabled={c.connectingGmail} />
                </label>
                <span className="text-[9px] text-gray-500 flex-shrink-0">{senderAccounts.length} connected</span>
              </div>
            )}
            {c.gmailConnectMsg && (
              <div className={`px-2 py-1 rounded-md text-[9px] flex items-start gap-1 ${c.gmailConnectMsg.type === 'success' ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                <span className="flex-shrink-0">{c.gmailConnectMsg.type === 'success' ? '✓' : '✕'}</span>
                <span className="leading-snug" dangerouslySetInnerHTML={{ __html: c.gmailConnectMsg.text }} />
              </div>
            )}

            {/* Sender select + rotate */}
            {TG('senderList') && (
              <div className="flex items-center gap-1.5">
                <select value={c.activeSenderIdx} onChange={(e) => u({ activeSenderIdx: Number(e.target.value) })}
                  className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-0">
                  {senderAccounts.length === 0 && <option value={0}>No accounts</option>}
                  {senderAccounts.map((s, i) => (<option key={i} value={i}>{s.email}</option>))}
                </select>
                {TG('senderRotation') && (
                  <button onClick={() => u({ senderRotate: !c.senderRotate })}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.senderRotate ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    title="Auto-rotate sender accounts">
                    <Icon.Refresh className={`w-2.5 h-2.5 ${c.senderRotate ? 'animate-spin' : ''}`} style={c.senderRotate ? { animationDuration: '3s' } : {}} /> Rotate
                  </button>
                )}
              </div>
            )}

            {/* Recipient textarea — the big input */}
            <div>
              <SectionLabel icon="Users" accent="cyan">Recipients</SectionLabel>
              <div className="flex items-center gap-1 mb-1">
                <button onClick={() => onPasteEmails(c.id)} className="flex items-center gap-0.5 text-[9px] text-violet-300 hover:text-violet-200 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20 transition">
                  <Icon.Clipboard className="w-2.5 h-2.5" /> Paste
                </button>
                <label className="flex items-center gap-0.5 text-[9px] text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20 cursor-pointer transition">
                  <Icon.Upload className="w-2.5 h-2.5" /> Import
                  <input type="file" accept=".csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
                </label>
                <span className="ml-auto text-[10px] text-amber-400 font-bold tabular-nums">{totalTarget}</span>
              </div>
              <textarea data-recipient-textarea value={c.numbersText} onChange={(e) => u({ numbersText: e.target.value })} rows={6}
                placeholder={"user1@gmail.com\nuser2@yahoo.com\n…"}
                className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y text-[10px] font-mono min-h-[120px]" />
            </div>

            {/* Check Bounce + validation */}
            {TG('bounceCheck') && (
              <div>
                <button onClick={() => onCheckBounce(c.id)} disabled={c.checkingBounce || parsedEmails.length === 0}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition ${c.checkBounce ? 'bg-green-600 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'} disabled:opacity-40`}>
                  {c.checkingBounce ? <Spinner size={12} /> : <Icon.Shield className="w-3.5 h-3.5" />} Check Bounce
                </button>
                {c.checkingBounce && (
                  <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Spinner size={9} />
                      <span className="text-[10px] text-violet-200 truncate animate-pulse flex-1">
                        {validationSteps[c.validationStep] || 'Processing…'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-gradient-to-r from-violet-500 to-green-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${((c.validationStep + 1) / validationSteps.length) * 100}%` }} />
                    </div>
                    <p className="text-[8px] text-gray-500 mt-0.5 text-center">Step {c.validationStep + 1} of {validationSteps.length}</p>
                  </div>
                )}
                {c.bounceResults && !c.checkingBounce && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] text-green-300 bg-green-500/10 px-1.5 py-0.5 rounded-md border border-green-500/20 flex items-center gap-1"><Icon.CheckCircle className="w-3 h-3" /> {c.bounceResults.valid.length}</span>
                      {c.bounceResults.bounced.length > 0 && (
                        <span className="text-[9px] text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20 flex items-center gap-1"><Icon.XCircle className="w-3 h-3" /> {c.bounceResults.bounced.length}</span>
                      )}
                      {c.bounceResults.duplicates && c.bounceResults.duplicates.length > 0 && (
                        <span className="text-[9px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">{c.bounceResults.duplicates.length} dup</span>
                      )}
                      <button onClick={() => openBounceResult(c.id)} className="ml-auto text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5"><Icon.Eye className="w-2.5 h-2.5" /> View</button>
                      {c.bounceResults.bounced.length > 0 && (
                        <button onClick={() => onReplaceBounced(c.id)} className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Refresh className="w-2.5 h-2.5" /> Replace</button>
                      )}
                    </div>
                  </div>
                )}
                {/* Trust Score (5-step validator ring) */}
                {(c.bounceResults || c.spamPreview) && !c.checkingBounce && (
                  <div className="mt-1.5">
                    <TrustScore bounceResults={c.bounceResults} spamPreview={c.spamPreview} validationStep={c.validationStep} steps={validationSteps} />
                  </div>
                )}
              </div>
            )}

            {/* Recipient count summary */}
            <div className="flex items-center justify-between text-[9px] pt-1 border-t border-white/5">
              <span className="text-gray-500">{parsedEmails.length} total</span>
              <span className="text-green-400">{Object.values(c.emailValidation || {}).filter((v) => v && v.valid).length} valid</span>
              <span className="text-blue-400">{Object.values(c.sendResults || {}).filter((s) => s === 'sent').length} sent</span>
            </div>
          </>
        )}
        messageZone={(
          /* ════════════════════════════════════════════════════════════════
             ZONE 2 — MESSAGE STUDIO (CENTER)
             Subject + category, from-name + variants, body editor + tag
             pills + composure coach, content type, anti-detect, options,
             dedicated params.
             ════════════════════════════════════════════════════════════════ */
          <>
            {/* Subject + category rotation */}
            <div>
              <SectionLabel icon="Mail" accent="violet">Subject</SectionLabel>
              <div className="flex items-center gap-1 mb-1">
                <button onClick={() => openTagPicker(c.id, 'subject')} className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Tag className="w-2.5 h-2.5" /> Tags</button>
                {TG('subjectCategories') && (
                  <button onClick={openSubjectCatModal} className="text-[9px] text-violet-300 hover:text-violet-200 flex items-center gap-0.5 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20 transition"><Icon.Folder className="w-2.5 h-2.5" /> Manage</button>
                )}
                <span className="ml-auto text-[8px] text-gray-600">{(c.subject || '').length}/120</span>
              </div>
              <input value={c.subject} onChange={(e) => u({ subject: e.target.value })}
                data-tag-target="subject" data-campaign={c.id}
                placeholder="Enter subject…"
                className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px]"
                maxLength={120} />
              {TG('subjectCategories') && (
                <div className="flex items-center gap-1 mt-1">
                  <select value={c.activeSubjectCat} onChange={(e) => u({ activeSubjectCat: e.target.value })}
                    className="flex-1 px-1.5 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300 text-[9px] focus:outline-none min-w-0">
                    <option value="">Category…</option>
                    {subjectCategories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name} ({cat.count || 0})</option>)}
                  </select>
                  <button onClick={() => onPickSubject(c.id)} disabled={!c.activeSubjectCat}
                    className="flex items-center gap-0.5 px-1.5 py-1 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 rounded-md text-[9px] font-medium border border-violet-500/20 transition disabled:opacity-40 flex-shrink-0">
                    <Icon.Refresh className="w-2.5 h-2.5" /> Pick
                  </button>
                  <button onClick={() => u({ autoChangeSubject: !c.autoChangeSubject })}
                    className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.autoChangeSubject ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    title="Auto-rotate subject per batch">
                    <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeSubject ? 'animate-spin' : ''}`} style={c.autoChangeSubject ? { animationDuration: '4s' } : {}} /> Auto
                  </button>
                </div>
              )}
            </div>

            {/* From Name + Variants */}
            {TG('fromNameRotation') && (
              <div>
                <SectionLabel icon="User" accent="green">From Name</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <input value={c.fromName} onChange={(e) => u({ fromName: e.target.value })}
                      placeholder="Support Team"
                      className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-[11px]" />
                    <div className="flex items-center gap-1 mt-1">
                      <button onClick={() => u({ autoChangeName: !c.autoChangeName })}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.autoChangeName ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                        title="Auto-change sender name per N emails">
                        <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeName ? 'animate-spin' : ''}`} style={c.autoChangeName ? { animationDuration: '3s' } : {}} /> Auto
                      </button>
                      {c.autoChangeName && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <span className="text-[8px] text-gray-500">/</span>
                          <input type="number" min="1" max="999" value={c.autoNameInterval} onChange={(e) => u({ autoNameInterval: Math.max(1, Number(e.target.value)) })}
                            className="w-10 px-1 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-green-500" />
                        </div>
                      )}
                      <button onClick={() => openNameModal(c.id)} className="ml-auto text-green-400 hover:text-green-300 transition flex-shrink-0" title="Manage name rotation list">
                        <Icon.Gear className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <input value={c.fromNameVariants} onChange={(e) => u({ fromNameVariants: e.target.value })}
                      placeholder="Support, Sales, Billing"
                      className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-[11px]" />
                    {c.autoChangeName && (
                      <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                        {c.aiNameGenLoading ? <Spinner size={8} /> : <Icon.Sparkle className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                        <span className="text-[8px] text-green-300 truncate flex-1">{c.aiNameGenLoading ? 'AI…' : `${(c.aiNamePool?.length || 0) - (c.aiNameUsed || 0)} AI`}</span>
                        <button onClick={() => onGenerateAiNames(c.id)} disabled={c.aiNameGenLoading} className="text-[8px] text-green-300 hover:text-green-200 flex-shrink-0 disabled:opacity-40">↻</button>
                      </div>
                    )}
                  </div>
                </div>
                {TG('senderAutoFill') && (
                  <input value={c.senderMail} onChange={(e) => u({ senderMail: e.target.value })}
                    placeholder="sender mail (auto if empty)"
                    className="w-full mt-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[10px] font-mono" />
                )}
              </div>
            )}

            {/* Email Body editor */}
            <div>
              <SectionLabel icon="FileCode" accent="violet">Email Body</SectionLabel>
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                <div className="flex gap-0.5 bg-white/5 rounded-md p-0.5">
                  <button onClick={() => u({ bodyMode: 'html' })} className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition ${c.bodyMode === 'html' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>HTML</button>
                  <button onClick={() => u({ bodyMode: 'plain' })} className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition ${c.bodyMode === 'plain' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>Plain</button>
                </div>
                {TG('bodyTemplates') && (
                  <select onChange={(e) => { if (e.target.value) onLoadBodyTemplate(e.target.value, c.id); e.target.value = ''; }}
                    className="px-1.5 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] text-gray-300 focus:outline-none cursor-pointer">
                    <option value="">Load body…</option>
                    {bodyTemplates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                )}
                {TG('bodyTemplates') && (
                  <button onClick={openBodyModal} className="text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20 transition"><Icon.DocText className="w-2.5 h-2.5" /> Manage</button>
                )}
                <button onClick={() => u({ autoChangeBody: !c.autoChangeBody })}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium border transition ${c.autoChangeBody ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                  title="Auto-rotate body per batch">
                  <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeBody ? 'animate-spin' : ''}`} style={c.autoChangeBody ? { animationDuration: '4s' } : {}} /> Auto
                </button>
                <button onClick={() => openPreview(c.id)} className="text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20 transition">
                  <Icon.Eye className="w-2.5 h-2.5" /> Preview
                </button>
              </div>
              <EditorArea data-camp-body={c.id} data-tag-target="body" data-campaign={c.id} mode={c.bodyMode}
                value={c.message} onChange={(next) => u({ message: next })}
                placeholder="Type HTML content… use #NAME#, #EMAIL#, #INVOICE#, #TFN# tags"
                maxLength={2000} />
              {/* Spam check result */}
              <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  {c.spamChecking && <p className="text-[9px] text-gray-500 animate-pulse flex items-center gap-0.5"><Spinner size={8} /> AI spam…</p>}
                  {c.spamPreview && !c.spamChecking && (
                    <p className={`text-[9px] font-semibold flex items-center gap-0.5 ${c.spamPreview.level === 'high' ? 'text-red-400' : c.spamPreview.level === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                      Spam: {c.spamPreview.score}/100 · {c.spamPreview.level}
                    </p>
                  )}
                </div>
                <button onClick={() => onSpamCheck(c.id)} disabled={c.spamChecking || !(c.message || '').trim()}
                  className="flex items-center gap-0.5 px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 rounded-md text-[9px] font-medium transition">
                  <Icon.Shield className="w-2.5 h-2.5" /> Spam Check
                </button>
              </div>
            </div>

            {/* Tag pills — click to insert at cursor (PRESERVED v4.0 feature) */}
            {TG('tagPills') && (
              <div className="pt-1 border-t border-white/5">
                <p className="text-[8px] text-gray-500 mb-1 uppercase tracking-wider">Quick Tags — click to insert</p>
                <div className="flex flex-wrap gap-1">
                  {['#EMAIL#', '#INVOICE#', '#SNUMBER#', '#TFN#', '#HELPDESK#', '#DATE#', '#TRANSACTION#', '#NAME#', '#RANDOM#'].map((t) => (
                    <button key={t} onClick={() => insertTag(t, 'body')}
                      className="px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/25 hover:text-violet-200 transition cursor-pointer">
                      {t}
                    </button>
                  ))}
                  <button onClick={() => openTagPicker(c.id, 'body')} className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 transition">
                    + All Tags
                  </button>
                </div>
              </div>
            )}

            {/* Content Type + Speed — compact 2-col */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              {TG('contentMode') && (
                <div>
                  <SectionLabel icon="Layers" accent="violet">Content</SectionLabel>
                  <div className="grid grid-cols-3 gap-0.5">
                    {contentTypes.map((ct) => {
                      const Ic = Icon[ct.icon] || Icon.Layers;
                      return (
                        <button key={ct.key} onClick={() => u({ contentMode: ct.key })}
                          className={`flex flex-col items-center gap-0.5 p-1 rounded-md border transition ${c.contentMode === ct.key ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}>
                          <Ic className={`w-3 h-3 ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`} />
                          <span className={`text-[8px] font-medium ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`}>{ct.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <SectionLabel icon="Zap" accent="amber">Speed</SectionLabel>
                <div className="flex gap-0.5">
                  {speedModes.map((sp) => (
                    <button key={sp.key} onClick={() => u({ speedMode: sp.key })}
                      className={`flex-1 px-1 py-1 rounded-md text-[9px] font-medium transition ${c.speedMode === sp.key ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{sp.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] text-gray-500">After</span>
                  <input type="number" min="1" max="999" value={c.changeAfterStart} onChange={(e) => u({ changeAfterStart: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
                </div>
              </div>
            </div>

            {/* Anti-Detect + Options — compact toggle grids */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <div>
                <SectionLabel icon="Shield" accent="green">Anti-Detect</SectionLabel>
                <div className="grid grid-cols-2 gap-1">
                  {TG('antiDetect') && <MiniToggle label="Detect" value={c.antiDetect} onChange={(v) => u({ antiDetect: v })} icon="Shield" accent="green" />}
                  <MiniToggle label="Color" value={c.colorShift} onChange={(v) => u({ colorShift: v })} icon="Palette" accent="violet" />
                  <MiniToggle label="Text" value={c.textShift} onChange={(v) => u({ textShift: v })} icon="Sparkle" accent="violet" />
                  <MiniToggle label="Unsub" value={c.addUnsubscribe} onChange={(v) => u({ addUnsubscribe: v })} icon="Link" accent="cyan" />
                </div>
              </div>
              <div>
                <SectionLabel icon="Settings" accent="violet">Options</SectionLabel>
                <div className="grid grid-cols-2 gap-1">
                  <MiniToggle label="Name" value={c.useName} onChange={(v) => u({ useName: v })} icon="User" accent="yellow" />
                  {TG('trackPixel') && <MiniToggle label="Pixel" value={c.trackPixel} onChange={(v) => u({ trackPixel: v })} icon="Eye" accent="cyan" />}
                  <MiniToggle label="Bounce" value={c.checkBounce} onChange={(v) => u({ checkBounce: v })} icon="Shield" accent="green" />
                  <MiniToggle label="Reply" value={c.autoReply} onChange={(v) => u({ autoReply: v })} icon="Reply" accent="yellow" />
                  <MiniToggle label="Save" value={c.autoSave} onChange={(v) => u({ autoSave: v })} icon="Save" accent="cyan" />
                  <MiniToggle label="Random" value={c.randomText} onChange={(v) => u({ randomText: v })} icon="Sparkle" accent="yellow" />
                </div>
              </div>
            </div>

            {/* Dedicated Parameters — only the fields with active toggles */}
            {(TG('tfnNumber') || TG('helpDeskLink') || TG('invoiceFormat') || TG('transactionFormat')) && (
              <div className="pt-1 border-t border-white/5">
                <SectionLabel icon="Hash" accent="cyan">Parameters</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {TG('tfnNumber') && (
                    <input value={c.tfnNumber} onChange={(e) => u({ tfnNumber: e.target.value })} placeholder="TFN number" className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[10px] font-mono" />
                  )}
                  {TG('helpDeskLink') && (
                    <input value={c.helpDeskLink} onChange={(e) => u({ helpDeskLink: e.target.value })} placeholder="Help desk link" className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[10px] font-mono" />
                  )}
                  {TG('invoiceFormat') && (
                    <input value={c.invoiceFormat} onChange={(e) => u({ invoiceFormat: e.target.value })} placeholder="Invoice: INV-{NUM}" className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[10px] font-mono" />
                  )}
                  {TG('transactionFormat') && (
                    <input value={c.transactionFormat} onChange={(e) => u({ transactionFormat: e.target.value })} placeholder="Txn: TXN-{NUM}" className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[10px] font-mono" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        intelZone={(
          /* ════════════════════════════════════════════════════════════════
             ZONE 3 — LIVE INTEL (RIGHT)
             Status + sent/delivered + delivery rate, threshold alerts,
             send-rate controls, test mail, live progress, LAUNCH/STOP/PAUSE.
             ════════════════════════════════════════════════════════════════ */
          <>
            {/* Stat strip — 3 mini cards */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-1.5 text-center">
                <div className="text-sm font-bold text-blue-400 tabular-nums">{c.sentCount || c.progress?.totalSent || 0}</div>
                <div className="text-[8px] text-gray-500">Sent</div>
              </div>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-1.5 text-center">
                <div className="text-sm font-bold text-emerald-400 tabular-nums">{c.deliveryRate || (c.progress ? Math.round(((c.progress.totalDelivered || 0) / Math.max(c.progress.totalSent || 1, 1)) * 100) : 0)}{c.deliveryRate !== undefined ? '' : '%'}</div>
                <div className="text-[8px] text-gray-500">Delivery</div>
              </div>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-1.5 text-center">
                <div className="text-sm font-bold text-amber-400 tabular-nums">{remaining}</div>
                <div className="text-[8px] text-gray-500">Quota</div>
              </div>
            </div>

            {/* Live progress bar (when running) */}
            {c.progress && (
              <div className="rounded-lg bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-violet-300 font-semibold flex-shrink-0">Sent</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.progress.totalSent > 0 ? Math.round((c.progress.totalSent / Math.max(c.progress.totalSent + c.progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-black text-white tabular-nums flex-shrink-0">{c.progress.totalSent || 0}<span className="text-gray-500 text-[9px] font-normal">/{(c.progress.totalSent || 0) + (c.progress.totalUndelivered || 0) || totalTarget}</span></span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-[10px] font-bold text-white">{c.progress.totalSent || 0}</div><div className="text-[7px] text-gray-500">Sent</div></div>
                  <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-[10px] font-bold text-green-400">{c.progress.totalDelivered || 0}</div><div className="text-[7px] text-gray-500">Deliv.</div></div>
                  <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-[10px] font-bold text-red-400">{c.progress.totalUndelivered || 0}</div><div className="text-[7px] text-gray-500">Undel.</div></div>
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
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-[10px] font-bold text-red-300 mb-0.5">⚠ Blocked — Spam (Score: {c.result.spamScore}/100)</p>
                {c.result.spamReasons && (
                  <div className="flex flex-wrap gap-1">
                    {c.result.spamReasons.map((r, i) => <span key={i} className="text-[8px] bg-red-500/10 px-1.5 py-0.5 rounded text-red-300">{r}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* Send Rate controls */}
            <div className="pt-1 border-t border-white/5">
              <SectionLabel icon="Bolt" accent="amber">Send Rate</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Batch</span><span className="text-violet-300 font-medium">{c.batchSize}</span></label>
                  <input type="range" min="1" max="20" value={c.batchSize} onChange={(e) => u({ batchSize: Number(e.target.value) })} className="w-full accent-violet-500 mt-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Delay</span><span className="text-violet-300 font-medium">{c.delayMs}ms</span></label>
                  <input type="number" min="100" max="10000" step="100" value={c.delayMs} onChange={(e) => u({ delayMs: Math.max(100, Number(e.target.value) || 100) })}
                    className="w-full px-1 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 mt-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Jitter</span><span className="text-violet-300 font-medium">{c.jitterPct}%</span></label>
                  <input type="range" min="0" max="100" value={c.jitterPct} onChange={(e) => u({ jitterPct: Number(e.target.value) })} className="w-full accent-violet-500 mt-0.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1.5">
                {TG('humanizeMode') && <MiniToggle label="Human" value={c.humanize} onChange={(v) => u({ humanize: v })} icon="Shield" accent="green" />}
                <MiniToggle label="Drip" value={c.dripMode} onChange={(v) => u({ dripMode: v })} icon="Clock" accent="cyan" />
                <MiniToggle label="Poly" value={c.polymorph} onChange={(v) => u({ polymorph: v })} icon="Sparkle" accent="violet" />
                <MiniToggle label="Priority" value={c.prioritySend} onChange={(v) => u({ prioritySend: v })} icon="Star" accent="yellow" />
                <MiniToggle label="Confirm" value={c.confirmedShipping} onChange={(v) => u({ confirmedShipping: v })} icon="Check" accent="green" />
                <label className="flex items-center gap-0.5 px-1.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-md text-[9px] font-medium cursor-pointer transition border border-white/5">
                  <Icon.Upload className="w-2.5 h-2.5" /> Import
                  <input type="file" accept=".csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
                </label>
              </div>
            </div>

            {/* Test Mail */}
            <div className={`rounded-lg p-2 border transition ${c.testResult?.ok ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <SectionLabel icon="Eye" accent="cyan">Test Mail</SectionLabel>
              <div className="flex gap-1.5">
                <input value={c.testRecipient} onChange={(e) => u({ testRecipient: e.target.value })}
                  placeholder="test@example.com"
                  className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[10px] font-mono min-w-0" />
                <button onClick={() => onTestMail(c.id)} disabled={c.testing || !(c.testRecipient || '').trim() || !(c.message || '').trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md text-[10px] font-medium transition flex-shrink-0">
                  {c.testing ? <Spinner size={10} /> : <Icon.Send className="w-3 h-3" />} Test
                </button>
              </div>
              {c.testResult && (
                <p className={`text-[9px] px-2 py-1 rounded-md mt-1.5 ${c.testResult.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
                  {c.testResult.ok ? `✓ ${c.testResult.recipient} via ${c.testResult.sender || 'auto'}` : c.testResult.blocked ? `✕ Blocked (${c.testResult.score})` : `✕ ${c.testResult.error || 'Failed'}`}
                </p>
              )}
            </div>

            {/* Threshold alerts — compact */}
            {thresholdStatus && thresholdStatus.length > 0 && (
              <div className="pt-1 border-t border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <SectionLabel icon="Gauge" accent="amber">Threshold</SectionLabel>
                  <button onClick={onRefreshThreshold} disabled={thresholdLoading} className="text-[8px] text-gray-500 hover:text-gray-300 disabled:opacity-40 flex items-center gap-0.5">
                    <Icon.Refresh className={`w-2.5 h-2.5 ${thresholdLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5">
                  {thresholdStatus.map((cred) => {
                    const pct = cred.thresholdLimit > 0 ? Math.min((cred.sentToday / cred.thresholdLimit) * 100, 100) : 0;
                    const paused = cred.thresholdPaused;
                    return (
                      <div key={cred._id} className={`rounded-md p-1.5 border ${paused ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] text-gray-200 font-mono truncate flex-1">{cred.email || cred.name || cred._id}</span>
                          {paused && <span className="text-[8px] text-amber-300 font-bold ml-1 flex-shrink-0">PAUSED</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="flex-1 bg-slate-800 rounded-full h-1 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${paused ? 'bg-amber-500' : pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[8px] text-gray-400 font-mono flex-shrink-0">{cred.sentToday}/{cred.thresholdLimit}</span>
                        </div>
                        {paused && (
                          <button onClick={() => onResumePaused(cred._id, c.id)} disabled={resumeLoading === cred._id}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-md text-[9px] font-bold transition">
                            {resumeLoading === cred._id ? <Spinner size={9} /> : <Icon.Play className="w-2.5 h-2.5" />} Resume @ {cred.pausedIndex || 0}
                          </button>
                        )}
                        {cred.isNewCredential && !paused && (
                          <button onClick={() => onAcknowledgeCredential(cred._id)}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-[9px] font-bold transition">
                            <Icon.CheckCircle className="w-2.5 h-2.5" /> Acknowledge
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── LAUNCH / STOP / PAUSE — the hero controls ── */}
            <div className="mt-auto pt-2 border-t border-white/5 space-y-1.5">
              {/* Pre-flight readiness dots */}
              <div className="flex items-center justify-center gap-1 text-[8px]">
                {['recipients', 'sender', 'subject', 'body', 'quota'].map((k) => (
                  <span key={k} title={k} className={`w-1.5 h-1.5 rounded-full ${ready[k] ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                ))}
                <span className="ml-1 text-gray-500">{ready.passed}/{ready.total} ready</span>
              </div>
              {!c.loading && !c.progress && (
                <button onClick={() => setMissionControlOpen(true)}
                  disabled={remaining <= 0 || parsedEmails.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-bold transition shadow-lg shadow-violet-600/30">
                  <Icon.Rocket className="w-4 h-4" /> Start Campaign
                </button>
              )}
              {(c.loading || c.progress) && (
                <div className="space-y-1">
                  <button onClick={() => onStop(c.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[12px] font-bold transition shadow-lg shadow-red-600/30">
                    <Icon.Stop className="w-4 h-4" /> Stop
                  </button>
                  <button onClick={() => onPause(c.id)}
                    className={`w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${c.paused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                    {c.paused ? <><Icon.Play className="w-3 h-3" /> Resume</> : <><Icon.Pause className="w-3 h-3" /> Pause</>}
                  </button>
                  {c.paused && (
                    <p className="text-[9px] text-amber-300 text-center">⏸ Paused at {c.progress?.totalSent || 0} — press Resume</p>
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
