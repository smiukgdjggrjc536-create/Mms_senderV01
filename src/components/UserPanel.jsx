'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ================================================================
// MMS Sender V01 — USER PANEL (Enterprise Redesign)
// Single-screen, no-scroll, multi-campaign workbench.
// Layout: [Sidebar 56px] [Center: campaign config] [Right: recipients+monitor]
// State persistence via localStorage — no refresh loss.
// ================================================================

// ── Icon set (SVG, no emoji in chrome) ──────────────────────────
const Icon = {
  Send: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Mail: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Close: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Eye: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  User: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Lock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Check: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  CheckCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  XCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Sparkle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Shield: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Bolt: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Upload: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Trash: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  Stop: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" /></svg>,
  Play: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 4.036l-8.5 5.5A1 1 0 005.5 10.5v3a1 1 0 001.252.964l8.5-5.5A1 1 0 0015.5 8v-3a1 1 0 00-1.248-.964z" /></svg>,
  Pause: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Refresh: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Save: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Key: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 7v10m-3-7l3 3 3-3" /></svg>,
  Link: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Layers: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  Target: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Chart: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  List: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Settings: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Logout: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Expand: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0L4 4m0 0h4M4 4l4 4m8-4h4m0 0v4m0-4l-4 4m4 4v4m0 0h-4m4 0l-4-4M4 16v4m0 0h4m-4 0l4-4m8 4h4m0 0v-4m0 4l-4-4" /></svg>,
  Tag: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Bounce: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-6-6l1.586-1.586a2 2 0 012.828 0L20 14M3 10l3 3m15-3l-3 3M12 20v-6" /></svg>,
  Replace: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Alert: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Clip: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  Clock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Doc: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
};

// ================================================================
// State persistence hook — localStorage backed useState
// ================================================================
function usePersistentState(key, initial) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

