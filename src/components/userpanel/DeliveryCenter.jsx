// ============================================================================
// V7 P9.4 — Inbox-grade Delivery Center
// ----------------------------------------------------------------------------
// One-brain, full-logic component that upgrades the legacy ReportsTab into a
// mission-grade delivery intelligence surface. Pure presentational + light
// data-shaping; all heavy work stays server-side (PRESERVE: Accounts 1-2
// backends, /api/system actions untouched).
//
// Features
//   • Per-campaign breakdown with aggregate metrics + delivery-rate ring
//   • Drill-down into a single campaign → per-recipient ledger (search + filter)
//   • CSV export of the currently visible report set (RFC-4180 safe)
//   • Bounce-reason clustering — groups failures by errorCode / human reason
//   • Credential health cards — per-sender capacity, threshold %, status pill,
//     and a one-tap "Test Send" that calls /api/system testSenderApi (admin) or
//     surfaces the capability-probe result (user). Falls back gracefully.
//
// Props (mirrors the existing ReportsTab contract so it is a drop-in upgrade):
//   { campaigns, deliveryReports, onCampaignClick, thresholdStatus,
//     onRefreshThreshold, onResumePaused, resumeLoading }
//
// STYLE LAW: tokens from theme.js, small modular helpers, try/catch everywhere,
// camelCase, zero hardcoded hex in render, static Tailwind classes only.
// ============================================================================
import { useMemo, useState, useCallback } from 'react';
import Icon from '@/components/userpanel/icons.jsx';
import { SURFACE, ACCENT, RADIUS, cx, withGlow } from '@/lib/ui/theme.js';

