'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ================================================================
// Icon set (professional SVG, NO emoji)
// ================================================================
const Icon = {
  Send: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Dashboard: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 9a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-3a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" /></svg>,
  Report: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Info: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Chat: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  Close: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Send2: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Eye: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  User: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Lock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Alert: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  Sparkle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Phone: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Mail: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Whatsapp: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Logout: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Refresh: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Clock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Globe: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Inbox: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" /></svg>,
  Shield: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Bolt: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Activity: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Upload: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Trash: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

// ================================================================
// Main export
// ================================================================
export default function UserPanel({ mode, user, onLoginSuccess, onLogout, onRefresh }) {
  if (mode === 'login') {
    return <UserLogin onLoginSuccess={onLoginSuccess} />;
  }
  return <UserDashboard user={user} onLogout={onLogout} onRefresh={onRefresh} />;
}

// ================================================================
// Spinner / Loading
// ================================================================
function Spinner({ size = 16 }) {
  return (
    <div
      className={`border-2 border-white/30 border-t-white rounded-full animate-spin`}
      style={{ width: size, height: size }}
    />
  );
}

// ================================================================
// USER LOGIN — purple/indigo enterprise theme, shows admin-set info
// ================================================================
function UserLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [settings, setSettings] = useState(null);

  // Fetch public app settings (platform name, description, contact)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getAppSettings' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) setSettings(data.settings);
        }
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const action = isRegister ? 'registerUser' : 'login';
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({
          role: data.role,
          limit: data.limit,
          sent: data.sent,
          email: data.email,
          status: 'active',
        });
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const platformName = settings?.platformName || 'MMS Sender';
  const description = settings?.description || 'Enterprise MMS Sending Platform';
  const whatsapp = settings?.whatsapp || '';
  const contactEmail = settings?.email || '';
  const logoUrl = settings?.logoUrl || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo / Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-4 shadow-lg shadow-purple-500/30 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <Icon.Send className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {platformName}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-800 shadow-2xl">
          <div className="flex gap-2 mb-6 p-1 bg-gray-800/50 rounded-lg">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                !isRegister ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                isRegister ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email / Username</label>
              <div className="relative">
                <Icon.User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <Icon.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <Icon.EyeOff className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/40 border border-red-700/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                <Icon.Alert className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold transition shadow-lg shadow-purple-500/20 text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : null}
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Contact info (admin-set) */}
          {(whatsapp || contactEmail) && (
            <div className="mt-5 pt-4 border-t border-gray-800 space-y-2">
              <p className="text-xs text-gray-500 font-medium mb-2">Need help? Contact us:</p>
              {whatsapp && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Icon.Whatsapp className="w-4 h-4 text-green-500" />
                  <span>{whatsapp}</span>
                </div>
              )}
              {contactEmail && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Icon.Mail className="w-4 h-4 text-indigo-400" />
                  <span>{contactEmail}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Toast hook
// ================================================================
function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((msg, type = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ================================================================
// StatCard
// ================================================================
function StatCard({ icon: I, label, value, sub, color = 'purple' }) {
  const colors = {
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20 text-purple-400',
    green: 'from-green-600/20 to-green-600/5 border-green-500/20 text-green-400',
    red: 'from-red-600/20 to-red-600/5 border-red-500/20 text-red-400',
    yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400',
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    indigo: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <I className="w-5 h-5 opacity-70" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ================================================================
// ProgressBar
// ================================================================
function ProgressBar({ value, max, color = 'green' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const bg = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ================================================================
// Tab button
// ================================================================
function TabBtn({ icon: I, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition w-full text-left ${
        active
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      <I className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}

// ================================================================
// USER DASHBOARD — Enterprise
// ================================================================
function UserDashboard({ user, onLogout, onRefresh }) {
  const { toast, show } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [deliveryReports, setDeliveryReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Live countdown for quota / expiry
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch all dashboard data
  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, campRes, tmplRes, setRes] = await Promise.all([
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getUserDashboard' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getUserCampaigns' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getTemplates' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getAppSettings' }) }),
      ]);
      const dash = await dashRes.json();
      if (dash.success) setStats(dash);
      const camp = await campRes.json();
      if (camp.campaigns) setCampaigns(camp.campaigns);
      const tmpl = await tmplRes.json();
      if (tmpl.templates) setTemplates(tmpl.templates.filter(t => t.isActive));
      const set = await setRes.json();
      if (set.settings) setSettings(set.settings);
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30 seconds
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // Refresh delivery reports when a campaign is selected
  const fetchDeliveryReports = useCallback(async (campaignId) => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'getDeliveryReports', campaignId }),
      });
      const data = await res.json();
      if (data.reports) setDeliveryReports(data.reports);
    } catch {}
  }, []);

  const platformName = settings?.platformName || 'MMS Sender';
  const logoUrl = settings?.logoUrl || '';
  const language = settings?.language || 'en';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-indigo-600 text-white'
        }`}>
          {toast.type === 'success' ? <Icon.Check className="w-4 h-4" /> : toast.type === 'error' ? <Icon.Alert className="w-4 h-4" /> : <Icon.Info className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-60 min-h-screen bg-gray-900/60 backdrop-blur border-r border-gray-800 p-4 hidden sm:flex flex-col gap-1 fixed">
          <div className="flex items-center gap-2 px-2 py-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{platformName}</div>
              <div className="text-[10px] text-gray-500">User Panel</div>
            </div>
          </div>

          <TabBtn icon={Icon.Dashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <TabBtn icon={Icon.Send} label="Send MMS" active={activeTab === 'send'} onClick={() => setActiveTab('send')} />
          <TabBtn icon={Icon.Report} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <TabBtn icon={Icon.Info} label="App Info" active={activeTab === 'info'} onClick={() => setActiveTab('info')} />

          <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-2">
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition"
            >
              <Icon.Logout className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="sm:hidden fixed top-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-4 h-4 text-white" />}
            </div>
            <span className="text-sm font-bold text-white">{platformName}</span>
          </div>
          <button onClick={onLogout} className="text-red-400"><Icon.Logout className="w-5 h-5" /></button>
        </div>

        {/* Main content */}
        <main className="flex-1 sm:ml-60 p-4 sm:p-6 mt-14 sm:mt-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'send' && 'Send MMS Campaign'}
                {activeTab === 'reports' && 'Delivery Reports'}
                {activeTab === 'info' && 'App Information'}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                Logged in as <span className="text-purple-300 font-medium">{stats?.email || user?.email}</span>
              </p>
            </div>
          </div>

          {/* Mobile tab bar */}
          <div className="sm:hidden flex gap-1 mb-4 overflow-x-auto pb-1">
            {[
              { k: 'dashboard', l: 'Dashboard', I: Icon.Dashboard },
              { k: 'send', l: 'Send', I: Icon.Send },
              { k: 'reports', l: 'Reports', I: Icon.Report },
              { k: 'info', l: 'Info', I: Icon.Info },
            ].map(({ k, l, I }) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                  activeTab === k ? 'bg-purple-600 text-white' : 'bg-gray-800/50 text-gray-400'
                }`}
              >
                <I className="w-4 h-4" /> {l}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'dashboard' && (
            <DashboardTab stats={stats} loading={loadingStats} now={now} language={language} />
          )}
          {activeTab === 'send' && (
            <SendTab
              stats={stats}
              templates={templates}
              campaigns={campaigns}
              onSent={(msg, type) => { show(msg, type); fetchAll(); }}
              onCampaignClick={fetchDeliveryReports}
              language={language}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsTab
              campaigns={campaigns}
              deliveryReports={deliveryReports}
              onCampaignClick={fetchDeliveryReports}
            />
          )}
          {activeTab === 'info' && <InfoTab settings={settings} />}

          {/* Scheduled sends at bottom of dashboard */}
          {activeTab === 'send' && <ScheduledSection language={language} onToast={show} />}
        </main>
      </div>

      {/* AI Chat popup — right side floating */}
      <AIChatPopup language={language} />
    </div>
  );
}