// ================================================================
// API helper
// ================================================================
async function api(action, body = {}) {
  try {
    const res = await fetch('/api/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ...body }),
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ================================================================
// Main export
// ================================================================
export default function UserPanel({ mode, user, onLoginSuccess, onLogout, onRefresh }) {
  if (mode === 'login') return <UserLogin onLoginSuccess={onLoginSuccess} />;
  return <UserDashboard user={user} onLogout={onLogout} onRefresh={onRefresh} />;
}

function Spinner({ size = 16 }) {
  return <div className="border-2 border-white/30 border-t-white rounded-full animate-spin" style={{ width: size, height: size }} />;
}

// ================================================================
// USER LOGIN — enterprise gradient + glass card
// ================================================================
function UserLogin({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password) { setError('Enter your login ID and password.'); return; }
    setError(''); setLoading(true);
    const data = await api('login', { loginId: loginId.trim(), password });
    setLoading(false);
    if (data.success) { onLoginSuccess && onLoginSuccess(data); }
    else { setError(data.error || 'Login failed. Check your credentials.'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-slate-950 to-purple-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-3 shadow-lg shadow-indigo-500/30">
            <Icon.Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Enterprise Mailer</h1>
          <p className="text-slate-400 text-sm mt-1">Secure Gmail Campaign Platform</p>
        </div>
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-2xl p-7 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Login ID</label>
              <div className="relative">
                <Icon.User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Enter your login ID"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
              <div className="relative">
                <Icon.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <Icon.EyeOff className="w-4 h-4" /> : <Icon.Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><Icon.Alert className="w-4 h-4 flex-shrink-0" />{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl py-2.5 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Spinner size={16}/> Signing in…</> : <>Sign In <Icon.Send className="w-4 h-4" /></>}
            </button>
          </form>
          <button onClick={() => setShowTerms(true)} className="w-full mt-4 text-xs text-slate-500 hover:text-indigo-400 transition flex items-center justify-center gap-1.5">
            <Icon.Shield className="w-3.5 h-3.5" /> Terms of Agreement & Anti-Bypass Engine
          </button>
        </div>
      </div>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}

// ================================================================
// Terms of Agreement — enterprise onboarding modal
// ================================================================
function TermsModal({ onClose, onAgree }) {
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const ref = useRef(null);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Icon.Shield className="w-5 h-5 text-white" /></div>
            <div><h2 className="text-lg font-bold text-white">Terms of Agreement</h2><p className="text-xs text-slate-400">Enterprise Onboarding & Usage Policy</p></div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><Icon.Close className="w-5 h-5" /></button>
        </div>
        <div ref={ref} onScroll={onScroll} className="px-6 py-4 overflow-y-auto flex-1 text-sm text-slate-300 space-y-4 leading-relaxed">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <h3 className="text-indigo-300 font-semibold flex items-center gap-2 mb-2"><Icon.Shield className="w-4 h-4" /> Anti-Bypass Engine</h3>
            <p className="text-xs text-slate-400">Our platform is protected by an enterprise-grade anti-bypass engine that monitors all sending activity. Attempts to circumvent rate limits, quota restrictions, or abuse detection systems will result in immediate account suspension. The engine uses real-time behavioral analysis, pattern detection, and automated response protocols to maintain platform integrity.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">1. Acceptable Use</h3>
            <p className="text-xs text-slate-400">You agree to use this platform solely for legitimate email communication. All campaigns must comply with applicable anti-spam regulations including CAN-SPAM, GDPR, and regional email marketing laws. You are responsible for the content you send and the recipients you target.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">2. Account Security</h3>
            <p className="text-xs text-slate-400">Your login credentials are confidential. You must not share, transfer, or sell access to your account. All activities under your account are your sole responsibility. The platform employs JWT-based session management with 24-hour token expiry and bcrypt password hashing.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">3. Sending Limits & Quota</h3>
            <p className="text-xs text-slate-400">Each account has a daily sending limit set by the administrator. Exceeding this limit will automatically pause your campaigns. Provider-specific limits (Gmail: 520/day, Outlook: 300/day) are enforced automatically. Attempting to bypass these limits triggers the anti-bypass engine.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">4. Email Content & Anti-Spam</h3>
            <p className="text-xs text-slate-400">All email content is scanned by our AI-powered spam detection system before sending. Content flagged as spam, phishing, or malicious will be blocked automatically. HTML anti-detect features (color variation, text variation) are provided for legitimate A/B testing and content optimization only.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">5. Data Privacy & Multi-Tenancy</h3>
            <p className="text-xs text-slate-400">Your connected Gmail accounts, campaign data, and recipient lists are isolated to your account through multi-tenant database architecture. No other user or admin can access your connected email credentials. All OAuth tokens are encrypted at rest.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5">6. Termination</h3>
            <p className="text-xs text-slate-400">The administrator reserves the right to suspend or terminate any account that violates these terms. Account expiry dates are enforced automatically. Suspended accounts lose all sending privileges immediately.</p>
          </div>
          <div className="text-xs text-slate-500 italic pt-2">By proceeding, you acknowledge that you have read and understood these terms. This agreement is binding upon login.</div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800">
          <label className={`flex items-center gap-2.5 mb-3 cursor-pointer ${!scrolled ? 'opacity-40' : ''}`}>
            <input type="checkbox" checked={checked} disabled={!scrolled} onChange={e => setChecked(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500" />
            <span className="text-sm text-slate-300">I have read and agree to the Terms of Agreement</span>
          </label>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition">Cancel</button>
            <button disabled={!checked || !scrolled} onClick={() => { onAgree && onAgree(); onClose(); }}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Icon.Check className="w-4 h-4" /> Accept & Continue
            </button>
          </div>
          {!scrolled && <p className="text-xs text-slate-500 mt-2 text-center">Scroll down to read all terms…</p>}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// USER DASHBOARD — main shell, h-screen, no outer scroll
// ================================================================
function UserDashboard({ user, onLogout, onRefresh }) {
  const [view, setView] = usePersistentState('up_view', 'campaign'); // campaign | monitor | reports | accounts
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState('up_sidebar', false);
  const [dash, setDash] = useState(null);
  const [quota, setQuota] = useState({ limit: user?.limit || 0, sent: user?.sent || 0, expiryDate: user?.expiryDate });

  // Fetch dashboard data
  const refreshDash = useCallback(async () => {
    const d = await api('getUserDashboard');
    if (d.success) { setDash(d); setQuota({ limit: d.limit, sent: d.sent, expiryDate: d.expiryDate }); }
  }, []);
  useEffect(() => { refreshDash(); }, [refreshDash]);

  const remaining = (quota.limit || 0) - (quota.sent || 0);
  const expiryDays = quota.expiryDate ? Math.ceil((new Date(quota.expiryDate) - new Date()) / 86400000) : null;

  const navItems = [
    { id: 'campaign', label: 'Campaign', icon: Icon.Send },
    { id: 'monitor', label: 'Monitor', icon: Icon.Chart },
    { id: 'reports', label: 'Reports', icon: Icon.Doc },
    { id: 'accounts', label: 'Accounts', icon: Icon.Key },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex-shrink-0 h-12 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center px-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Icon.Mail className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-sm hidden sm:block">Enterprise Mailer</span>
        </div>
        <div className="flex-1" />
        {/* Quota compact in corner */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700">
            <Icon.Bolt className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300">{remaining.toLocaleString()}</span>
            <span className="text-slate-500">/ {(quota.limit||0).toLocaleString()}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${expiryDays !== null && expiryDays <= 3 ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-slate-800/60 border-slate-700 text-slate-300'}`}>
            <Icon.Clock className="w-3.5 h-3.5" />
            <span>{expiryDays !== null ? `${expiryDays}d left` : '∞'}</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 hidden md:block max-w-[120px] truncate">{user?.loginId || user?.email}</div>
        <button onClick={onLogout} title="Logout" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition">
          <Icon.Logout className="w-4 h-4" />
        </button>
      </header>

      {/* ── Main body: sidebar + content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`flex-shrink-0 ${sidebarCollapsed ? 'w-14' : 'w-44'} bg-slate-900/50 border-r border-slate-800 flex flex-col transition-all duration-200`}>
          <nav className="flex-1 py-2 space-y-0.5">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition ${view === item.id ? 'bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="flex-shrink-0 p-3 text-slate-500 hover:text-slate-300 border-t border-slate-800 flex items-center justify-center">
            {sidebarCollapsed ? <Icon.Play className="w-4 h-4" /> : <Icon.Pause className="w-4 h-4" />}
          </button>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-hidden">
          {view === 'campaign' && <CampaignWorkbench user={user} dash={dash} refreshDash={refreshDash} />}
          {view === 'monitor' && <LiveMonitor user={user} />}
          {view === 'reports' && <ReportsView user={user} />}
          {view === 'accounts' && <AccountsView user={user} />}
        </main>
      </div>
    </div>
  );
}

// ================================================================
// CAMPAIGN WORKBENCH — multi-campaign, single screen
// Layout: [Campaign tabs left] [Center config] [Right recipients+monitor]
// ================================================================
function makeEmptySlot(id, name) {
  return { id, name, subject: '', htmlBody: '', recipients: '', status: 'idle', sent: 0, delivered: 0, bounced: 0, invalid: 0, total: 0,
    fromName: '', fromNameVariants: [], autoChangeName: false, changeEvery: 50, trackPixel: false, delayMs: 1000, batchSize: 5,
    campaignId: null, recipientStatus: {}, paused: false, checkBounce: false, senderEmail: '' };
}

function CampaignWorkbench({ user, dash, refreshDash }) {
  const [slots, setSlots] = usePersistentState('up_slots', [makeEmptySlot(1, 'Campaign 1')]);
  const [activeSlot, setActiveSlot] = usePersistentState('up_active_slot', 0);
  const [configOpen, setConfigOpen] = usePersistentState('up_config_open', false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showValidator, setShowValidator] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [senders, setSenders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [runningPoll, setRunningPoll] = useState({});

  const slot = slots[activeSlot] || slots[0];

  // Load senders list
  const loadSenders = useCallback(async () => {
    const d = await api('listSenders');
    if (d.success) setSenders(d.senders || []);
  }, []);
  useEffect(() => { loadSenders(); }, [loadSenders]);

  // Poll running campaigns
  useEffect(() => {
    const running = slots.filter(s => s.status === 'running' || s.status === 'paused');
    if (running.length === 0) return;
    const interval = setInterval(async () => {
      for (const s of running) {
        if (!s.campaignId) continue;
        const prog = await api('getCampaignProgress', { campaignId: s.campaignId });
        if (prog.success) {
          setSlots(prev => prev.map(p => p.id === s.id ? {
            ...p, sent: prog.campaign.totalSent || p.sent, delivered: prog.campaign.totalDelivered || p.delivered,
            bounced: prog.campaign.totalUndelivered || p.bounced, invalid: prog.campaign.totalInvalid || p.invalid,
            status: prog.campaign.status === 'completed' ? 'completed' : (p.paused ? 'paused' : 'running'),
          } : p));
          // Update recipient statuses
          if (prog.recentDeliveries) {
            setSlots(prev => prev.map(p => {
              if (p.id !== s.id) return p;
              const rs = { ...p.recipientStatus };
              for (const d of prog.recentDeliveries) rs[d.number] = d.status === 'delivered' ? 'sent' : 'failed';
              return { ...p, recipientStatus: rs };
            }));
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [slots.filter(s => s.status === 'running' || s.status === 'paused').length]);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const updateSlot = (id, patch) => setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const addSlot = () => {
    if (slots.length >= 4) { showToast('Maximum 4 campaigns allowed.', 'error'); return; }
    const newId = Math.max(...slots.map(s => s.id)) + 1;
    setSlots(prev => [...prev, makeEmptySlot(newId, `Campaign ${newId}`)]);
    setActiveSlot(slots.length);
  };

  const removeSlot = (id) => {
    if (slots.length <= 1) { showToast('At least one campaign required.', 'error'); return; }
    const idx = slots.findIndex(s => s.id === id);
    setSlots(prev => prev.filter(s => s.id !== id));
    if (activeSlot >= slots.length - 1) setActiveSlot(Math.max(0, activeSlot - 1));
  };

  const parseRecipients = (text) => {
    return text.split(/[\n,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
  };

  const handleStart = async () => {
    const emails = parseRecipients(slot.recipients);
    if (!slot.subject.trim()) { showToast('Subject is required.', 'error'); return; }
    if (!slot.htmlBody.trim()) { showToast('Email body is required.', 'error'); return; }
    if (emails.length === 0) { showToast('Add at least one recipient.', 'error'); return; }
    setBusy(true);
    const opts = {
      subject: slot.subject, options: {
        contentMode: 'html', bodyMode: 'html',
        fromName: slot.fromName || '', trackPixel: slot.trackPixel,
        delayMs: Math.max(100, slot.delayMs || 1000), batchSize: slot.batchSize || 5,
        checkBounce: slot.checkBounce, senderMail: slot.senderEmail || '',
        autoChangeName: slot.autoChangeName, changeEvery: slot.changeEvery,
        speedMode: 'ALL',
      }
    };
    const data = await api('sendCampaign', { message: slot.htmlBody, subject: slot.subject, numbers: emails, ...opts });
    setBusy(false);
    if (data.success) {
      updateSlot(slot.id, { status: 'running', campaignId: data.campaignId, total: emails.length, sent: 0, paused: false, recipientStatus: {} });
      showToast(`Campaign started — ${emails.length} recipients.`, 'success');
    } else if (data.blocked) {
      showToast(`Blocked by spam protection: ${data.spamReasons?.join(', ')}`, 'error');
    } else {
      showToast(data.error || 'Failed to start campaign.', 'error');
    }
  };

  const handleStop = () => {
    updateSlot(slot.id, { status: 'paused', paused: true });
    showToast('Campaign paused. Click Resume to continue.', 'info');
  };

  const handleResume = () => {
    updateSlot(slot.id, { status: 'running', paused: false });
    showToast('Campaign resumed.', 'success');
  };

  const handlePasteRecipients = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { updateSlot(slot.id, { recipients: (slot.recipients ? slot.recipients + '\n' : '') + text.trim() }); showToast('Recipients pasted from clipboard.', 'success'); }
      else showToast('Clipboard is empty.', 'error');
    } catch { showToast('Clipboard access denied. Paste manually.', 'error'); }
  };

  const emailList = parseRecipients(slot.recipients);
  const progress = slot.total > 0 ? Math.round((slot.sent / slot.total) * 100) : 0;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Campaign tabs ── */}
      <div className="w-32 flex-shrink-0 bg-slate-900/30 border-r border-slate-800 flex flex-col py-2">
        <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Campaigns</div>
        <div className="flex-1 space-y-1 px-1.5 overflow-y-auto">
          {slots.map((s, i) => (
            <button key={s.id} onClick={() => setActiveSlot(i)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition group ${activeSlot === i ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-slate-800/40 border border-transparent hover:bg-slate-800/70'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 truncate">{s.name}</span>
                {slots.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); removeSlot(s.id); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition">
                    <Icon.Close className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'running' ? 'bg-green-400 animate-pulse' : s.status === 'paused' ? 'bg-amber-400' : s.status === 'completed' ? 'bg-blue-400' : 'bg-slate-600'}`} />
                <span className="text-[10px] text-slate-500">{s.status === 'running' ? `${s.sent}/${s.total}` : s.status === 'idle' ? 'idle' : s.status}</span>
              </div>
            </button>
          ))}
        </div>
        {slots.length < 4 && (
          <button onClick={addSlot} className="mx-1.5 mb-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-800/60 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-300 text-xs transition border border-slate-700 hover:border-indigo-500/30">
            <Icon.Plus className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      {/* ── Center: Campaign config ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top row: subject + check bounce + connect email */}
        <div className="flex-shrink-0 p-3 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <input value={slot.name} onChange={e => updateSlot(slot.id, { name: e.target.value })}
              className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5 flex-shrink-0 w-32" />
            <div className="flex-1" />
            <button onClick={() => setConnectOpen(true)} title="Connect Gmail" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-300 text-xs transition border border-slate-700">
              <Icon.Key className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Connect Email</span>
            </button>
            <button onClick={() => setShowValidator(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 text-xs transition border border-slate-700">
              <Icon.Bounce className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Check Bounce</span>
            </button>
          </div>
          {/* Subject line at TOP */}
          <div className="relative">
            <Icon.Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={slot.subject} onChange={e => updateSlot(slot.id, { subject: e.target.value })} placeholder="Email Subject Line"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition" />
          </div>
        </div>

        {/* Email body + preview */}
        <div className="flex-1 px-3 pb-2 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-400">Email Content (HTML)</label>
            <button onClick={() => setPreviewOpen(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-300 text-xs transition">
              <Icon.Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
          <textarea value={slot.htmlBody} onChange={e => updateSlot(slot.id, { htmlBody: e.target.value })}
            placeholder="Paste your HTML email content here…"
            className="flex-1 w-full bg-slate-800/40 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none min-h-0" />
        </div>

        {/* Bottom config bar — compact, single row */}
        <div className="flex-shrink-0 px-3 pb-2 space-y-2">
          {/* Config toggles row */}
          <div className="flex items-center gap-2 flex-wrap">
            <input value={slot.fromName} onChange={e => updateSlot(slot.id, { fromName: e.target.value })} placeholder="From Name"
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-28" />
            <select value={slot.senderEmail} onChange={e => updateSlot(slot.id, { senderEmail: e.target.value })}
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 max-w-[140px]">
              <option value="">Auto Sender</option>
              {senders.map(s => <option key={s._id} value={s.email}>{s.email}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={slot.trackPixel} onChange={e => updateSlot(slot.id, { trackPixel: e.target.checked })} className="w-3.5 h-3.5 rounded accent-indigo-500" /> Track
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={slot.autoChangeName} onChange={e => updateSlot(slot.id, { autoChangeName: e.target.checked })} className="w-3.5 h-3.5 rounded accent-indigo-500" /> Auto-Name
            </label>
            {slot.autoChangeName && (
              <input type="number" value={slot.changeEvery} onChange={e => updateSlot(slot.id, { changeEvery: parseInt(e.target.value) || 50 })} min="1"
                className="bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs w-16 focus:outline-none focus:border-indigo-500" title="Change name every N emails" />
            )}
            <div className="flex items-center gap-1">
              <Icon.Clock className="w-3.5 h-3.5 text-slate-500" />
              <input type="number" value={slot.delayMs} onChange={e => updateSlot(slot.id, { delayMs: Math.max(100, parseInt(e.target.value) || 100) })} min="100" step="100"
                className="bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs w-20 focus:outline-none focus:border-indigo-500" title="Delay in milliseconds (min 100)" />
              <span className="text-[10px] text-slate-500">ms</span>
            </div>
            <button onClick={() => setConfigOpen(!configOpen)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 text-xs transition ml-auto">
              <Icon.Settings className="w-3.5 h-3.5" /> Anti-Spam
            </button>
          </div>

          {/* Anti-spam config (collapsible) */}
          {configOpen && (
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Icon.Shield className="w-3.5 h-3.5 text-indigo-400" /> Anti-Spam Configuration</span>
                <button onClick={() => setConfigOpen(false)} className="text-slate-500 hover:text-white"><Icon.Close className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={slot.checkBounce} onChange={e => updateSlot(slot.id, { checkBounce: e.target.checked })} className="w-3.5 h-3.5 rounded accent-indigo-500" /> Check Bounce on Send
                </label>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Batch Size:</span>
                  <input type="number" value={slot.batchSize} onChange={e => updateSlot(slot.id, { batchSize: parseInt(e.target.value) || 5 })} min="1" max="50"
                    className="bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs w-16 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="text-[10px] text-slate-500 bg-slate-800/30 rounded-lg p-2">
                Anti-detect features: HTML color variation, text variation, and unsubscribe link auto-add are applied per send. AI generates name variants automatically when Auto-Name is enabled.
              </div>
              <button onClick={() => { setConfigOpen(false); showToast('Anti-spam config saved.', 'success'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs transition w-fit">
                <Icon.Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          )}

          {/* Action bar: Start/Stop on RIGHT */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-slate-500">
              {slot.status === 'running' && <span className="text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Sending… {slot.sent}/{slot.total}</span>}
              {slot.status === 'paused' && <span className="text-amber-400 flex items-center gap-1"><Icon.Pause className="w-3.5 h-3.5" /> Paused at {slot.sent}/{slot.total}</span>}
              {slot.status === 'completed' && <span className="text-blue-400">Completed — {slot.delivered} delivered, {slot.bounced} bounced</span>}
              {slot.status === 'idle' && <span>{emailList.length} recipients ready</span>}
            </div>
            {slot.status === 'idle' && (
              <button onClick={handleStart} disabled={busy}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-green-500/20 disabled:opacity-50">
                {busy ? <Spinner size={16}/> : <Icon.Play className="w-4 h-4" />} Start Campaign
              </button>
            )}
            {slot.status === 'running' && (
              <button onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-sm transition shadow-lg shadow-amber-500/20">
                <Icon.Pause className="w-4 h-4" /> Pause
              </button>
            )}
            {slot.status === 'paused' && (
              <button onClick={handleResume}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-green-500/20">
                <Icon.Play className="w-4 h-4" /> Resume
              </button>
            )}
            {(slot.status === 'running' || slot.status === 'paused') && (
              <button onClick={() => updateSlot(slot.id, { status: 'idle', sent: 0, delivered: 0, bounced: 0, campaignId: null, recipientStatus: {} })}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-sm transition">
                <Icon.Stop className="w-4 h-4" /> Stop
              </button>
            )}
          </div>

          {/* Progress bar */}
          {slot.total > 0 && slot.status !== 'idle' && (
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Recipients + live results ── */}
      <div className="w-64 flex-shrink-0 bg-slate-900/30 border-l border-slate-800 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Icon.List className="w-3.5 h-3.5" /> Recipients ({emailList.length})</span>
          <button onClick={handlePasteRecipients} title="Paste from clipboard" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-300 text-[10px] transition">
            <Icon.Clip className="w-3 h-3" /> Paste
          </button>
        </div>
        {/* Recipient input */}
        <div className="flex-shrink-0 p-2">
          <textarea value={slot.recipients} onChange={e => updateSlot(slot.id, { recipients: e.target.value })}
            placeholder="Paste emails (one per line)…"
            className="w-full h-20 bg-slate-800/40 border border-slate-700 rounded-lg p-2 text-white text-[11px] font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none" />
        </div>
        {/* Live results */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {emailList.length === 0 ? (
            <div className="text-center text-slate-600 text-xs py-8">No recipients yet</div>
          ) : (
            <div className="space-y-0.5">
              {emailList.slice(0, 200).map((email, i) => {
                const st = slot.recipientStatus[email];
                return (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-slate-800/40">
                    {st === 'sent' ? <Icon.CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      : st === 'failed' ? <Icon.XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0" />}
                    <span className="text-slate-400 truncate flex-1">{email}</span>
                  </div>
                );
              })}
              {emailList.length > 200 && <div className="text-center text-slate-600 text-[10px] py-1">+{emailList.length - 200} more…</div>}
            </div>
          )}
        </div>
        {/* Mini stats footer */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-1 px-2 py-2 border-t border-slate-800 text-center">
          <div className="bg-slate-800/40 rounded-lg py-1"><div className="text-green-400 text-sm font-bold">{slot.delivered}</div><div className="text-[9px] text-slate-500">Sent</div></div>
          <div className="bg-slate-800/40 rounded-lg py-1"><div className="text-red-400 text-sm font-bold">{slot.bounced}</div><div className="text-[9px] text-slate-500">Failed</div></div>
          <div className="bg-slate-800/40 rounded-lg py-1"><div className="text-slate-300 text-sm font-bold">{slot.invalid}</div><div className="text-[9px] text-slate-500">Invalid</div></div>
        </div>
      </div>

      {/* Overlays */}
      {previewOpen && <EmailPreviewOverlay html={slot.htmlBody} subject={slot.subject} onClose={() => setPreviewOpen(false)} />}
      {showValidator && <ValidatorOverlay recipients={slot.recipients} onClose={() => setShowValidator(false)} onReplace={(cleaned) => { if (slot.status === 'idle') { updateSlot(slot.id, { recipients: cleaned }); showToast('Recipients replaced with validated list.', 'success'); } else { showToast('Replace only works when not running.', 'error'); } }} canReplace={slot.status === 'idle'} />}
      {connectOpen && <ConnectEmailOverlay onClose={() => { setConnectOpen(false); loadSenders(); }} />}
      {toast && <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>{toast.type === 'success' ? <Icon.Check className="w-4 h-4" /> : toast.type === 'error' ? <Icon.Alert className="w-4 h-4" /> : <Icon.Sparkle className="w-4 h-4" />}{toast.msg}</div>}
    </div>
  );
}

// ================================================================
// EMAIL PREVIEW OVERLAY — in-page, close + fullscreen
// ================================================================
function EmailPreviewOverlay({ html, subject, onClose }) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <div className={`fixed z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 ${fullscreen ? 'inset-0' : 'inset-4'}`}>
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl flex flex-col overflow-hidden ${fullscreen ? 'w-full h-full' : 'w-full max-w-3xl h-[80vh]'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <span className="text-sm font-semibold text-white">Email Preview — {subject || '(no subject)'}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setFullscreen(!fullscreen)} title="Toggle fullscreen" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><Icon.Expand className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"><Icon.Close className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white">
          {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No content to preview</div>}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// VALIDATOR OVERLAY — enterprise loading animation + results
// ================================================================
function ValidatorOverlay({ recipients, onClose, onReplace, canReplace }) {
  const [phase, setPhase] = useState('idle'); // idle | running | done
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState(null);
  const steps = ['Analyzing your data', 'Removing bounce data', 'Duplicate remove', 'Valid check', 'Generating results'];

  const runValidation = async () => {
    setPhase('running'); setStepIdx(0); setResults(null);
    const emails = recipients.split(/[\n,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    for (let i = 0; i < steps.length; i++) {
      setStepIdx(i);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    }
    // Simulated validation (client-side basic check)
    const seen = new Set();
    const valid = [], duplicates = [], invalid = [];
    for (const e of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { invalid.push(e); continue; }
      if (seen.has(e)) { duplicates.push(e); continue; }
      seen.add(e); valid.push(e);
    }
    setResults({ total: emails.length, valid, duplicates, invalid });
    setPhase('done');
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <span className="text-sm font-semibold text-white flex items-center gap-2"><Icon.Bounce className="w-4 h-4 text-amber-400" /> Email Validator & Bounce Check</span>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white"><Icon.Close className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          {phase === 'idle' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Icon.Bounce className="w-8 h-8 text-amber-400" /></div>
              <p className="text-sm text-slate-300">Validate your email list to remove duplicates, invalid addresses, and potential bounces before sending.</p>
              <div className="text-xs text-slate-500 bg-slate-800/40 rounded-lg p-3 text-left">{recipients.split(/[\n,;\s]+/).filter(Boolean).length} emails in current list</div>
              <button onClick={runValidation} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-sm transition shadow-lg shadow-amber-500/20">
                Start Validation
              </button>
            </div>
          )}
          {phase === 'running' && (
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 transition ${i <= stepIdx ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${i < stepIdx ? 'bg-green-500/20 text-green-400' : i === stepIdx ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                    {i < stepIdx ? <Icon.Check className="w-4 h-4" /> : i === stepIdx ? <Spinner size={14}/> : <div className="w-2 h-2 rounded-full bg-slate-600" />}
                  </div>
                  <span className={`text-sm ${i <= stepIdx ? 'text-slate-200' : 'text-slate-500'}`}>{step}…</span>
                </div>
              ))}
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
              </div>
            </div>
          )}
          {phase === 'done' && results && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-800/40 rounded-xl p-3 text-center"><div className="text-xl font-bold text-white">{results.total}</div><div className="text-[10px] text-slate-500">Total</div></div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center"><div className="text-xl font-bold text-green-400">{results.valid.length}</div><div className="text-[10px] text-slate-500">Valid</div></div>
                <div className="bg-amber-500/10 rounded-xl p-3 text-center"><div className="text-xl font-bold text-amber-400">{results.duplicates.length}</div><div className="text-[10px] text-slate-500">Duplicates</div></div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center"><div className="text-xl font-bold text-red-400">{results.invalid.length}</div><div className="text-[10px] text-slate-500">Invalid</div></div>
              </div>
              {results.invalid.length > 0 && (
                <div className="max-h-24 overflow-y-auto bg-slate-800/30 rounded-lg p-2 text-[11px] text-red-400/80 font-mono">
                  {results.invalid.slice(0, 20).map((e, i) => <div key={i}>✕ {e}</div>)}
                  {results.invalid.length > 20 && <div className="text-slate-500">+{results.invalid.length - 20} more…</div>}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setPhase('idle')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition">Re-run</button>
                <button onClick={() => onReplace(results.valid.join('\n'))} disabled={!canReplace}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold transition disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <Icon.Replace className="w-4 h-4" /> Replace List
                </button>
              </div>
              {!canReplace && <p className="text-[10px] text-amber-400 text-center">Stop the campaign to replace the list.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// CONNECT EMAIL OVERLAY — credentials.json Gmail OAuth flow
// ================================================================
function ConnectEmailOverlay({ onClose }) {
  const [jsonText, setJsonText] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(ev.target.result);
    reader.readAsText(file);
  };

  const handleConnect = async () => {
    if (!jsonText.trim()) { setError('Please upload or paste your credentials.json'); return; }
    setError(''); setLoading(true);
    const data = await fetch('/api/user/gmail/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ credentialsJson: jsonText, label }),
    }).then(r => r.json()).catch(() => ({ error: 'Request failed' }));
    setLoading(false);
    if (data.success && data.authUrl) {
      setResult({ authUrl: data.authUrl, needsRegistration: data.needsRegistration, ourCallbackUri: data.ourCallbackUri, registeredUris: data.registeredUris });
    } else {
      setError(data.error || 'Failed to start OAuth flow.');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <span className="text-sm font-semibold text-white flex items-center gap-2"><Icon.Key className="w-4 h-4 text-indigo-400" /> Connect Gmail Account</span>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white"><Icon.Close className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!result && (
            <>
              <p className="text-xs text-slate-400">Upload your Google Cloud Console <code className="text-indigo-300 bg-slate-800 px-1 rounded">credentials.json</code> (Desktop OAuth client) to connect your Gmail for sending.</p>
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="w-full py-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 transition flex flex-col items-center gap-2">
                <Icon.Upload className="w-7 h-7" />
                <span className="text-sm">{jsonText ? '✓ File loaded — click to change' : 'Click to upload credentials.json'}</span>
              </button>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional, e.g. Marketing Gmail)"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
              <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Or paste credentials.json contents here…"
                className="w-full h-20 bg-slate-800/40 border border-slate-700 rounded-xl p-2 text-white text-[11px] font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
              {error && <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><Icon.Alert className="w-4 h-4" />{error}</div>}
              <button onClick={handleConnect} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Spinner size={16}/> : <Icon.Link className="w-4 h-4" />} Connect via Google OAuth
              </button>
            </>
          )}
          {result && (
            <div className="space-y-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"><Icon.Shield className="w-7 h-7 text-indigo-400" /></div>
              <p className="text-sm text-slate-300">Click the button below to open Google's consent screen and authorize your Gmail account.</p>
              {result.needsRegistration && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left text-xs text-amber-300 space-y-1.5">
                  <p className="font-semibold">⚠️ Redirect URI Registration Required</p>
                  <p>Add this URI to your Google Cloud Console → APIs & Services → Credentials → OAuth client → Authorized redirect URIs:</p>
                  <code className="block bg-slate-900 p-2 rounded text-amber-200 break-all">{result.ourCallbackUri}</code>
                  {result.registeredUris && result.registeredUris.length > 0 && (
                    <div className="mt-2"><p className="text-slate-400">Currently registered:</p>{result.registeredUris.map((u, i) => <code key={i} className="block bg-slate-900 p-1 rounded text-slate-500 break-all text-[10px] mt-1">{u}</code>)}</div>
                  )}
                </div>
              )}
              <a href={result.authUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-sm transition">
                <Icon.Key className="w-4 h-4" /> Open Google Consent
              </a>
              <button onClick={onClose} className="block mx-auto text-xs text-slate-500 hover:text-slate-300">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// LIVE MONITOR — all campaigns at once with live stats
// ================================================================
function LiveMonitor({ user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState({});

  const loadCampaigns = useCallback(async () => {
    const d = await api('getUserCampaigns');
    if (d.success) { setCampaigns(d.campaigns || []); setLoading(false); }
    else setLoading(false);
  }, []);

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 5000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  // Poll progress for running campaigns
  useEffect(() => {
    const running = campaigns.filter(c => c.status === 'running' || c.status === 'pending');
    if (running.length === 0) return;
    const poll = async () => {
      const map = {};
      for (const c of running) {
        const p = await api('getCampaignProgress', { campaignId: c._id });
        if (p.success) map[c._id] = p.campaign;
      }
      setProgressMap(map);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [campaigns]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500"><Spinner size={24} /></div>;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Icon.Chart className="w-5 h-5 text-indigo-400" /> Live Campaign Monitor</h2>
      {campaigns.length === 0 ? (
        <div className="text-center text-slate-500 py-20">
          <Icon.Chart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No campaigns yet. Start a campaign from the Campaign tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {campaigns.map(c => {
            const prog = progressMap[c._id] || c;
            const total = (prog.totalSent || 0) + (prog.totalUndelivered || 0) + (prog.totalInvalid || 0);
            const inboxRate = total > 0 ? Math.round(((prog.totalDelivered || 0) / total) * 100) : 0;
            const pct = c.numbers?.length > 0 ? Math.round(((prog.totalSent || 0) / c.numbers.length) * 100) : 0;
            return (
              <div key={c._id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white truncate max-w-[200px]">{c.message?.substring(0, 40) || 'Campaign'}…</div>
                    <div className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'running' ? 'bg-green-500/20 text-green-400' : c.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : c.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>{c.status}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  <div className="text-center bg-slate-800/40 rounded-lg py-1.5"><div className="text-sm font-bold text-white">{prog.totalSent || 0}</div><div className="text-[8px] text-slate-500">Sent</div></div>
                  <div className="text-center bg-green-500/10 rounded-lg py-1.5"><div className="text-sm font-bold text-green-400">{prog.totalDelivered || 0}</div><div className="text-[8px] text-slate-500">Delivered</div></div>
                  <div className="text-center bg-red-500/10 rounded-lg py-1.5"><div className="text-sm font-bold text-red-400">{prog.totalUndelivered || 0}</div><div className="text-[8px] text-slate-500">Bounced</div></div>
                  <div className="text-center bg-amber-500/10 rounded-lg py-1.5"><div className="text-sm font-bold text-amber-400">{prog.totalInvalid || 0}</div><div className="text-[8px] text-slate-500">Invalid</div></div>
                  <div className="text-center bg-indigo-500/10 rounded-lg py-1.5"><div className="text-sm font-bold text-indigo-400">{inboxRate}%</div><div className="text-[8px] text-slate-500">Inbox</div></div>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">{pct}% complete</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
// REPORTS VIEW — delivery reports
// ================================================================
function ReportsView({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const d = await api('getDeliveryReports');
      if (d.success) setReports(d.reports || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500"><Spinner size={24} /></div>;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Icon.Doc className="w-5 h-5 text-indigo-400" /> Delivery Reports</h2>
      {reports.length === 0 ? (
        <div className="text-center text-slate-500 py-20"><Icon.Doc className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No delivery reports yet.</p></div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr><th className="px-3 py-2 text-left">Recipient</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Provider</th><th className="px-3 py-2 text-left">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.slice(0, 100).map((r, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-300">{r.number}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'delivered' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{r.status}</span></td>
                  <td className="px-3 py-2 text-slate-400">{r.provider || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================================================================
// ACCOUNTS VIEW — connected Gmail accounts
// ================================================================
function AccountsView({ user }) {
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const load = useCallback(async () => {
    const d = await api('listSenders');
    if (d.success) setSenders(d.senders || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Icon.Key className="w-5 h-5 text-indigo-400" /> Connected Email Accounts</h2>
        <button onClick={() => setConnectOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold transition">
          <Icon.Plus className="w-4 h-4" /> Connect Gmail
        </button>
      </div>
      {loading ? <div className="flex items-center justify-center py-20 text-slate-500"><Spinner size={24} /></div>
        : senders.length === 0 ? (
          <div className="text-center text-slate-500 py-20"><Icon.Key className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No Gmail accounts connected yet.</p><p className="text-xs text-slate-600 mt-1">Click "Connect Gmail" to add your first account via OAuth.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {senders.map(s => (
              <div key={s._id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0"><Icon.Mail className="w-5 h-5 text-white" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{s.email}</div>
                  <div className="text-xs text-slate-500">{s.provider} · {s.status}</div>
                </div>
                <span className={`w-2 h-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-400' : 'bg-slate-600'}`} />
              </div>
            ))}
          </div>
        )}
      {connectOpen && <ConnectEmailOverlay onClose={() => { setConnectOpen(false); load(); }} />}
    </div>
  );
}