// ---------------------------------------------------------------------------
// Status → visual mapping (static Tailwind strings; no dynamic class builds)
// ---------------------------------------------------------------------------
const STATUS_PILL = {
  delivered: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Delivered' },
  sent:      { cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',             dot: 'bg-sky-400',      label: 'Sent' },
  queued:    { cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',    dot: 'bg-indigo-400',   label: 'Queued' },
  invalid:   { cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',          dot: 'bg-rose-400',     label: 'Invalid' },
  failed:    { cls: 'bg-red-500/15 text-red-300 border-red-500/30',             dot: 'bg-red-400',      label: 'Failed' },
  undelivered: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',     dot: 'bg-amber-400',    label: 'Undelivered' },
  bounced:   { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30',    dot: 'bg-orange-400',   label: 'Bounced' },
  default:   { cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',       dot: 'bg-slate-400',    label: 'Unknown' },
};

function pillFor(status) {
  const key = String(status || '').toLowerCase();
  return STATUS_PILL[key] || STATUS_PILL.default;
}

// ---------------------------------------------------------------------------
// Human-readable bounce-reason map (errorCode → friendly label)
// Common provider/webhook error codes are mapped; unknown codes fall through
// to a generic bucket so the operator always sees *something* actionable.
// ---------------------------------------------------------------------------
const ERROR_REASON_MAP = {
  '21211': 'Invalid recipient number format',
  '21612': 'Recipient not reachable on this provider',
  '21614': 'Number is on a carrier block-list',
  '21610': 'Recipient has opted out / blacklisted',
  '30001': 'Provider queue overflow — retry later',
  '30002': 'Account suspended by provider',
  '30003': 'Destination is unreachable',
  '30004': 'Message body rejected (spam filter)',
  '30005': 'Recipient handset off / out of coverage',
  '30006': 'Carrier landline — cannot receive MMS',
  '30007': 'Carrier violation — content policy',
  '30008': 'Unknown carrier for destination',
  'auth':  'Credential authentication failed',
  'timeout': 'Provider timeout — no response',
  'rate_limit': 'Rate limited by provider',
};

function reasonFor(dr) {
  try {
    const code = String(dr.errorCode || '').trim();
    if (code && ERROR_REASON_MAP[code]) return ERROR_REASON_MAP[code];
    if (dr.status === 'invalid') return 'Invalid recipient number format';
    if (dr.status === 'undelivered') return 'Undelivered — carrier rejected';
    if (dr.status === 'failed') return code ? `Provider error ${code}` : 'Delivery failed';
    if (dr.status === 'bounced') return 'Bounced — recipient mailbox rejected';
    return 'Unknown delivery issue';
  } catch {
    return 'Unknown delivery issue';
  }
}

// ---------------------------------------------------------------------------
// CSV export — RFC-4180 safe (quotes fields containing commas/quotes/newlines)
// Produces a downloadable Blob and triggers a browser save.
// ---------------------------------------------------------------------------
const CSV_HEADERS = ['Campaign', 'Recipient', 'Sender API', 'Status', 'Error Code', 'Bounce Reason', 'Sent At'];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(reports, campaigns) {
  try {
    const campName = (id) => {
      const c = campaigns.find((x) => String(x._id) === String(id));
      return c ? (c.name || 'Untitled') : 'Unknown';
    };
    const rows = [CSV_HEADERS.join(',')];
    for (const dr of reports) {
      rows.push([
        csvEscape(campName(dr.campaignId)),
        csvEscape(dr.number),
        csvEscape(dr.senderApiName || dr.provider || ''),
        csvEscape(pillFor(dr.status).label),
        csvEscape(dr.errorCode || ''),
        csvEscape(reasonFor(dr)),
        csvEscape(dr.sentAt ? new Date(dr.sentAt).toISOString() : ''),
      ].join(','));
    }
    return rows.join('\n');
  } catch (e) {
    return CSV_HEADERS.join(',') + '\n';
  }
}

function downloadCsv(reports, campaigns, filename) {
  try {
    const csv = buildCsv(reports, campaigns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `delivery-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

// Delivery-rate ring (SVG conic-style arc)
function RateRing({ percent, size = 120, stroke = 12 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent || 0));
  const dash = (pct / 100) * circ;
  const color = pct >= 90 ? ACCENT.success : pct >= 70 ? ACCENT.warning : ACCENT.danger;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SURFACE.inset} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
        <span className="text-[10px] text-slate-500">delivered</span>
      </div>
    </div>
  );
}

// Bounce-reason cluster card
function BounceCluster({ label, count, examples }) {
  return (
    <div className={cx('rounded-xl border p-4', 'border-white/5 bg-white/[0.02]')}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-rose-300 flex items-center gap-1.5">
          <Icon.AlertTriangle className="w-3.5 h-3.5" />
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums text-white">{count}</span>
      </div>
      {examples && examples.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {examples.slice(0, 4).map((n, i) => (
            <span key={i} className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
              {n}
            </span>
          ))}
          {examples.length > 4 && (
            <span className="text-[10px] text-slate-500">+{examples.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credential health card — per-sender capacity + threshold + test-send
// ---------------------------------------------------------------------------
function CredentialHealthCard({ cred, onTestSend, testState }) {
  const limit = cred.thresholdLimit || 500;
  const sent = cred.sentToday || 0;
  const remaining = cred.remaining ?? Math.max(0, limit - sent);
  const pct = limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0;
  const atLimit = cred.atLimit || remaining <= 0;
  const paused = cred.thresholdPaused;
  const isNew = cred.isNewCredential;

  // Health tier
  const tier = atLimit || paused ? 'danger' : pct >= 80 ? 'warning' : 'success';
  const TIER_BAR = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
  };
  const TIER_TEXT = {
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-rose-300',
  };

  const testing = testState?.id === cred._id && testState?.loading;
  const testResult = testState?.id === cred._id ? testState?.result : null;

  return (
    <div className={cx('rounded-2xl border p-4 space-y-3', 'border-white/5 bg-white/[0.02]')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{cred.label || cred.email}</span>
            {isNew && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium border border-violet-500/30">
                NEW
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate">{cred.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cx('text-[10px] px-2 py-0.5 rounded-full font-medium border',
            paused ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
            atLimit ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
            'bg-emerald-500/15 text-emerald-300 border-emerald-500/30')}>
            {paused ? 'PAUSED' : atLimit ? 'AT LIMIT' : 'ACTIVE'}
          </span>
          {cred.provider && (
            <span className="text-[9px] text-slate-600 uppercase tracking-wide">{cred.provider}</span>
          )}
        </div>
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-slate-500">Daily usage</span>
          <span className={cx('tabular-nums font-medium', TIER_TEXT[tier])}>{sent}/{limit}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: SURFACE.inset }}>
          <div
            className={cx('h-full rounded-full transition-all duration-500', TIER_BAR[tier])}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1">
          <span className="text-slate-600">{remaining} remaining</span>
          <span className="text-slate-600 tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Test send */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onTestSend(cred)}
          disabled={testing}
          className={cx(
            'text-[11px] px-3 py-1.5 rounded-lg font-medium transition',
            'border border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
            'hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed',
            'flex items-center gap-1.5',
          )}
        >
          {testing ? (
            <Icon.Refresh className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Icon.Send className="w-3.5 h-3.5" />
          )}
          {testing ? 'Testing…' : 'Test Send'}
        </button>
        {testResult && (
          <span className={cx('text-[10px] font-medium', testResult.ok ? 'text-emerald-300' : 'text-rose-300')}>
            {testResult.ok ? '✓ Reachable' : `✕ ${testResult.error || 'Failed'}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state with personality
// ---------------------------------------------------------------------------
function EmptyDeliveryState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
        <Icon.Activity className="w-10 h-10 text-violet-400/40" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No delivery data yet</h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto">
        Once you send a campaign, per-recipient delivery reports will appear here
        with bounce clustering and credential health insights.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DeliveryCenter component
// ---------------------------------------------------------------------------
export default function DeliveryCenter({
  campaigns,
  deliveryReports,
  onCampaignClick,
  thresholdStatus,
  onResumePaused,
  resumeLoading,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [testState, setTestState] = useState(null);

  // ---- Derived: per-campaign breakdown -----------------------------------
  const campaignBreakdown = useMemo(() => {
    try {
      return campaigns.map((c) => {
        const reports = deliveryReports.filter(
          (dr) => String(dr.campaignId) === String(c._id),
        );
        const sent = reports.length;
        const delivered = reports.filter((r) => r.status === 'delivered').length;
        const failed = reports.filter(
          (r) => ['invalid', 'failed', 'undelivered', 'bounced'].includes(String(r.status).toLowerCase()),
        ).length;
        const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
        return { campaign: c, reports, sent, delivered, failed, rate };
      });
    } catch {
      return [];
    }
  }, [campaigns, deliveryReports]);

  // ---- Derived: selected campaign drill-down -----------------------------
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return campaignBreakdown.find((b) => String(b.campaign._id) === String(selectedId)) || null;
  }, [selectedId, campaignBreakdown]);

  const drillReports = useMemo(() => {
    if (!selected) return [];
    try {
      let rows = selected.reports;
      if (statusFilter !== 'all') {
        rows = rows.filter((r) => String(r.status).toLowerCase() === statusFilter);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            String(r.number || '').toLowerCase().includes(q) ||
            String(r.senderApiName || '').toLowerCase().includes(q),
        );
      }
      return rows;
    } catch {
      return [];
    }
  }, [selected, search, statusFilter]);

  // ---- Derived: bounce-reason clustering ---------------------------------
  const bounceClusters = useMemo(() => {
    try {
      const pool = selected ? selected.reports : deliveryReports;
      const failed = pool.filter((r) =>
        ['invalid', 'failed', 'undelivered', 'bounced'].includes(String(r.status).toLowerCase()),
      );
      const map = new Map();
      for (const dr of failed) {
        const reason = reasonFor(dr);
        const entry = map.get(reason) || { reason, count: 0, numbers: [] };
        entry.count += 1;
        if (dr.number && entry.numbers.length < 8) entry.numbers.push(dr.number);
        map.set(reason, entry);
      }
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    } catch {
      return [];
    }
  }, [selected, deliveryReports]);

  // ---- Handlers ----------------------------------------------------------
  const handleSelect = useCallback(
    (c) => {
      setSelectedId(c._id);
      setSearch('');
      setStatusFilter('all');
      if (typeof onCampaignClick === 'function') onCampaignClick(c._id);
    },
    [onCampaignClick],
  );

  const handleExport = useCallback(() => {
    const set = selected ? selected.reports : deliveryReports;
    const fname = selected
      ? `delivery-${selected.campaign.name || selected.campaign._id}-${Date.now()}.csv`
      : `delivery-all-${Date.now()}.csv`;
    downloadCsv(set, campaigns, fname);
  }, [selected, deliveryReports, campaigns]);

  const handleTestSend = useCallback(async (cred) => {
    try {
      setTestState({ id: cred._id, loading: true, result: null });
      // The testSenderApi action is admin-gated. For user-panel we attempt a
      // capability probe via listSenders-derived health; if the call returns
      // an auth error we surface a graceful "admin-only" message instead of
      // crashing. This keeps the user panel resilient without touching the
      // server-side auth model (PRESERVE).
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'testSenderApi',
          apiId: cred._id,
          testNumber: '0000000000',
          testMessage: 'V7 delivery-center health probe',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState({ id: cred._id, loading: false, result: { ok: true } });
      } else {
        const msg = data.error || 'Probe failed';
        const isAdminOnly = /admin|forbidden|unauthorized/i.test(msg);
        setTestState({
          id: cred._id,
          loading: false,
          result: {
            ok: false,
            error: isAdminOnly ? 'Admin-only action' : msg,
          },
        });
      }
    } catch (e) {
      setTestState({ id: cred._id, loading: false, result: { ok: false, error: 'Network error' } });
    }
  }, []);

  // ---- Aggregate stats ---------------------------------------------------
  const totalSent = campaigns.reduce((s, c) => s + (c.totalSent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.totalDelivered || 0), 0);
  const totalUndelivered = campaigns.reduce((s, c) => s + (c.totalUndelivered || 0), 0);
  const overallRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  const hasData = campaigns.length > 0 || deliveryReports.length > 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon.Activity className="w-5 h-5 text-cyan-400" />
            Delivery Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Per-campaign intelligence · bounce clustering · credential health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!hasData}
            className={cx(
              'text-xs px-3 py-2 rounded-lg font-medium transition flex items-center gap-1.5',
              'border border-violet-500/30 bg-violet-500/10 text-violet-300',
              'hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Icon.Refresh className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {!hasData ? (
        <EmptyDeliveryState />
      ) : (
        <>
          {/* ── Aggregate overview ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={cx('rounded-2xl border p-4', 'border-white/5 bg-white/[0.02]')}>
              <div className="flex items-center gap-2 mb-1">
                <Icon.Layers className="w-4 h-4 text-violet-400" />
                <span className="text-[11px] text-slate-500">Campaigns</span>
              </div>
              <span className="text-2xl font-bold text-white tabular-nums">{campaigns.length}</span>
            </div>
            <div className={cx('rounded-2xl border p-4', 'border-white/5 bg-white/[0.02]')}>
              <div className="flex items-center gap-2 mb-1">
                <Icon.Send className="w-4 h-4 text-sky-400" />
                <span className="text-[11px] text-slate-500">Total Sent</span>
              </div>
              <span className="text-2xl font-bold text-white tabular-nums">{totalSent}</span>
            </div>
            <div className={cx('rounded-2xl border p-4', 'border-white/5 bg-white/[0.02]')}>
              <div className="flex items-center gap-2 mb-1">
                <Icon.CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] text-slate-500">Delivered</span>
              </div>
              <span className="text-2xl font-bold text-emerald-300 tabular-nums">{totalDelivered}</span>
            </div>
            <div className={cx('rounded-2xl border p-4', 'border-white/5 bg-white/[0.02]')}>
              <div className="flex items-center gap-2 mb-1">
                <Icon.XCircle className="w-4 h-4 text-rose-400" />
                <span className="text-[11px] text-slate-500">Undelivered</span>
              </div>
              <span className="text-2xl font-bold text-rose-300 tabular-nums">{totalUndelivered}</span>
            </div>
          </div>

          {/* ── Overall delivery ring ──────────────────────────────────── */}
          {totalSent > 0 && (
            <div className={cx('rounded-2xl border p-6 flex items-center gap-6 flex-wrap',
              'border-white/5 bg-white/[0.02]')}>
              <RateRing percent={overallRate} />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white">Overall Delivery Health</h3>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-sm text-slate-300">
                    Delivered: <span className="font-bold text-white tabular-nums">{totalDelivered}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="text-sm text-slate-300">
                    Undelivered: <span className="font-bold text-white tabular-nums">{totalUndelivered}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SURFACE.inset }} />
                  <span className="text-sm text-slate-300">
                    Total attempts: <span className="font-bold text-white tabular-nums">{totalSent}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Credential health cards ────────────────────────────────── */}
          {thresholdStatus && thresholdStatus.length > 0 && (
            <div className={cx('rounded-2xl border p-6', 'border-white/5 bg-white/[0.02]')}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Icon.FuelGauge className="w-4 h-4 text-amber-400" />
                Credential Health
                <span className="text-[10px] text-slate-500 font-normal">
                  ({thresholdStatus.filter((c) => !c.thresholdPaused && !c.atLimit).length} healthy ·{' '}
                  {thresholdStatus.filter((c) => c.atLimit).length} at limit ·{' '}
                  {thresholdStatus.filter((c) => c.thresholdPaused).length} paused)
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {thresholdStatus.map((cred) => (
                  <CredentialHealthCard
                    key={cred._id}
                    cred={cred}
                    onTestSend={handleTestSend}
                    testState={testState}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Bounce-reason clusters ─────────────────────────────────── */}
          {bounceClusters.length > 0 && (
            <div className={cx('rounded-2xl border p-6', 'border-white/5 bg-white/[0.02]')}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Icon.AlertTriangle className="w-4 h-4 text-rose-400" />
                Bounce Reasons
                <span className="text-[10px] text-slate-500 font-normal">
                  {selected ? `for ${selected.campaign.name || 'selected campaign'}` : 'across all campaigns'}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bounceClusters.map((cluster, i) => (
                  <BounceCluster
                    key={i}
                    label={cluster.reason}
                    count={cluster.count}
                    examples={cluster.numbers}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Campaign breakdown list ────────────────────────────────── */}
          <div className={cx('rounded-2xl border p-6', 'border-white/5 bg-white/[0.02]')}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Icon.Layers className="w-4 h-4 text-violet-400" />
              Campaign Breakdown
            </h3>
            {campaignBreakdown.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-8">No campaigns recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {campaignBreakdown.map(({ campaign: c, sent, delivered, failed, rate }) => {
                  const isSelected = String(selectedId) === String(c._id);
                  const p = pillFor(c.status);
                  return (
                    <div
                      key={c._id}
                      className={cx(
                        'rounded-xl p-4 cursor-pointer transition border',
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]',
                      )}
                      onClick={() => handleSelect(c)}
                    >
                      <div className="flex items-center justify-between mb-2 gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cx('text-xs px-2.5 py-1 rounded-full font-medium border shrink-0', p.cls)}>
                            {c.status}
                          </span>
                          <span className="text-xs text-slate-500 shrink-0">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                          <span className="tabular-nums">{sent} reports</span>
                          <span className="text-emerald-400 tabular-nums">{delivered} ok</span>
                          {failed > 0 && <span className="text-rose-400 tabular-nums">{failed} fail</span>}
                          <span className={cx('font-bold tabular-nums',
                            rate >= 90 ? 'text-emerald-300' : rate >= 70 ? 'text-amber-300' : 'text-rose-300')}>
                            {rate}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 truncate">
                        {c.message ? c.message.substring(0, 80) : 'No message'}…
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Drill-down: per-recipient ledger ───────────────────────── */}
          {selected && (
            <div className={cx('rounded-2xl border p-6', 'border-cyan-500/20 bg-white/[0.02]')}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon.Report className="w-4 h-4 text-cyan-400" />
                  Recipient Ledger
                  <span className="text-[10px] text-slate-500 font-normal">
                    {selected.campaign.name || 'Campaign'} · {drillReports.length} of {selected.reports.length}
                  </span>
                </h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-[11px] px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition flex items-center gap-1"
                >
                  <Icon.Close className="w-3.5 h-3.5" />
                  Close drill-down
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search recipient or sender…"
                  className="flex-1 min-w-[180px] text-xs px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500/40 transition"
                >
                  <option value="all">All statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="sent">Sent</option>
                  <option value="queued">Queued</option>
                  <option value="invalid">Invalid</option>
                  <option value="failed">Failed</option>
                  <option value="undelivered">Undelivered</option>
                  <option value="bounced">Bounced</option>
                </select>
                <button
                  onClick={handleExport}
                  className="text-[11px] px-3 py-2 rounded-lg font-medium border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition flex items-center gap-1.5"
                >
                  <Icon.Refresh className="w-3.5 h-3.5" />
                  Export this campaign
                </button>
              </div>

              {/* Ledger rows */}
              <div className="max-h-96 overflow-y-auto v7-scroll space-y-1.5">
                {drillReports.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-6">
                    No reports match your filters.
                  </p>
                ) : (
                  drillReports.map((dr, i) => {
                    const p = pillFor(dr.status);
                    const isFail = ['invalid', 'failed', 'undelivered', 'bounced'].includes(
                      String(dr.status).toLowerCase(),
                    );
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] text-xs gap-3"
                      >
                        <span className="text-slate-300 font-mono truncate">{dr.number}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500 hidden sm:inline">{dr.senderApiName || '—'}</span>
                          <span className={cx('px-2 py-0.5 rounded-full font-medium border flex items-center gap-1', p.cls)}>
                            <span className={cx('w-1.5 h-1.5 rounded-full', p.dot)} />
                            {p.label}
                          </span>
                          {isFail && (
                            <span className="text-[10px] text-rose-400/70 hidden md:inline" title={reasonFor(dr)}>
                              {reasonFor(dr)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
