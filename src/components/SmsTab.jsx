// ============================================================================
// SmsTab.jsx — SMS Sending Module (BM2 Ultra UI — same-to-same recreation)
// ============================================================================
// A standalone SMS/email sending module that recreates the BM2 Ultra desktop
// application UI as a web component. Features a three-column layout:
//   LEFT   — email list (contacts / recipients)
//   CENTER — composition controls (subject, body, options, content type)
//   RIGHT  — task status / verification info
//
// The BLUE "Success" button triggers the Google API call (sendSms action)
// which sends emails via the user's connected Gmail OAuth accounts.
//
// State is persisted to localStorage under 'mms_sms_tab_state_v01'.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Static Tailwind color maps (required for build-time class extraction) ──
const COLOR_MAP = {
  blue: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30',
  green: 'bg-green-600 hover:bg-green-500 text-white',
  red: 'bg-red-600 hover:bg-red-500 text-white',
  yellow: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  gray: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
  purple: 'bg-purple-600 hover:bg-purple-500 text-white',
};

const BORDER_MAP = {
  blue: 'border-blue-500',
  green: 'border-green-500',
  red: 'border-red-500',
  yellow: 'border-yellow-500',
  gray: 'border-gray-600',
};

// ── Small reusable UI pieces ──
function MiniCheckbox({ label, checked, onChange, color = 'blue' }) {
  const accent = color === 'yellow' ? 'accent-yellow-500' : color === 'green' ? 'accent-green-500' : color === 'red' ? 'accent-red-500' : 'accent-blue-600';
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-300 hover:text-white transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-3.5 h-3.5 rounded ${accent} cursor-pointer`}
      />
      <span>{label}</span>
    </label>
  );
}

function ActionButton({ label, onClick, color = 'gray', disabled, fullWidth, size = 'sm' }) {
  const cls = COLOR_MAP[color] || COLOR_MAP.gray;
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} ${fullWidth ? 'w-full' : ''} ${sz} rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5`}
    >
      {label}
    </button>
  );
}

// ── SVG icons ──
const SmsIcon = {
  Send: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Stop: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>,
  Plus: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>,
  Trash: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Check: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Upload: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Key: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Refresh: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Mail: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 5L2 7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Success: (p) => <svg {...p} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Warning: (p) => <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/></svg>,
  Spinner: () => <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>,
};