// ================================================================
// DASHBOARD TAB — live quota, inbox rate, spam, invalid, expiry
// ================================================================
function DashboardTab({ stats, loading, now, language }) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const remaining = stats.remaining ?? Math.max((stats.limit || 0) - (stats.sent || 0), 0);
  const usagePct = stats.limit > 0 ? Math.min((stats.sent / stats.limit) * 100, 100) : 0;

  // Expiry countdown
  let expiryStr = 'No expiry set';
  let expirySeconds = null;
  if (stats.expiryDate) {
    const exp = new Date(stats.expiryDate).getTime();
    expirySeconds = Math.max(0, Math.floor((exp - now) / 1000));
    if (expirySeconds <= 0) {
      expiryStr = 'Expired';
    } else {
      const d = Math.floor(expirySeconds / 86400);
      const h = Math.floor((expirySeconds % 86400) / 3600);
      const m = Math.floor((expirySeconds % 3600) / 60);
      const s = expirySeconds % 60;
      expiryStr = `${d}d ${h}h ${m}m ${s}s`;
    }
  }

  const expired = expirySeconds !== null && expirySeconds <= 0;

  return (
    <div className="space-y-6">
      {/* Suspended/expired warning */}
      {expired && (
        <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-200 text-sm flex items-center gap-2">
          <Icon.Alert className="w-5 h-5" /> Your account has expired. Please contact the administrator to renew.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Icon.Send2} label="Quota Remaining" value={remaining} sub={`of ${stats.limit || 0} total`} color="purple" />
        <StatCard icon={Icon.Inbox} label="Inbox Rate" value={`${stats.inboxRate || 0}%`} sub={`${stats.totalInbox || 0} inbox hits`} color="green" />
        <StatCard icon={Icon.Shield} label="Spam Rate" value={`${stats.spamRate || 0}%`} sub={`${stats.totalSpam || 0} spam hits`} color="red" />
        <StatCard icon={Icon.Alert} label="Invalid Hits" value={stats.invalidHits || 0} sub="rejected numbers" color="yellow" />
      </div>

      {/* Quota progress */}
      <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Icon.Send className="w-4 h-4 text-purple-400" /> Sending Quota
          </h3>
          <span className="text-xs text-gray-400">{stats.sent || 0} / {stats.limit || 0} sent</span>
        </div>
        <ProgressBar value={stats.sent || 0} max={stats.limit || 0} />
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{remaining} remaining</span>
          <span>{usagePct.toFixed(0)}% used</span>
        </div>
      </div>

      {/* Expiry countdown — live */}
      <div className={`bg-gradient-to-br rounded-xl p-5 border ${expired ? 'from-red-600/20 to-red-600/5 border-red-500/30' : 'from-blue-600/20 to-blue-600/5 border-blue-500/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Icon.Clock className={`w-4 h-4 ${expired ? 'text-red-400' : 'text-blue-400'}`} />
            {language === 'bn' ? 'অ্যাকাউন্ট মেয়াদ' : 'Account Expiry'}
          </h3>
          {stats.expiryDaysLeft !== null && stats.expiryDaysLeft > 0 && (
            <span className="text-xs text-gray-400">{stats.expiryDaysLeft} days left</span>
          )}
        </div>
        <div className={`text-2xl font-bold font-mono ${expired ? 'text-red-400' : 'text-blue-400'}`}>
          {expiryStr}
        </div>
        {!expired && stats.expiryDate && (
          <p className="text-xs text-gray-500 mt-1">
            {language === 'bn' ? 'মেয়াদ শেষ' : 'Expires on'}: {new Date(stats.expiryDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Delivery summary */}
      <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Icon.Report className="w-4 h-4 text-indigo-400" /> Delivery Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{stats.totalDelivered || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Delivered</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{stats.totalUndelivered || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Undelivered</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-400">{stats.totalInbox || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Inbox</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-400">{stats.totalSpam || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Spam</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SEND TAB — templates, AI suggestion, auto-new, number routing, direct paste
// ================================================================
// ================================================================
// SPAM METER — SVG circular gauge (0-100)
// ================================================================
function SpamMeter({ score, level }) {
  const size = 120;
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color = level === 'high' ? '#ef4444' : level === 'moderate' ? '#eab308' : '#22c55e';
  const label = level === 'high' ? 'HIGH SPAM RISK' : level === 'moderate' ? 'MODERATE RISK' : 'CLEAN';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-3xl font-bold">{pct}</text>
        <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-500 text-[9px] uppercase">spam score</text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

// ================================================================
// STEP INDICATOR — shows 4 wizard steps with progress
// ================================================================
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-between mb-6 px-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
              i < current ? 'bg-green-600 text-white' : i === current ? 'bg-purple-600 text-white ring-4 ring-purple-500/20' : 'bg-gray-800 text-gray-500'
            }`}>
              {i < current ? <Icon.Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= current ? 'text-gray-200' : 'text-gray-600'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 transition ${i < current ? 'bg-green-600' : 'bg-gray-800'}`} />}
        </div>
      ))}
    </div>
  );
}

// ================================================================
// SEND TAB — Enterprise 4-Step Wizard
//   Step 1: Compose (message + AI + templates + live spam preview)
//   Step 2: Recipients (numbers + CSV import + routing)
//   Step 3: Review (spam meter + batch/delay controls + summary)
//   Step 4: Send (live progress polling)
// ================================================================
function SendTab({ stats, templates, campaigns, onSent, onCampaignClick, language }) {
  const [step, setStep] = useState(0); // 0=compose, 1=recipients, 2=review, 3=send
  const [message, setMessage] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [sendType, setSendType] = useState('manual');
  const [templateUsed, setTemplateUsed] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [spamPreview, setSpamPreview] = useState(null); // {score, level, reasons}
  const [spamChecking, setSpamChecking] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [delayMs, setDelayMs] = useState(1200);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null); // live campaign progress
  const [progressTimer, setProgressTimer] = useState(null);

  const remaining = stats ? Math.max((stats.limit || 0) - (stats.sent || 0), 0) : 0;
  const steps = ['Compose', 'Recipients', 'Review', 'Send'];
  const parsedNumbers = numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);

  const handleTemplateSelect = (tmpl) => {
    setSelectedTemplate(tmpl);
    setMessage(tmpl.content);
    setSendType('template');
    setTemplateUsed(tmpl.name);
  };

  // Live spam check (calls spamCheck action — no send)
  const handleSpamCheck = async () => {
    if (!message.trim()) return;
    setSpamChecking(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'spamCheck', message }),
      });
      const data = await res.json();
      if (data.success) {
        setSpamPreview({ score: data.spamScore, level: data.spamLevel, reasons: data.spamReasons, aiReview: data.aiReview });
      }
    } catch { /* ignore */ }
    setSpamChecking(false);
  };

  // Auto-check spam when message changes (debounced)
  useEffect(() => {
    if (!message.trim() || message.length < 10) { setSpamPreview(null); return; }
    const t = setTimeout(handleSpamCheck, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const handleAiSuggest = async () => {
    setAiLoading(true); setAiSuggestion('');
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'aiChat', language,
          message: `I need an effective, spam-free MMS marketing message in ${language === 'bn' ? 'Bengali' : 'English'}. ${message ? 'Improve this draft: ' + message : 'Create a new one'}. Keep it under 160 chars. Just the message text.`,
        }),
      });
      const data = await res.json();
      if (data.success) setAiSuggestion(data.reply);
      else onSent(data.error || 'AI suggestion failed', 'error');
    } catch { onSent('Network error', 'error'); }
    setAiLoading(false);
  };

  const handleApplyAi = () => {
    if (aiSuggestion) { setMessage(aiSuggestion); setSendType('ai'); setAiSuggestion(''); }
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'bulkImport', csvData: text }),
      });
      const data = await res.json();
      if (data.success) { setNumbersText(data.numbers.join('\n')); onSent(`Imported ${data.count} numbers`, 'success'); }
      else onSent(data.error || 'Import failed', 'error');
    } catch { onSent('Import error', 'error'); }
    e.target.value = '';
  };

  // Live progress polling
  const pollProgress = (campaignId) => {
    if (progressTimer) clearInterval(progressTimer);
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'getCampaignProgress', campaignId }),
        });
        const data = await res.json();
        if (data.success) {
          setProgress(data.campaign);
          if (data.campaign.status === 'sent' || data.campaign.status === 'partial' || data.campaign.status === 'failed' || data.campaign.status === 'blocked_spam') {
            clearInterval(timer);
            setProgressTimer(null);
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    setProgressTimer(timer);
  };

  useEffect(() => () => { if (progressTimer) clearInterval(progressTimer); }, [progressTimer]);

  const handleSend = async () => {
    if (!message.trim()) { onSent('Please enter a message', 'error'); return; }
    if (parsedNumbers.length === 0) { onSent('No valid numbers', 'error'); return; }
    const nums = parsedNumbers.slice(0, remaining);
    setLoading(true); setResult(null); setProgress(null);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message, numbers: nums, sendType, templateUsed,
          options: { batchSize, delayMs },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invalidInfo = data.totalInvalid > 0 ? ` | ${data.totalInvalid} invalid` : '';
        onSent(`Sent ${data.totalSent} via ${data.senderApiUsed} — ${data.totalDelivered} delivered, ${data.totalUndelivered} undelivered${invalidInfo}`, 'success');
        setResult(data);
        // Start live polling
        if (data.campaignId) pollProgress(data.campaignId);
      } else if (data.blocked) {
        onSent('⚠ Message blocked by spam protection. Rewrite your content.', 'error');
        setResult({ blocked: true, spamScore: data.spamScore, spamReasons: data.spamReasons });
      } else {
        onSent(data.error || 'Failed to send', 'error');
        if (data.invalidNumbers) setResult({ invalidNumbers: data.invalidNumbers });
      }
    } catch { onSent('Network error', 'error'); }
    setLoading(false);
  };

  const templateTypes = [
    { key: 'payment', label: 'Payment' }, { key: 'marketing', label: 'Marketing' },
    { key: 'promo', label: 'Promo' }, { key: 'order', label: 'Order' },
    { key: 'crypto', label: 'Crypto' }, { key: 'custom', label: 'Custom' },
  ];

  const canProceed = () => {
    if (step === 0) return message.trim().length > 0;
    if (step === 1) return parsedNumbers.length > 0;
    if (step === 2) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Quota reminder */}
      <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3 text-sm text-purple-300 flex items-center gap-2">
        <Icon.Bolt className="w-4 h-4" />
        You have <span className="font-bold text-white">{remaining}</span> sends remaining
      </div>

      {/* Wizard card */}
      <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Icon.Send className="w-4 h-4 text-purple-400" /> Bulk Send Wizard
        </h3>
        <StepIndicator current={step} steps={steps} />

        {/* STEP 1: COMPOSE */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Icon.Sparkle className="w-3 h-3 text-purple-400" /> Templates</p>
                <div className="flex flex-wrap gap-2">
                  {templateTypes.map(tt => templates.filter(t => t.type === tt.key).map(t => (
                    <button key={t._id} onClick={() => handleTemplateSelect(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedTemplate?._id === t._id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                      {tt.label}: {t.name}
                    </button>
                  )))}
                </div>
              </div>
            )}

            {/* AI buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleAiSuggest} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                {aiLoading ? <Spinner /> : <Icon.Sparkle className="w-4 h-4" />} AI Suggestion
              </button>
            </div>
            {aiSuggestion && (
              <div className="p-3 bg-indigo-900/20 border border-indigo-500/20 rounded-lg">
                <p className="text-sm text-gray-300 mb-2">{aiSuggestion}</p>
                <button onClick={handleApplyAi} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium">Use this message</button>
              </div>
            )}

            {/* Message textarea */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message Content</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder="Type your MMS message, or use a template / AI suggestion..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                maxLength={500} />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{message.length}/500</p>
                {spamChecking && <p className="text-xs text-gray-500 animate-pulse">Checking spam...</p>}
                {spamPreview && !spamChecking && (
                  <p className={`text-xs font-medium ${spamPreview.level === 'high' ? 'text-red-400' : spamPreview.level === 'moderate' ? 'text-yellow-400' : 'text-green-400'}`}>
                    Spam: {spamPreview.score}/100 — {spamPreview.level}
                  </p>
                )}
              </div>
            </div>

            {/* Spam reasons preview */}
            {spamPreview && spamPreview.reasons && spamPreview.reasons.length > 0 && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                <p className="text-xs text-yellow-400 font-medium mb-1">Spam risk factors:</p>
                <div className="flex flex-wrap gap-1.5">
                  {spamPreview.reasons.map((r, i) => (
                    <span key={i} className="text-xs bg-yellow-900/30 px-2 py-0.5 rounded text-yellow-300">{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setStep(1)} disabled={!canProceed()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition">
                Next: Recipients →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RECIPIENTS */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-400">Recipient Numbers <span className="text-gray-600">(comma, newline, or space separated)</span></label>
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                  <Icon.Upload className="w-4 h-4" /> CSV Import
                  <input type="file" accept=".csv,.txt" onChange={handleBulkImport} className="hidden" />
                </label>
              </div>
              <textarea value={numbersText} onChange={(e) => setNumbersText(e.target.value)} rows={5}
                placeholder="+1234567890\n+9876543210\n..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm font-mono" />
              <p className="text-xs text-gray-500 mt-1">
                {parsedNumbers.length} numbers detected · {Math.min(parsedNumbers.length, remaining)} will be sent (quota: {remaining})
              </p>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">← Back</button>
              <button onClick={() => setStep(2)} disabled={!canProceed()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition">
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Spam meter */}
              <div className="bg-gray-800/40 rounded-xl p-4 flex flex-col items-center justify-center">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Spam Analysis</p>
                {spamPreview ? (
                  <SpamMeter score={spamPreview.score} level={spamPreview.level} />
                ) : (
                  <button onClick={handleSpamCheck} disabled={spamChecking}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm">
                    {spamChecking ? 'Checking...' : 'Check Spam Score'}
                  </button>
                )}
                {spamPreview && spamPreview.level === 'high' && (
                  <p className="text-xs text-red-400 mt-2 text-center">⚠ This message will be blocked by spam protection. Rewrite it.</p>
                )}
              </div>

              {/* Send configuration */}
              <div className="bg-gray-800/40 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Send Configuration</p>
                <div>
                  <label className="text-xs text-gray-400 flex justify-between"><span>Batch Size</span><span className="text-gray-500">{batchSize} per batch</span></label>
                  <input type="range" min="1" max="20" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-full accent-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 flex justify-between"><span>Delay Between Batches</span><span className="text-gray-500">{(delayMs / 1000).toFixed(1)}s</span></label>
                  <input type="range" min="500" max="5000" step="100" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className="w-full accent-purple-500" />
                </div>
                <p className="text-[10px] text-gray-600">Smaller batches + longer delays = better inbox delivery & spam-free sending.</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Campaign Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-xs text-gray-500">Recipients</p><p className="text-lg font-bold text-white">{Math.min(parsedNumbers.length, remaining)}</p></div>
                <div><p className="text-xs text-gray-500">Batch Size</p><p className="text-lg font-bold text-cyan-400">{batchSize}</p></div>
                <div><p className="text-xs text-gray-500">Delay</p><p className="text-lg font-bold text-cyan-400">{(delayMs / 1000).toFixed(1)}s</p></div>
                <div><p className="text-xs text-gray-500">Est. Batches</p><p className="text-lg font-bold text-purple-400">{Math.ceil(Math.min(parsedNumbers.length, remaining) / batchSize)}</p></div>
              </div>
              <div className="mt-3 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
                <p className="text-gray-500 mb-1">Message preview:</p>
                {message.substring(0, 120)}{message.length > 120 ? '...' : ''}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">← Back</button>
              <button onClick={() => { setStep(3); handleSend(); }}
                disabled={loading || remaining <= 0 || (spamPreview && spamPreview.level === 'high')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition flex items-center gap-2">
                {loading ? <Spinner /> : <Icon.Send className="w-4 h-4" />} Launch Campaign
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SEND / LIVE PROGRESS */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-8">
                <Spinner />
                <p className="text-sm text-gray-400 mt-3">Launching campaign...</p>
              </div>
            )}

            {/* Live progress */}
            {progress && !loading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <Icon.Activity className="w-4 h-4 text-purple-400" /> Live Progress
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    progress.status === 'sent' ? 'bg-green-900/40 text-green-400' :
                    progress.status === 'partial' ? 'bg-yellow-900/40 text-yellow-400' :
                    progress.status === 'failed' ? 'bg-red-900/40 text-red-400' :
                    progress.status === 'blocked_spam' ? 'bg-red-900/40 text-red-400' :
                    'bg-blue-900/40 text-blue-400 animate-pulse'
                  }`}>{progress.status}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress.totalSent > 0 ? Math.round((progress.totalSent / Math.max(progress.totalSent + progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-white">{progress.totalSent}</div>
                    <div className="text-xs text-gray-500">Sent</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-green-400">{progress.totalDelivered}</div>
                    <div className="text-xs text-gray-500">Delivered</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-red-400">{progress.totalUndelivered}</div>
                    <div className="text-xs text-gray-500">Undelivered</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">{progress.totalInvalid || 0}</div>
                    <div className="text-xs text-gray-500">Invalid</div>
                  </div>
                </div>

                {progress.senderApiName && (
                  <p className="text-xs text-gray-500">Sender API: <span className="text-cyan-400">{progress.senderApiName}</span> · Batch: {progress.batchSize} · Delay: {(progress.delayMs / 1000).toFixed(1)}s</p>
                )}

                {/* Blocked spam */}
                {progress.status === 'blocked_spam' && (
                  <div className="p-3 bg-red-900/30 border border-red-700/30 rounded-lg text-sm text-red-300">
                    ⚠ Campaign blocked by spam protection (score: {progress.spamScore}). Rewrite your message.
                  </div>
                )}

                {/* Done actions */}
                {(progress.status === 'sent' || progress.status === 'partial' || progress.status === 'failed') && (
                  <div className="flex gap-2">
                    {result && result.campaignId && (
                      <button onClick={() => onCampaignClick(result.campaignId)} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition">
                        View Delivery Details
                      </button>
                    )}
                    <button onClick={() => { setStep(0); setMessage(''); setNumbersText(''); setResult(null); setProgress(null); setSpamPreview(null); }}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">
                      New Campaign
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error / blocked result */}
            {result && result.blocked && !progress && !loading && (
              <div className="p-4 bg-red-900/30 border border-red-700/30 rounded-lg">
                <p className="text-sm font-bold text-red-300 mb-2">⚠ Message Blocked — Spam Protection</p>
                <p className="text-xs text-red-400 mb-2">Spam score: {result.spamScore}/100</p>
                {result.spamReasons && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {result.spamReasons.map((r, i) => <span key={i} className="text-xs bg-red-900/40 px-2 py-0.5 rounded text-red-300">{r}</span>)}
                  </div>
                )}
                <button onClick={() => setStep(0)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">← Rewrite Message</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invalid numbers (from failed send) */}
      {result && result.invalidNumbers && result.invalidNumbers.length > 0 && step !== 3 && (
        <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
          <p className="text-xs text-red-400 font-medium mb-1">Invalid numbers rejected:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.invalidNumbers.map((inv, i) => (
              <span key={i} className="text-xs bg-red-900/30 border border-red-700/30 px-2 py-1 rounded text-red-300">
                {inv.number || inv} {inv.reason ? `(${inv.reason})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// REPORTS TAB — campaign list + delivery reports
// ================================================================
function ReportsTab({ campaigns, deliveryReports, onCampaignClick }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const handleSelect = (c) => {
    setSelectedCampaign(c._id);
    onCampaignClick(c._id);
  };

  return (
    <div className="space-y-6">
      {/* Campaign list */}
      <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Icon.Report className="w-4 h-4 text-indigo-400" /> Campaign History
        </h3>
        {campaigns.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No campaigns sent yet</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div
                key={c._id}
                onClick={() => handleSelect(c)}
                className={`cursor-pointer bg-gray-800/50 rounded-lg p-3 border transition ${
                  selectedCampaign === c._id ? 'border-purple-500' : 'border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'sent' ? 'bg-green-900/50 text-green-300' :
                      c.status === 'blocked' || c.status === 'failed' ? 'bg-red-900/50 text-red-300' :
                      c.status === 'running' ? 'bg-blue-900/50 text-blue-300' :
                      'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {(c.status || 'pending').toUpperCase()}
                    </span>
                    {c.senderApiName && (
                      <span className="text-xs text-gray-500">via {c.senderApiName}</span>
                    )}
                    {c.templateUsed && (
                      <span className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-400">{c.templateUsed}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-2 line-clamp-2">{c.message}</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>{c.totalSent || c.numbers?.length || 0} sent</span>
                  {c.totalDelivered !== undefined && <span className="text-green-400">{c.totalDelivered} delivered</span>}
                  {c.totalUndelivered !== undefined && <span className="text-red-400">{c.totalUndelivered} undelivered</span>}
                  {c.totalInvalid > 0 && <span className="text-yellow-400">{c.totalInvalid} invalid</span>}
                  {c.country && <span className="flex items-center gap-1"><Icon.Globe className="w-3 h-3" />{c.country}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery reports for selected campaign */}
      {selectedCampaign && (
        <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Icon.Inbox className="w-4 h-4 text-purple-400" /> Delivery Details
          </h3>
          {deliveryReports.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">No delivery reports for this campaign</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2 px-2 font-medium">Number</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                    <th className="text-left py-2 px-2 font-medium">Country</th>
                    <th className="text-left py-2 px-2 font-medium">API</th>
                    <th className="text-left py-2 px-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryReports.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 px-2 text-gray-300 font-mono">{r.number}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === 'delivered' ? 'bg-green-900/50 text-green-300' :
                          r.status === 'undelivered' ? 'bg-red-900/50 text-red-300' :
                          r.status === 'invalid' ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {(r.status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-400">
                        {r.country ? `${r.country} ${r.countryCode || ''}` : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-400">{r.senderApiName || '—'}</td>
                      <td className="py-2 px-2 text-red-300">{r.errorMessage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ================================================================
// INFO TAB — admin-set app info (number, email, whatsapp, description)
// ================================================================
function InfoTab({ settings }) {
  const info = [
    { icon: Icon.Whatsapp, label: 'WhatsApp', value: settings?.whatsapp || 'Not set', color: 'text-green-400' },
    { icon: Icon.Mail, label: 'Email', value: settings?.email || 'Not set', color: 'text-indigo-400' },
    { icon: Icon.Phone, label: 'Phone', value: settings?.phone || settings?.whatsapp || 'Not set', color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
            {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{settings?.platformName || 'MMS Sender'}</h2>
            <p className="text-xs text-gray-500">{settings?.language === 'bn' ? 'ভাষা: বাংলা' : 'Language: English'}</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-5">
          {settings?.description || 'Enterprise MMS Sending Platform — send campaigns with AI-powered spam protection and auto-routing.'}
        </p>

        <div className="space-y-3">
          {info.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm text-gray-200">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform features */}
      <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Icon.Shield className="w-4 h-4 text-green-400" /> Platform Features
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Icon.Sparkle, label: 'AI-powered message suggestions' },
            { icon: Icon.Shield, label: 'Spam-free enterprise system' },
            { icon: Icon.Globe, label: 'Country rule validation' },
            { icon: Icon.Bolt, label: 'Auto-routing sender APIs' },
            { icon: Icon.Inbox, label: 'Inbox rate tracking' },
            { icon: Icon.Clock, label: 'Live account expiry countdown' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
              <f.icon className="w-4 h-4 text-purple-400 flex-shrink-0" />
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SCHEDULED SENDS SECTION
// ================================================================
function ScheduledSection({ language, onToast }) {
  const [scheduled, setScheduled] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sMessage, setSMessage] = useState('');
  const [sNumbers, setSNumbers] = useState('');
  const [sTime, setSTime] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchScheduled = useCallback(async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'getScheduledSends' }),
      });
      const data = await res.json();
      if (data.scheduledSends) setScheduled(data.scheduledSends);
    } catch {}
  }, []);

  useEffect(() => { fetchScheduled(); }, [fetchScheduled]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!sMessage.trim() || !sNumbers.trim() || !sTime) { onToast('Fill all fields', 'error'); return; }
    setLoading(true);
    try {
      const nums = sNumbers.split(/[\n,]/).map(n => n.trim()).filter(Boolean);
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'scheduleSend', message: sMessage, numbers: nums, scheduledAt: sTime }),
      });
      const data = await res.json();
      if (data.success) {
        onToast('Campaign scheduled', 'success');
        setSMessage(''); setSNumbers(''); setSTime(''); setShowForm(false);
        fetchScheduled();
      } else {
        onToast(data.error || 'Failed', 'error');
      }
    } catch {
      onToast('Network error', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="mt-6 bg-gray-900/60 rounded-xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Icon.Clock className="w-4 h-4 text-blue-400" /> Scheduled Sends
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          {showForm ? 'Cancel' : '+ Schedule new'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSchedule} className="space-y-3 mb-4 p-3 bg-gray-800/30 rounded-lg">
          <input
            type="text"
            value={sMessage}
            onChange={(e) => setSMessage(e.target.value)}
            placeholder="Message content"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <input
            type="text"
            value={sNumbers}
            onChange={(e) => setSNumbers(e.target.value)}
            placeholder="Numbers (comma separated)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <input
            type="datetime-local"
            value={sTime}
            onChange={(e) => setSTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {loading ? <Spinner /> : <Icon.Clock className="w-4 h-4" />}
            Schedule
          </button>
        </form>
      )}

      {scheduled.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-4">No scheduled sends</p>
      ) : (
        <div className="space-y-2">
          {scheduled.map((s) => (
            <div key={s._id} className="bg-gray-800/50 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-300 font-medium">Scheduled: {new Date(s.scheduledAt).toLocaleString()}</span>
                <span className="text-gray-500">{s.numbers?.length || 0} numbers</span>
              </div>
              <p className="text-gray-400">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// AI CHAT POPUP — floating right side, Gemini-powered, language-aware
// ================================================================
function AIChatPopup({ language }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'aiChat', message: userMsg, language }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.error || 'AI unavailable. Admin may need to configure Gemini API.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Network error.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/40 flex items-center justify-center text-white hover:scale-105 transition"
          aria-label="AI Support"
        >
          <Icon.Chat className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2rem)] bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Icon.Sparkle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AI Support</div>
                <div className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Online
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
              <Icon.Close className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Icon.Sparkle className="w-10 h-10 text-purple-500/50 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  {language === 'bn'
                    ? 'হাই! আমি আপনাকে সাহায্য করতে পারি। কী জানতে চান?'
                    : "Hi! I'm your AI assistant. How can I help you today?"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                  m.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-200'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-3 py-2 rounded-lg flex items-center gap-2">
                  <Spinner size={12} />
                  <span className="text-xs text-gray-400">Typing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleSend(); }}
              placeholder={language === 'bn' ? 'মেসেজ লিখুন...' : 'Type a message...'}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg"
            >
              <Icon.Send2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