// ============================================================================
// Main SmsTab Component
// ============================================================================
export default function SmsTab({ user, onToast, onSent }) {
  // ── Core state ──
  const [subject, setSubject] = useState('#RANDOM');
  const [body, setBody] = useState('');
  const [bodyMode, setBodyMode] = useState('html'); // html | text
  const [emailList, setEmailList] = useState([]); // array of email strings
  const [emailListText, setEmailListText] = useState(''); // raw textarea
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [fromName, setFromName] = useState('Support Team');
  const [fromNameVariants, setFromNameVariants] = useState('');

  // ── BM2 Ultra checkboxes ──
  const [optAus, setOptAus] = useState(false); // AUS
  const [optHtmlRandomColor, setOptHtmlRandomColor] = useState(false); // HTML Random Color
  const [optImport, setOptImport] = useState(false); // Import
  const [optAutoSave, setOptAutoSave] = useState(true); // AutoSave
  const [optUseName, setOptUseName] = useState(true); // Name?
  const [optCheckResult, setOptCheckResult] = useState(false); // Check Result
  const [optCheckReply, setOptCheckReply] = useState(false); // Check Reply
  const [optAutoReply, setOptAutoReply] = useState(false); // Auto Reply
  const [optAutoSend, setOptAutoSend] = useState(false); // Auto Send
  const [optTrackPixel, setOptTrackPixel] = useState(false); // Track Pixel
  const [optAntiDetect, setOptAntiDetect] = useState(false); // Anti-Detect
  const [optColorShift, setOptColorShift] = useState(false); // Color Shift
  const [optTextShift, setOptTextShift] = useState(false); // Text Shift
  const [optRandomText, setOptRandomText] = useState(false); // Random Text
  const [optUnsubscribe, setOptUnsubscribe] = useState(false); // Unsubscribe
  const [optCheckBounce, setOptCheckBounce] = useState(false); // Check Bounce
  const [optConfirmedShipping, setOptConfirmedShipping] = useState(false); // Confirmed Shipping
  const [optPrioritySend, setOptPrioritySend] = useState(false); // Priority Send

  // ── Content type (To Html / To PDF / To Image / Inline Image / Inline Html / PPTX) ──
  const [contentType, setContentType] = useState('html'); // html | pdf | image | inline_image | inline_html | pptx

  // ── Speed mode ──
  const [speedMode, setSpeedMode] = useState('ALL'); // ALL | SLOW | SAFE

  // ── Send rate ──
  const [batchSize, setBatchSize] = useState(5);
  const [delayMs, setDelayMs] = useState(1200);
  const [colorSec, setColorSec] = useState(5);

  // ── Sender accounts (connected Gmail accounts) ──
  const [senders, setSenders] = useState([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [selectedSender, setSelectedSender] = useState(null);
  const [verifyingCreds, setVerifyingCreds] = useState(false);
  const [credStatus, setCredStatus] = useState(null); // { verified, message }

  // ── Sending state ──
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [totalSent, setTotalSent] = useState(0);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [totalUndelivered, setTotalUndelivered] = useState(0);
  const [totalInvalid, setTotalInvalid] = useState(0);
  const [campaignId, setCampaignId] = useState(null);
  const [warning, setWarning] = useState(''); // red warning banner
  const [progressTimer, setProgressTimer] = useState(null);

  // ── Credential upload ──
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [gmailMsg, setGmailMsg] = useState('');
  const fileInputRef = useRef(null);

  // ── Test mail ──
  const [testRecipient, setTestRecipient] = useState('');
  const [testing, setTesting] = useState(false);

  // ── Persistence ──
  const STORAGE_KEY = 'mms_sms_tab_state_v01';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        setSubject(s.subject || '#RANDOM');
        setBody(s.body || '');
        setBodyMode(s.bodyMode || 'html');
        setEmailListText(s.emailListText || '');
        setFromName(s.fromName || 'Support Team');
        setFromNameVariants(s.fromNameVariants || '');
        setOptAus(!!s.optAus);
        setOptHtmlRandomColor(!!s.optHtmlRandomColor);
        setOptImport(!!s.optImport);
        setOptAutoSave(s.optAutoSave !== false);
        setOptUseName(s.optUseName !== false);
        setBatchSize(s.batchSize || 5);
        setDelayMs(s.delayMs || 1200);
        setColorSec(s.colorSec || 5);
        setSpeedMode(s.speedMode || 'ALL');
        setContentType(s.contentType || 'html');
      }
    } catch (_e) {}
  }, []);

  useEffect(() => {
    const state = {
      subject, body, bodyMode, emailListText, fromName, fromNameVariants,
      optAus, optHtmlRandomColor, optImport, optAutoSave, optUseName,
      batchSize, delayMs, colorSec, speedMode, contentType,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_e) {}
  }, [subject, body, bodyMode, emailListText, fromName, fromNameVariants, optAus, optHtmlRandomColor, optImport, optAutoSave, optUseName, batchSize, delayMs, colorSec, speedMode, contentType]);

  // ── Load senders on mount ──
  const loadSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'listSenders' }),
      });
      const data = await res.json();
      if (data.success && data.senders) {
        setSenders(data.senders);
        if (data.senders.length > 0 && !selectedSender) {
          setSelectedSender(data.senders[0]._id);
        }
        if (data.senders.length === 0) {
          setWarning('No sender account connected. Upload credentials.json to start sending.');
        } else {
          setWarning('');
        }
      }
    } catch (e) {
      setWarning('Failed to load sender accounts: ' + e.message);
    } finally {
      setLoadingSenders(false);
    }
  }, [selectedSender]);

  useEffect(() => { loadSenders(); }, [loadSenders]);

  // ── Listen for OAuth popup result ──
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'user-gmail-oauth-result') {
        if (e.data.success) {
          setGmailMsg('✓ ' + (e.data.message || 'Gmail connected successfully!'));
          setConnectingGmail(false);
          loadSenders();
          if (onToast) onToast('Gmail connected!', 'success');
        } else {
          setGmailMsg('✗ ' + (e.data.message || 'Connection failed'));
          setConnectingGmail(false);
          if (onToast) onToast('Connection failed: ' + (e.data.message || 'error'), 'error');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadSenders, onToast]);

  // ── Parse email list from textarea ──
  function parseEmailList() {
    const lines = emailListText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /.+@.+\..+/.test(s));
    const unique = [...new Set(lines)];
    setEmailList(unique);
    setSelectedEmails(new Set(unique));
    return unique;
  }

  useEffect(() => {
    if (emailListText.trim()) {
      const t = setTimeout(() => parseEmailList(), 500);
      return () => clearTimeout(t);
    }
  }, [emailListText]);

  // ── Upload credentials.json ──
  async function handleUploadCreds(file) {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setGmailMsg('✗ Please upload a .json file (credentials.json from Google Cloud Console)');
      return;
    }
    setConnectingGmail(true);
    setGmailMsg('Reading ' + file.name + '...');
    try {
      const text = await file.text();
      let creds;
      try { creds = JSON.parse(text); } catch {
        setGmailMsg('✗ Invalid JSON file. Please download credentials.json from Google Cloud Console.');
        setConnectingGmail(false);
        return;
      }
      const client = creds.installed || creds.web;
      if (!client || !client.client_id) {
        setGmailMsg('✗ No client_id found. Make sure you downloaded an OAuth Desktop or Web client.');
        setConnectingGmail(false);
        return;
      }

      setGmailMsg('Contacting Google OAuth...');
      const res = await fetch('/api/user/gmail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credentialsJson: text, label: file.name.replace(/\.json$/, '') }),
      });
      const data = await res.json();
      if (!data.success) {
        setGmailMsg('✗ ' + (data.error || 'Failed to start OAuth flow'));
        setConnectingGmail(false);
        return;
      }

      setGmailMsg('Opening Google consent screen...');
      // Open OAuth popup
      const popup = window.open(data.authUrl, 'gmail-oauth', 'width=520,height=720,scrollbars=yes');

      if (data.needsRegistration) {
        setGmailMsg('⚠ Redirect URI needs registration in Google Cloud Console:\n' + data.ourCallbackUri + '\n\nAdd this URI to your OAuth client\'s Authorized redirect URIs, then retry.');
      }

      // Check if popup was blocked
      if (!popup || popup.closed) {
        setGmailMsg('⚠ Popup blocked. Please allow popups, or click the consent URL manually.');
        setConnectingGmail(false);
      }
    } catch (e) {
      setGmailMsg('✗ ' + e.message);
      setConnectingGmail(false);
    }
  }

  // ── Verify Gmail connection (Check Credentials) ──
  async function handleCheckCreds() {
    if (!selectedSender) {
      setCredStatus({ verified: false, message: 'No sender account selected.' });
      return;
    }
    setVerifyingCreds(true);
    setCredStatus(null);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'verifyGmailConnection', senderId: selectedSender }),
      });
      const data = await res.json();
      if (data.success) {
        setCredStatus({ verified: true, message: `✓ ${data.gmailAddress || data.email} — API verified (${data.messagesTotal || 0} messages)` });
        if (onToast) onToast('Gmail API verified!', 'success');
      } else {
        setCredStatus({ verified: false, message: '✗ ' + (data.error || 'Verification failed') });
        if (data.needsReconnect) {
          setWarning('Gmail account needs reconnection. Upload credentials.json again.');
          loadSenders();
        }
        if (onToast) onToast('Verification failed', 'error');
      }
    } catch (e) {
      setCredStatus({ verified: false, message: '✗ ' + e.message });
    } finally {
      setVerifyingCreds(false);
    }
  }

  // ── Send SMS (blue Success button → Google API call) ──
  async function handleSend() {
    const emails = parseEmailList();
    if (emails.length === 0) {
      setWarning('No valid email addresses. Please add recipients to the list.');
      return;
    }
    if (!body.trim()) {
      setWarning('Message body is empty. Please write your message.');
      return;
    }

    setSending(true);
    setStopping(false);
    setWarning('');
    setTotalSent(0);
    setTotalDelivered(0);
    setTotalUndelivered(0);
    setTotalInvalid(0);

    const fromNameVariantsArr = fromNameVariants.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

    const options = {
      batchSize: Number(batchSize) || 5,
      delayMs: Number(delayMs) || 1200,
      subject,
      contentMode: contentType,
      bodyMode,
      speedMode,
      fromName,
      fromNameVariants: fromNameVariantsArr,
      autoChangeName: fromNameVariantsArr.length > 0,
      randomHtml: optHtmlRandomColor,
      randomText: optRandomText,
      importFlag: optImport,
      autoSave: optAutoSave,
      useName: optUseName,
      autoReply: optAutoReply,
      trackPixel: optTrackPixel,
      antiDetect: optAntiDetect,
      colorShift: optColorShift,
      textShift: optTextShift,
      addUnsubscribe: optUnsubscribe,
      checkBounce: optCheckBounce,
      checkResult: optCheckResult,
      checkReply: optCheckReply,
      confirmedShipping: optConfirmedShipping,
      prioritySend: optPrioritySend,
    };

    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'sendSms',
          message: body,
          subject,
          numbers: emails,
          options,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setTotalSent(data.totalSent || 0);
        setTotalDelivered(data.totalDelivered || 0);
        setTotalUndelivered(data.totalUndelivered || 0);
        setTotalInvalid(data.totalInvalid || 0);
        setCampaignId(data.campaignId);
        if (onToast) onToast(`Sent ${data.totalSent} emails (delivered ${data.totalDelivered})`, 'success');
        if (onSent) onSent(`SMS Module: ${data.totalSent} sent`, 'success');

        // Start polling for progress if campaign still running
        if (data.campaignId && data.totalSent < emails.length) {
          startPolling(data.campaignId);
        }
      } else if (data.needsCredentials) {
        setWarning(data.error || 'No sender account. Upload credentials.json first.');
        if (onToast) onToast('No sender account connected', 'error');
      } else if (data.blocked) {
        setWarning('Message blocked by spam protection. Rewrite content.');
        if (onToast) onToast('Blocked by spam protection', 'error');
      } else {
        setWarning(data.error || 'Sending failed');
        if (onToast) onToast(data.error || 'Sending failed', 'error');
      }
    } catch (e) {
      setWarning('Send error: ' + e.message);
      if (onToast) onToast('Send error: ' + e.message, 'error');
    } finally {
      setSending(false);
    }
  }

  // ── Stop sending ──
  async function handleStop() {
    if (!campaignId) {
      setSending(false);
      return;
    }
    setStopping(true);
    try {
      await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'stopCampaign', campaignId }),
      });
      if (onToast) onToast('Stop requested', 'info');
    } catch (e) {
      // ignore
    } finally {
      setStopping(false);
      setSending(false);
      if (progressTimer) { clearInterval(progressTimer); setProgressTimer(null); }
    }
  }

  // ── Poll progress ──
  function startPolling(cId) {
    if (progressTimer) clearInterval(progressTimer);
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'getCampaignProgress', campaignId: cId }),
        });
        const data = await res.json();
        if (data.success) {
          setTotalSent(data.sentCount || data.totalSent || 0);
          setTotalDelivered(data.deliveredCount || data.totalDelivered || 0);
          setTotalUndelivered(data.undeliveredCount || data.totalUndelivered || 0);
          if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
            clearInterval(timer);
            setProgressTimer(null);
            setSending(false);
          }
        }
      } catch (_e) {}
    }, 2000);
    setProgressTimer(timer);
  }

  useEffect(() => {
    return () => { if (progressTimer) clearInterval(progressTimer); };
  }, [progressTimer]);

  // ── Test mail ──
  async function handleTestMail() {
    if (!testRecipient.trim()) {
      setWarning('Enter a test recipient email address.');
      return;
    }
    setTesting(true);
    setWarning('');
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign',
          message: body,
          subject,
          numbers: [testRecipient.trim()],
          options: { testMail: true, testRecipient: testRecipient.trim(), subject, contentMode: contentType, bodyMode },
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast(`Test mail sent to ${testRecipient}`, 'success');
      } else {
        setWarning('Test mail failed: ' + (data.error || 'unknown error'));
        if (onToast) onToast('Test mail failed', 'error');
      }
    } catch (e) {
      setWarning('Test mail error: ' + e.message);
    } finally {
      setTesting(false);
    }
  }

  // ── Import emails from file ──
  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setEmailListText(prev => prev ? prev + '\n' + text : text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Generate random subject ──
  function handleGenerate() {
    const words = ['Update', 'Notice', 'Alert', 'Info', 'Report', 'Summary', 'Confirmation', 'Reminder', 'Status', 'Review'];
    const rand = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(Math.random() * 9999);
    setSubject(`#${rand}_${num}#`);
    if (onToast) onToast('Subject generated', 'info');
  }

  // ── Toggle email selection ──
  function toggleEmail(email) {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function selectAllEmails() {
    setSelectedEmails(new Set(emailList));
  }

  function clearEmails() {
    setEmailListText('');
    setEmailList([]);
    setSelectedEmails(new Set());
  }

  // ── Derived stats ──
  const totalRecipients = emailList.length;
  const selectedCount = selectedEmails.size;
  const progressPct = totalRecipients > 0 ? Math.min(100, Math.round((totalSent / totalRecipients) * 100)) : 0;

  const contentTypeOptions = [
    { v: 'html', l: 'To Html' },
    { v: 'pdf', l: 'To PDF' },
    { v: 'image', l: 'To Image' },
    { v: 'inline_image', l: 'Inline Image' },
    { v: 'inline_html', l: 'Inline Html' },
    { v: 'pptx', l: 'PPTX' },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — BM2 Ultra three-column layout
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-700/60 overflow-hidden">
      {/* ── Top header bar (BM2 Ultra blue header) ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SmsIcon.Mail className="text-white" />
          <h2 className="text-white font-bold text-lg tracking-wide">Welcome To BM2 Ultra — SMS Sending Module</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-blue-100">
          {user && <span className="bg-blue-900/40 px-2.5 py-1 rounded-md">User: {user.userId || user.email}</span>}
          <span className="bg-blue-900/40 px-2.5 py-1 rounded-md">{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* ── Tabs row (Add Task / Task Status / Settings) ── */}
      <div className="bg-slate-800 border-b border-slate-700 px-5 py-2 flex items-center gap-1 text-xs">
        {['Add Task', 'Task Status', 'Task', 'Build', 'Delivery', 'Settings'].map((t, i) => (
          <span key={t} className={`px-3 py-1.5 rounded-md cursor-pointer transition ${i === 0 ? 'bg-blue-600 text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}>
            {t}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500">Active senders: {senders.filter(s => s.status === 'ACTIVE').length}</span>
        </div>
      </div>

      {/* ── Warning banner (red, BM2 Ultra style) ── */}
      {warning && (
        <div className="bg-red-900/50 border-l-4 border-red-500 px-4 py-2.5 flex items-center gap-2 text-red-200 text-sm">
          <SmsIcon.Warning className="text-red-400 flex-shrink-0" />
          <span>{warning}</span>
          <button onClick={() => setWarning('')} className="ml-auto text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {/* ── Gmail connect message ── */}
      {gmailMsg && (
        <div className="bg-blue-900/30 border-l-4 border-blue-500 px-4 py-2.5 text-blue-200 text-sm whitespace-pre-wrap">
          {gmailMsg}
        </div>
      )}

      {/* ── Main three-column layout ── */}
      <div className="flex gap-0 min-h-[520px]">
        {/* ═══ LEFT COLUMN — Email List (contacts) ═══ */}
        <div className="w-64 bg-slate-850 bg-slate-800/50 border-r border-slate-700 flex flex-col">
          <div className="px-3 py-2.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Email List</span>
            <span className="text-xs text-blue-400 font-mono">{totalRecipients}</span>
          </div>

          {/* Email list textarea + controls */}
          <div className="p-2.5 border-b border-slate-700/50 space-y-2">
            <textarea
              value={emailListText}
              onChange={(e) => setEmailListText(e.target.value)}
              placeholder="Paste emails (one per line or comma-separated)..."
              className="w-full h-20 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 font-mono resize-none focus:border-blue-500 focus:outline-none"
            />
            <div className="flex gap-1">
              <label className="flex-1 cursor-pointer">
                <span className="block text-center px-2 py-1 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold rounded-md transition">
                  Import
                </span>
                <input type="file" accept=".txt,.csv" onChange={handleImportFile} className="hidden" />
              </label>
              <button onClick={selectAllEmails} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-md transition">All</button>
              <button onClick={clearEmails} className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded-md transition">Clear</button>
            </div>
          </div>

          {/* Scrollable email list */}
          <div className="flex-1 overflow-y-auto max-h-[380px] custom-scroll">
            {emailList.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-xs">
                No emails loaded.<br />Paste or import above.
              </div>
            ) : (
              emailList.map((email, i) => (
                <div
                  key={i}
                  onClick={() => toggleEmail(email)}
                  className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer border-b border-slate-700/30 transition ${selectedEmails.has(email) ? 'bg-blue-900/30' : 'hover:bg-slate-700/40'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(email)}
                    onChange={() => toggleEmail(email)}
                    className="w-3 h-3 accent-blue-600 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={`text-xs font-mono truncate ${selectedEmails.has(email) ? 'text-blue-200' : 'text-gray-400'}`}>
                    {email}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* List footer */}
          <div className="px-3 py-2 bg-slate-800 border-t border-slate-700 text-xs text-gray-400 flex justify-between">
            <span>Selected: <span className="text-blue-400 font-mono">{selectedCount}</span></span>
            <span>Total: <span className="text-white font-mono">{totalRecipients}</span></span>
          </div>
        </div>

        {/* ═══ CENTER COLUMN — Composition Controls ═══ */}
        <div className="flex-1 bg-slate-900 p-4 space-y-3 overflow-y-auto max-h-[560px]">
          {/* ── Sender account + credentials row ── */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <SmsIcon.Key className="text-yellow-400" />
              <span className="text-xs font-bold text-gray-300 uppercase">Credentials / Sender Account</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedSender || ''}
                onChange={(e) => setSelectedSender(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none min-w-[200px]"
              >
                <option value="">— Select sender —</option>
                {senders.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.email} ({s.status}, {s.remaining}/{s.dailyLimit})
                  </option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => handleUploadCreds(e.target.files[0])}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={connectingGmail}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {connectingGmail ? <SmsIcon.Spinner /> : <SmsIcon.Upload />}
                Upload credentials.json
              </button>
              <button
                onClick={handleCheckCreds}
                disabled={verifyingCreds || !selectedSender}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {verifyingCreds ? <SmsIcon.Spinner /> : <SmsIcon.Check />}
                Check Credentials
              </button>
              <button
                onClick={loadSenders}
                disabled={loadingSenders}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {loadingSenders ? <SmsIcon.Spinner /> : <SmsIcon.Refresh />}
                Refresh
              </button>
            </div>
            {credStatus && (
              <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${credStatus.verified ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                {credStatus.message}
              </div>
            )}
          </div>

          {/* ── Subject + From Name row ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Subject</label>
              <div className="flex gap-2">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="#RANDOM"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleGenerate}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Generate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">From Name</label>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Support Team"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* ── From Name Variants (textarea, collapsible) ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">From Name Variants (one per line, optional — rotates per recipient)</label>
            <textarea
              value={fromNameVariants}
              onChange={(e) => setFromNameVariants(e.target.value)}
              placeholder="Support Team&#10;Support_Sales&#10;Support_Billing"
              className="w-full h-14 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono resize-none focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* ── Email Body ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-400">Email Body</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setBodyMode('html')}
                  className={`px-2 py-0.5 text-xs rounded ${bodyMode === 'html' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-400'}`}
                >HTML</button>
                <button
                  onClick={() => setBodyMode('text')}
                  className={`px-2 py-0.5 text-xs rounded ${bodyMode === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-400'}`}
                >Text</button>
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={bodyMode === 'html' ? 'Type HTML content — use #RANDOM#, #DATE#, #NAME#, #GREETING# tags' : 'Type plain text content — use #RANDOM#, #DATE#, #NAME# tags'}
              className="w-full h-28 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono resize-y focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* ── Content Type row (To Html / To PDF / To Image / Inline Image / Inline Html / PPTX) ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Content Format</label>
            <div className="flex flex-wrap gap-1.5">
              {contentTypeOptions.map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setContentType(opt.v)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${contentType === opt.v ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-gray-400 border-slate-600 hover:border-blue-500/50'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* ── Checkbox grid (BM2 Ultra options) ── */}
          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Options</label>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <MiniCheckbox label="AUS" checked={optAus} onChange={setOptAus} color="blue" />
              <MiniCheckbox label="HTML Random Color" checked={optHtmlRandomColor} onChange={setOptHtmlRandomColor} color="yellow" />
              <MiniCheckbox label="Import" checked={optImport} onChange={setOptImport} color="blue" />
              <MiniCheckbox label="AutoSave" checked={optAutoSave} onChange={setOptAutoSave} color="green" />
              <MiniCheckbox label="Name?" checked={optUseName} onChange={setOptUseName} color="blue" />
              <MiniCheckbox label="Check Result" checked={optCheckResult} onChange={setOptCheckResult} color="blue" />
              <MiniCheckbox label="Check Reply" checked={optCheckReply} onChange={setOptCheckReply} color="blue" />
              <MiniCheckbox label="Auto Reply" checked={optAutoReply} onChange={setOptAutoReply} color="green" />
              <MiniCheckbox label="Auto Send" checked={optAutoSend} onChange={setOptAutoSend} color="green" />
              <MiniCheckbox label="Track Pixel" checked={optTrackPixel} onChange={setOptTrackPixel} color="blue" />
              <MiniCheckbox label="Anti-Detect" checked={optAntiDetect} onChange={setOptAntiDetect} color="yellow" />
              <MiniCheckbox label="Color Shift" checked={optColorShift} onChange={setOptColorShift} color="yellow" />
              <MiniCheckbox label="Text Shift" checked={optTextShift} onChange={setOptTextShift} color="yellow" />
              <MiniCheckbox label="Random Text" checked={optRandomText} onChange={setOptRandomText} color="yellow" />
              <MiniCheckbox label="Unsubscribe" checked={optUnsubscribe} onChange={setOptUnsubscribe} color="blue" />
              <MiniCheckbox label="Check Bounce" checked={optCheckBounce} onChange={setOptCheckBounce} color="red" />
              <MiniCheckbox label="Confirmed Shipping" checked={optConfirmedShipping} onChange={setOptConfirmedShipping} color="blue" />
              <MiniCheckbox label="Priority Send" checked={optPrioritySend} onChange={setOptPrioritySend} color="blue" />
            </div>
          </div>

          {/* ── Send Rate + Speed row ── */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Batch Size</label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Delay (ms)</label>
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Color Sec</label>
              <input
                type="number"
                value={colorSec}
                onChange={(e) => setColorSec(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Speed</label>
              <select
                value={speedMode}
                onChange={(e) => setSpeedMode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">ALL</option>
                <option value="SLOW">SLOW</option>
                <option value="SAFE">SAFE</option>
              </select>
            </div>
          </div>

          {/* ── Test Mail row ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 min-w-[200px] bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
            />
            <ActionButton
              label={testing ? 'Sending...' : 'Test Mail'}
              onClick={handleTestMail}
              color="yellow"
              disabled={testing}
            />
          </div>

          {/* ── Action buttons row (Pick / Import / Confirm / Add / Generate) ── */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <ActionButton label="Pick" onClick={() => selectAllEmails()} color="gray" />
            <label className="cursor-pointer">
              <span className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold rounded-lg transition inline-block">Import</span>
              <input type="file" accept=".txt,.csv" onChange={handleImportFile} className="hidden" />
            </label>
            <ActionButton label="Confirm" onClick={() => parseEmailList()} color="green" />
            <ActionButton label="Add" onClick={() => setEmailListText(prev => prev + (prev ? '\n' : '') + 'newuser@gmail.com')} color="gray" />
            <ActionButton label="Generate" onClick={handleGenerate} color="blue" />
          </div>
        </div>

        {/* ═══ RIGHT COLUMN — Task Status / Info ═══ */}
        <div className="w-72 bg-slate-800/50 border-l border-slate-700 flex flex-col">
          <div className="px-3 py-2.5 bg-slate-800 border-b border-slate-700">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Task Status</span>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto">
            {/* ── Counter: Total Send: X of Y ── */}
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total Sent</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {totalSent} <span className="text-gray-500 text-lg">of</span> {totalRecipients}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1 text-center text-xs text-gray-500">{progressPct}%</div>
            </div>

            {/* ── Delivery stats ── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-900/30 rounded-lg p-2 border border-green-700/30">
                <div className="text-xs text-green-400">Delivered</div>
                <div className="text-lg font-bold text-green-300 font-mono">{totalDelivered}</div>
              </div>
              <div className="bg-red-900/30 rounded-lg p-2 border border-red-700/30">
                <div className="text-xs text-red-400">Undelivered</div>
                <div className="text-lg font-bold text-red-300 font-mono">{totalUndelivered}</div>
              </div>
              <div className="bg-yellow-900/30 rounded-lg p-2 border border-yellow-700/30">
                <div className="text-xs text-yellow-400">Invalid</div>
                <div className="text-lg font-bold text-yellow-300 font-mono">{totalInvalid}</div>
              </div>
              <div className="bg-blue-900/30 rounded-lg p-2 border border-blue-700/30">
                <div className="text-xs text-blue-400">Selected</div>
                <div className="text-lg font-bold text-blue-300 font-mono">{selectedCount}</div>
              </div>
            </div>

            {/* ── Sender accounts summary ── */}
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
              <div className="text-xs font-bold text-gray-400 uppercase mb-2">Senders ({senders.length})</div>
              {senders.length === 0 ? (
                <div className="text-xs text-gray-500 py-2 text-center">
                  No accounts.<br />Upload credentials.json
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                  {senders.map(s => (
                    <div key={s._id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 truncate flex-1">{s.email}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400' : s.status === 'COOLDOWN' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                        {s.status}
                      </span>
                      <span className="ml-2 text-gray-500 font-mono">{s.remaining}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Status badge ── */}
            <div className="text-center">
              {sending ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900/40 border border-green-600/40 rounded-full">
                  <SmsIcon.Spinner />
                  <span className="text-green-400 text-sm font-semibold">Sending... {progressPct}%</span>
                </div>
              ) : totalSent > 0 ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900/40 border border-blue-600/40 rounded-full">
                  <SmsIcon.Success className="text-blue-400" />
                  <span className="text-blue-300 text-sm font-semibold">Successful</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/40 border border-slate-600/40 rounded-full">
                  <span className="text-gray-400 text-sm">Ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom action bar (Send / Stop / blue Success) ── */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Copyright 2024 BM2 Ultra. All Rights Reserved.</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Send button (green) */}
          <button
            onClick={handleSend}
            disabled={sending || totalRecipients === 0}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-600/20"
          >
            {sending ? <SmsIcon.Spinner /> : <SmsIcon.Send />}
            Send
          </button>

          {/* Stop button (red) */}
          <button
            onClick={handleStop}
            disabled={!sending || stopping}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {stopping ? <SmsIcon.Spinner /> : <SmsIcon.Stop />}
            Stop
          </button>

          {/* ═══ BLUE SUCCESS BUTTON ═══ */}
          {/* This is the primary action button — clicking it calls the Google API
              and sends SMS/emails to all selected recipients. */}
          <button
            onClick={handleSend}
            disabled={sending || totalRecipients === 0 || senders.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/30 border-2 border-blue-400/50"
          >
            {sending ? <SmsIcon.Spinner /> : <SmsIcon.Success />}
            Success
          </button>
        </div>
      </div>
    </div>
  );
}
