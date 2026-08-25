'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { COUNTRY_SUPPORT, getCountryStats } from '@/lib/countrySupport';

// ================================================================
// Icon set (professional SVG, NO emoji in chrome — emoji only for flags)
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
  Plus: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  Menu: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Target: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Layers: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  CheckCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  XCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Pause: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Calendar: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Users: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
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
      className="border-2 border-white/30 border-t-white rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// ================================================================
// USER LOGIN — 5x enterprise polish: animated gradient, glass card, branding
// ================================================================
function UserLogin({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

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
    const cleanId = loginId.trim();
    if (!cleanId || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', loginId: cleanId, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Login failed. Check your credentials.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const platformName = settings?.platformName || 'Gmail Mailer';
  const countryStats = getCountryStats();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-purple-900/30">
          {/* Logo + branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30 mb-4 overflow-hidden">
              {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-10 h-10 text-white" />}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{platformName}</h1>
            <p className="text-sm text-gray-400 mt-1">{settings?.description || 'Enterprise Gmail Email Sending Module'}</p>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mb-6 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Icon.Shield className="w-3.5 h-3.5 text-green-400" /> Spam-Free</span>
            <span className="flex items-center gap-1"><Icon.Mail className="w-3.5 h-3.5 text-blue-400" /> Any Email Domain</span>
            <span className="flex items-center gap-1"><Icon.Bolt className="w-3.5 h-3.5 text-purple-400" /> AI-Powered</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <Icon.User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Icon.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <Icon.EyeOff className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                <Icon.Alert className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
            >
              {loading ? <><Spinner /> Signing in…</> : <><Icon.Lock className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          {/* Contact footer */}
          {(settings?.whatsapp || settings?.email || settings?.phone) && (
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-4 text-xs">
              {settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-green-400 hover:text-green-300"><Icon.Whatsapp className="w-4 h-4" /> WhatsApp</a>}
              {settings?.email && <a href={`mailto:${settings.email}`} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"><Icon.Mail className="w-4 h-4" /> Email</a>}
              {settings?.phone && <span className="flex items-center gap-1 text-blue-400"><Icon.Phone className="w-4 h-4" /> {settings.phone}</span>}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">© {new Date().getFullYear()} {platformName}. All rights reserved.</p>
      </div>
    </div>
  );
}

// ================================================================
// Toast hook
// ================================================================
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ================================================================
// Reusable UI: StatCard, ProgressBar, TabBtn
// ================================================================
function StatCard({ icon: I, label, value, sub, color = 'purple', trend }) {
  const colors = {
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-300',
    green: 'from-green-500/20 to-green-600/5 border-green-500/20 text-green-300',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-300',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-300',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-300',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 transition hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center`}>
          <I className={`w-5 h-5 ${colors[color].split(' ').pop()}`} />
        </div>
        {trend && <span className="text-xs text-gray-500">{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = 'green' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colors = { green: 'from-green-500 to-emerald-500', purple: 'from-purple-500 to-indigo-500', blue: 'from-blue-500 to-cyan-500', red: 'from-red-500 to-orange-500', amber: 'from-amber-500 to-yellow-500' };
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div className={`bg-gradient-to-r ${colors[color]} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TabBtn({ icon: I, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full relative ${
        active
          ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-white shadow-lg border border-purple-500/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <I className={`w-5 h-5 flex-shrink-0 ${active ? 'text-purple-300' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{badge}</span>}
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-r-full" />}
    </button>
  );
}

// ================================================================
// USER DASHBOARD — 5x polished shell: glass sidebar, live header, theme
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live clock
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const fetchDeliveryReports = useCallback(async (campaignId) => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'getDeliveryReports', campaignId }),
      });
      const data = await res.json();
      if (data.reports) setDeliveryReports(data.reports);
    } catch {}
  }, []);

  const platformName = settings?.platformName || 'Gmail Mailer';
  const logoUrl = settings?.logoUrl || '';
  const language = settings?.language || 'en';

  const tabs = [
    { k: 'dashboard', l: 'Dashboard', I: Icon.Dashboard },
    { k: 'send', l: 'Send Email', I: Icon.Send },
    { k: 'countries', l: 'Deliverability', I: Icon.Shield },
    { k: 'inbox', l: 'Inbox & Auto-Reply', I: Icon.Inbox },
    { k: 'reports', l: 'Reports', I: Icon.Report },
    { k: 'info', l: 'App Info', I: Icon.Info },
  ];

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[150px]" />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2.5 backdrop-blur-xl border animate-[slideDown_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-green-600/90 border-green-400/30 text-white' :
          toast.type === 'error' ? 'bg-red-600/90 border-red-400/30 text-white' :
          'bg-indigo-600/90 border-indigo-400/30 text-white'
        }`}>
          {toast.type === 'success' ? <Icon.CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <Icon.XCircle className="w-5 h-5" /> : <Icon.Info className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      <div className="flex relative z-10">
        {/* Sidebar — desktop */}
        <aside className={`w-64 min-h-screen bg-slate-900/60 backdrop-blur-xl border-r border-white/5 p-4 hidden lg:flex flex-col gap-1.5 fixed transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : ''}`}>
          <div className="flex items-center gap-3 px-2 py-4 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-6 h-6 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{platformName}</div>
              <div className="text-[10px] text-purple-400/70 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> User Panel</div>
            </div>
          </div>

          {tabs.map(({ k, l, I }) => (
            <TabBtn key={k} icon={I} label={l} active={activeTab === k} onClick={() => setActiveTab(k)} />
          ))}

          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1.5">
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh Data
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
            >
              <Icon.Logout className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 p-4 z-50 lg:hidden flex flex-col gap-1.5 animate-[slideIn_0.2s_ease-out]">
              <div className="flex items-center justify-between px-2 py-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                    {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-5 h-5 text-white" />}
                  </div>
                  <span className="text-sm font-bold text-white truncate">{platformName}</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400"><Icon.Close className="w-5 h-5" /></button>
              </div>
              {tabs.map(({ k, l, I }) => (
                <TabBtn key={k} icon={I} label={l} active={activeTab === k} onClick={() => { setActiveTab(k); setSidebarOpen(false); }} />
              ))}
              <div className="mt-auto pt-4 border-t border-white/5">
                <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition w-full">
                  <Icon.Logout className="w-4 h-4" /> Logout
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-300"><Icon.Menu className="w-6 h-6" /></button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-4 h-4 text-white" />}
              </div>
              <span className="text-sm font-bold text-white truncate max-w-[140px]">{platformName}</span>
            </div>
          </div>
          <button onClick={onLogout} className="text-red-400"><Icon.Logout className="w-5 h-5" /></button>
        </div>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 mt-16 lg:mt-0 min-h-screen">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'send' && 'Send Email Campaign'}
                {activeTab === 'countries' && 'Deliverability'}
                {activeTab === 'inbox' && 'Inbox & Auto-Reply'}
                {activeTab === 'reports' && 'Delivery Reports'}
                {activeTab === 'info' && 'App Information'}
              </h1>
              <p className="text-gray-400 text-xs mt-1">
                Welcome, <span className="text-purple-300 font-medium">{stats?.loginId || user?.loginId || stats?.email || user?.email}</span> · <span className="text-gray-500">{new Date(now).toLocaleString()}</span>
              </p>
            </div>
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition text-xs"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh
            </button>
          </div>

          {/* Mobile tab bar */}
          <div className="lg:hidden flex gap-1.5 mb-4 overflow-x-auto pb-2">
            {tabs.map(({ k, l, I }) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  activeTab === k ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white/5 text-gray-400'
                }`}
              >
                <I className="w-4 h-4" /> {l}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={loadingStats} now={now} language={language} />}
            {activeTab === 'send' && (
              <>
                <SendTab
                  stats={stats}
                  templates={templates}
                  campaigns={campaigns}
                  onSent={(msg, type) => { show(msg, type); fetchAll(); }}
                  onCampaignClick={fetchDeliveryReports}
                  language={language}
                />
                <ScheduledSection language={language} onToast={show} />
              </>
            )}
            {activeTab === 'countries' && <CountrySupportTab />}
            {activeTab === 'reports' && <ReportsTab campaigns={campaigns} deliveryReports={deliveryReports} onCampaignClick={fetchDeliveryReports} />}
            {activeTab === 'inbox' && <InboxAutoReplyTab language={language} onToast={show} loginId={stats?.loginId || user?.loginId} />}
            {activeTab === 'info' && <InfoTab settings={settings} />}
          </div>
        </main>
      </div>

      <AIChatPopup language={language} />

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ================================================================
// DASHBOARD TAB — live stats, quota ring, country showcase
// ================================================================
function DashboardTab({ stats, loading, now, language }) {
  const countryStats = getCountryStats();

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  const sent = stats.sent || 0;
  const limit = stats.limit || 0;
  const remaining = Math.max(limit - sent, 0);
  const usagePct = limit > 0 ? Math.round((sent / limit) * 100) : 0;
  const expiry = stats.expiry;
  const expiryMs = expiry ? new Date(expiry).getTime() - now : null;
  const expired = expiryMs !== null && expiryMs <= 0;
  const daysLeft = expiryMs !== null ? Math.floor(expiryMs / (1000 * 60 * 60 * 24)) : null;
  const hoursLeft = expiryMs !== null ? Math.floor(expiryMs / (1000 * 60 * 60)) : null;
  const todaySent = stats.todaySent || 0;
  const todayDelivered = stats.todayDelivered || 0;
  const deliveryRate = todaySent > 0 ? Math.round((todayDelivered / todaySent) * 100) : 0;

  // Quota ring (SVG circular gauge)
  const RingSize = 140;
  const ringR = (RingSize - 16) / 2;
  const ringC = 2 * Math.PI * ringR;
  const ringDash = (usagePct / 100) * ringC;
  const ringColor = usagePct > 80 ? '#ef4444' : usagePct > 50 ? '#eab308' : '#22c55e';

  return (
    <div className="space-y-6">
      {/* Top row: quota ring + key stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quota ring card */}
        <div className="bg-gradient-to-br from-purple-900/20 to-slate-900/40 border border-purple-500/20 rounded-2xl p-6 flex flex-col items-center justify-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Sending Quota</p>
          <div className="relative" style={{ width: RingSize, height: RingSize }}>
            <svg width={RingSize} height={RingSize}>
              <circle cx={RingSize / 2} cy={RingSize / 2} r={ringR} fill="none" stroke="#1e293b" strokeWidth="10" />
              <circle
                cx={RingSize / 2} cy={RingSize / 2} r={ringR} fill="none" stroke={ringColor} strokeWidth="10"
                strokeDasharray={`${ringDash} ${ringC}`} strokeLinecap="round"
                transform={`rotate(-90 ${RingSize / 2} ${RingSize / 2})`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{remaining}</span>
              <span className="text-xs text-gray-400">remaining</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-300"><span className="font-bold text-white">{sent}</span> / {limit} used</p>
            <p className="text-xs text-gray-500 mt-0.5">{usagePct}% used</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard icon={Icon.Send} label="Total Sent" value={sent} sub={`Limit: ${limit}`} color="purple" />
          <StatCard icon={Icon.CheckCircle} label="Today Delivered" value={todayDelivered} sub={`${deliveryRate}% delivery rate`} color="green" />
          <StatCard icon={Icon.Activity} label="Today Sent" value={todaySent} sub="Last 24 hours" color="blue" />
          <StatCard icon={Icon.Clock} label="Account Status" value={expired ? 'Expired' : (daysLeft !== null ? `${daysLeft}d left` : 'Active')} sub={expiry ? `Expires ${new Date(expiry).toLocaleDateString()}` : 'No expiry'} color={expired ? 'red' : 'green'} />
        </div>
      </div>

      {/* Expiry countdown — if less than 7 days */}
      {expiry && !expired && daysLeft !== null && daysLeft <= 7 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Icon.Alert className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Account expiring soon!</p>
            <p className="text-xs text-amber-300/70">Your account will expire in {daysLeft} days ({hoursLeft} hours). Contact your administrator to extend.</p>
          </div>
        </div>
      )}

      {/* Country support showcase */}
      <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Icon.Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Global Coverage</h3>
              <p className="text-xs text-gray-500">Global email deliverability — any email domain, worldwide</p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div><div className="text-xl font-bold text-blue-400">Any</div><div className="text-[10px] text-gray-500">Domain</div></div>
            <div><div className="text-xl font-bold text-purple-400">∞</div><div className="text-[10px] text-gray-500">Recipients</div></div>
            <div><div className="text-xl font-bold text-green-400">24/7</div><div className="text-[10px] text-gray-500">Sending</div></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'proton.me', 'zoho.com', 'mail.ru', 'qq.com', 'yahoo.co.jp', 'rediffmail.com'].map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs text-cyan-300 font-mono hover:bg-white/10 transition">
              @{d}
            </span>
          ))}
        </div>
      </div>

      {/* Recent campaigns */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Layers className="w-4 h-4 text-purple-400" /> Recent Campaigns
        </h3>
        {stats.recentCampaigns && stats.recentCampaigns.length > 0 ? (
          <div className="space-y-2">
            {stats.recentCampaigns.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{c.message?.substring(0, 50) || 'Campaign'}…</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(c.createdAt).toLocaleDateString()} · {c.totalSent || 0} sent</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                  c.status === 'sent' ? 'bg-green-500/20 text-green-300' :
                  c.status === 'partial' ? 'bg-amber-500/20 text-amber-300' :
                  c.status === 'blocked_spam' ? 'bg-red-500/20 text-red-300' :
                  c.status === 'running' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                  'bg-gray-500/20 text-gray-300'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Icon.Send className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No campaigns yet. Head to the Send Email tab to start your first campaign.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// SPAM METER — circular gauge
// ================================================================
function SpamMeter({ score, level }) {
  const size = 120;
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color = level === 'high' ? '#ef4444' : level === 'moderate' ? '#eab308' : '#22c55e';
  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-500 uppercase">{level}</span>
      </div>
    </div>
  );
}

// ================================================================
// STEP INDICATOR
// ================================================================
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current ? 'bg-green-500 text-white' :
              i === current ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-4 ring-purple-500/20' :
              'bg-slate-800 text-gray-500 border border-slate-700'
            }`}>
              {i < current ? <Icon.Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[10px] mt-1.5 ${i <= current ? 'text-white' : 'text-gray-600'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i < current ? 'bg-green-500' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ================================================================
// SEND TAB — ENTERPRISE anti-spam sending configuration
// ================================================================
function SendTab({ stats, templates, campaigns, onSent, onCampaignClick, language }) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [sendType, setSendType] = useState('manual');
  const [templateUsed, setTemplateUsed] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [spamPreview, setSpamPreview] = useState(null);
  const [spamChecking, setSpamChecking] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [delayMs, setDelayMs] = useState(1200);
  // ENTERPRISE anti-spam config
  const [jitterPct, setJitterPct] = useState(30);       // randomized ±% delay variation
  const [humanize, setHumanize] = useState(true);        // human-like timing patterns
  const [polymorph, setPolymorph] = useState(true);      // AI rewrite each message uniquely
  const [dripMode, setDripMode] = useState(false);       // spread sends over time
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [progressTimer, setProgressTimer] = useState(null);

  const remaining = stats ? Math.max((stats.limit || 0) - (stats.sent || 0), 0) : 0;
  const steps = ['Compose', 'Recipients', 'Review', 'Send'];
  const parsedEmails = numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);

  const handleTemplateSelect = (tmpl) => {
    setSelectedTemplate(tmpl);
    setMessage(tmpl.content);
    setSendType('template');
    setTemplateUsed(tmpl.name);
  };

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
    } catch {}
    setSpamChecking(false);
  };

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
          message: `I need an effective, spam-free email marketing message in ${language === 'bn' ? 'Bengali' : 'English'}. ${message ? 'Improve this draft: ' + message : 'Create a new one'}. Keep the subject under 60 chars and body under 500 chars. Return as: SUBJECT|||BODY format.`,
        }),
      });
      const data = await res.json();
      if (data.success) setAiSuggestion(data.reply);
      else onSent(data.error || 'AI suggestion failed', 'error');
    } catch { onSent('Network error', 'error'); }
    setAiLoading(false);
  };

  const handleApplyAi = () => {
    if (aiSuggestion) {
      const parts = aiSuggestion.split('|||');
      if (parts.length >= 2) { setSubject(parts[0].trim()); setMessage(parts.slice(1).join('|||').trim()); }
      else { setMessage(aiSuggestion); }
      setSendType('ai'); setAiSuggestion('');
    }
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
      if (data.success) { setNumbersText(data.numbers.join('\n')); onSent(`Imported ${data.count} emails`, 'success'); }
      else onSent(data.error || 'Import failed', 'error');
    } catch { onSent('Import error', 'error'); }
    e.target.value = '';
  };

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
          if (['sent', 'partial', 'failed', 'blocked_spam'].includes(data.campaign.status)) {
            clearInterval(timer);
            setProgressTimer(null);
          }
        }
      } catch {}
    }, 2000);
    setProgressTimer(timer);
  };

  useEffect(() => () => { if (progressTimer) clearInterval(progressTimer); }, [progressTimer]);

  const handleSend = async () => {
    if (!message.trim()) { onSent('Please enter an email body', 'error'); return; }
    if (parsedEmails.length === 0) { onSent('No valid email addresses', 'error'); return; }
    const nums = parsedEmails.slice(0, remaining);
    setLoading(true); setResult(null); setProgress(null);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message, subject, numbers: nums, sendType, templateUsed,
          options: { batchSize, delayMs, jitterPct, humanize, polymorph, dripMode },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invalidInfo = data.totalInvalid > 0 ? ` | ${data.totalInvalid} invalid` : '';
        onSent(`Sent ${data.totalSent} via ${data.senderApiUsed} — ${data.totalDelivered} delivered, ${data.totalUndelivered} undelivered${invalidInfo}`, 'success');
        setResult(data);
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
    if (step === 1) return parsedEmails.length > 0;
    if (step === 2) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Quota reminder */}
      <div className="bg-gradient-to-r from-purple-600/15 to-indigo-600/10 border border-purple-500/20 rounded-2xl p-4 text-sm text-purple-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Icon.Bolt className="w-5 h-5 text-purple-300" />
        </div>
        <span>You have <span className="font-bold text-white text-base">{remaining}</span> emails remaining · Enterprise anti-spam mode active</span>
      </div>

      {/* Wizard card */}
      <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <Icon.Send className="w-4 h-4 text-purple-400" /> Bulk Email Wizard
        </h3>
        <StepIndicator current={step} steps={steps} />

        {/* STEP 0: COMPOSE */}
        {step === 0 && (
          <div className="space-y-4">
            {templates.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Icon.Sparkle className="w-3 h-3 text-purple-400" /> Templates</p>
                <div className="flex flex-wrap gap-2">
                  {templateTypes.map(tt => templates.filter(t => t.type === tt.key).map(t => (
                    <button key={t._id} onClick={() => handleTemplateSelect(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${selectedTemplate?._id === t._id ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'}`}>
                      {tt.label}: {t.name}
                    </button>
                  )))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={handleAiSuggest} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-indigo-600/20">
                {aiLoading ? <Spinner /> : <Icon.Sparkle className="w-4 h-4" />} AI Suggestion
              </button>
            </div>
            {aiSuggestion && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <p className="text-sm text-gray-200 mb-2">{aiSuggestion}</p>
                <button onClick={handleApplyAi} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">Use this message</button>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Subject Line <span className="text-purple-400 text-xs">(supports #RANDOM# for unique subjects)</span></label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject line… use #RANDOM# to auto-generate unique subjects per email"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm mb-3"
                maxLength={120} />
              <p className="text-xs text-gray-500 mb-3">{subject.length}/120 {subject.includes('#RANDOM#') && <span className="text-purple-300">· #RANDOM# active — unique subject per email</span>}</p>
              <label className="block text-sm text-gray-300 mb-1.5">Email Body</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder="Type your email body, or use a template / AI suggestion…"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                maxLength={2000} />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">{message.length}/2000</p>
                {spamChecking && <p className="text-xs text-gray-500 animate-pulse flex items-center gap-1"><Spinner size={12} /> AI analyzing spam risk…</p>}
                {spamPreview && !spamChecking && (
                  <p className={`text-xs font-semibold flex items-center gap-1 ${spamPreview.level === 'high' ? 'text-red-400' : spamPreview.level === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                    Spam: {spamPreview.score}/100 — {spamPreview.level}
                  </p>
                )}
              </div>
            </div>

            {spamPreview && spamPreview.reasons && spamPreview.reasons.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-300 font-medium mb-1.5">Spam risk factors:</p>
                <div className="flex flex-wrap gap-1.5">
                  {spamPreview.reasons.map((r, i) => (
                    <span key={i} className="text-xs bg-amber-500/10 px-2 py-0.5 rounded-lg text-amber-300">{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setStep(1)} disabled={!canProceed()}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition">
                Next: Recipients →
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: RECIPIENTS */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-gray-300">Recipient Emails <span className="text-gray-600">(comma, newline, or space separated)</span></label>
                <label className="flex items-center gap-1.5 text-xs text-purple-300 cursor-pointer hover:text-purple-200 bg-purple-500/10 px-3 py-1.5 rounded-lg transition">
                  <Icon.Upload className="w-4 h-4" /> CSV Import
                  <input type="file" accept=".csv,.txt" onChange={handleBulkImport} className="hidden" />
                </label>
              </div>
              <textarea value={numbersText} onChange={(e) => setNumbersText(e.target.value)} rows={5}
                placeholder="user1@gmail.com&#10;user2@yahoo.com&#10;…"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm font-mono" />
              <p className="text-xs text-gray-500 mt-1.5">
                {parsedEmails.length} emails detected · {Math.min(parsedEmails.length, remaining)} will be sent (quota: {remaining})
              </p>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition">← Back</button>
              <button onClick={() => setStep(2)} disabled={!canProceed()}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition">
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW — with ENTERPRISE anti-spam config */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Spam meter */}
              <div className="bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center border border-white/5">
                <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Spam Analysis</p>
                {spamPreview ? <SpamMeter score={spamPreview.score} level={spamPreview.level} /> : (
                  <button onClick={handleSpamCheck} disabled={spamChecking}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm">
                    {spamChecking ? 'Checking…' : 'Check Spam Score'}
                  </button>
                )}
                {spamPreview && spamPreview.level === 'high' && (
                  <p className="text-xs text-red-400 mt-3 text-center">⚠ This message will be blocked by spam protection. Rewrite it.</p>
                )}
              </div>

              {/* Enterprise anti-spam config */}
              <div className="bg-white/5 rounded-xl p-5 space-y-4 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon.Shield className="w-3.5 h-3.5 text-green-400" /> Enterprise Anti-Spam Config
                </p>
                <div>
                  <label className="text-xs text-gray-300 flex justify-between"><span>Batch Size</span><span className="text-purple-300 font-medium">{batchSize} per batch</span></label>
                  <input type="range" min="1" max="20" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-full accent-purple-500 mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-300 flex justify-between"><span>Delay Between Batches</span><span className="text-purple-300 font-medium">{(delayMs / 1000).toFixed(1)}s</span></label>
                  <input type="range" min="500" max="5000" step="100" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className="w-full accent-purple-500 mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-300 flex justify-between"><span>Jitter (randomized delay ±)</span><span className="text-purple-300 font-medium">{jitterPct}%</span></label>
                  <input type="range" min="0" max="100" value={jitterPct} onChange={(e) => setJitterPct(Number(e.target.value))} className="w-full accent-purple-500 mt-1" />
                  <p className="text-[10px] text-gray-500 mt-0.5">Randomizes each delay so the gateway can't detect a fixed sending pattern.</p>
                </div>

                {/* Toggle switches */}
                <div className="space-y-2.5 pt-1">
                  <ToggleRow label="Humanize Timing" desc="Mimics human sending behavior" value={humanize} onChange={setHumanize} />
                  <ToggleRow label="AI Polymorph" desc="Rewrites each message uniquely with AI" value={polymorph} onChange={setPolymorph} />
                  <ToggleRow label="Drip Mode" desc="Spread sends over time (slow & safe)" value={dripMode} onChange={setDripMode} />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Campaign Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-500">Recipients</p><p className="text-xl font-bold text-white">{Math.min(parsedEmails.length, remaining)}</p></div>
                <div><p className="text-xs text-gray-500">Batch Size</p><p className="text-xl font-bold text-cyan-400">{batchSize}</p></div>
                <div><p className="text-xs text-gray-500">Delay</p><p className="text-xl font-bold text-cyan-400">{(delayMs / 1000).toFixed(1)}s ±{jitterPct}%</p></div>
                <div><p className="text-xs text-gray-500">Est. Time</p><p className="text-xl font-bold text-purple-400">{Math.ceil(Math.min(parsedEmails.length, remaining) / batchSize) * (delayMs / 1000 / 60)}m</p></div>
              </div>
              <div className="mt-3 p-3 bg-slate-900/50 rounded-lg text-xs text-gray-400">
                <p className="text-gray-500 mb-1">Email body preview:</p>
                {message.substring(0, 120)}{message.length > 120 ? '…' : ''}
              </div>
              {/* Anti-spam badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                {humanize && <span className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-300 border border-green-500/20 flex items-center gap-1"><Icon.Shield className="w-3 h-3" /> Humanized</span>}
                {polymorph && <span className="text-[10px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1"><Icon.Sparkle className="w-3 h-3" /> AI Polymorph</span>}
                {dripMode && <span className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1"><Icon.Clock className="w-3 h-3" /> Drip Mode</span>}
                <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"><Icon.Activity className="w-3 h-3" /> {jitterPct}% Jitter</span>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition">← Back</button>
              <button onClick={() => { setStep(3); handleSend(); }}
                disabled={loading || remaining <= 0 || (spamPreview && spamPreview.level === 'high')}
                className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-purple-600/30">
                {loading ? <Spinner /> : <Icon.Send className="w-4 h-4" />} Launch Campaign
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SEND / LIVE PROGRESS */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-12">
                <Spinner size={32} />
                <p className="text-sm text-gray-400 mt-4">Launching campaign with enterprise anti-spam config…</p>
              </div>
            )}

            {progress && !loading && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Icon.Activity className="w-4 h-4 text-purple-400" /> Live Progress
                  </h4>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    progress.status === 'sent' ? 'bg-green-500/20 text-green-300' :
                    progress.status === 'partial' ? 'bg-amber-500/20 text-amber-300' :
                    progress.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                    progress.status === 'blocked_spam' ? 'bg-red-500/20 text-red-300' :
                    'bg-blue-500/20 text-blue-300 animate-pulse'
                  }`}>{progress.status}</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress.totalSent > 0 ? Math.round((progress.totalSent / Math.max(progress.totalSent + progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-white">{progress.totalSent}</div><div className="text-xs text-gray-500 mt-0.5">Sent</div></div>
                  <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-400">{progress.totalDelivered}</div><div className="text-xs text-gray-500 mt-0.5">Delivered</div></div>
                  <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-400">{progress.totalUndelivered}</div><div className="text-xs text-gray-500 mt-0.5">Undelivered</div></div>
                  <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-amber-400">{progress.totalInvalid || 0}</div><div className="text-xs text-gray-500 mt-0.5">Invalid</div></div>
                </div>

                {progress.senderApiName && (
                  <p className="text-xs text-gray-500">Sender API: <span className="text-cyan-400">{progress.senderApiName}</span> · Batch: {progress.batchSize} · Delay: {(progress.delayMs / 1000).toFixed(1)}s</p>
                )}

                {progress.status === 'blocked_spam' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">⚠ Campaign blocked by spam protection (score: {progress.spamScore}). Rewrite your message.</div>
                )}

                {['sent', 'partial', 'failed'].includes(progress.status) && (
                  <div className="flex gap-2">
                    {result && result.campaignId && (
                      <button onClick={() => onCampaignClick(result.campaignId)} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition">View Delivery Details</button>
                    )}
                    <button onClick={() => { setStep(0); setMessage(''); setSubject(''); setNumbersText(''); setResult(null); setProgress(null); setSpamPreview(null); }}
                      className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition">New Campaign</button>
                  </div>
                )}
              </div>
            )}

            {result && result.blocked && !progress && !loading && (
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm font-bold text-red-300 mb-2">⚠ Message Blocked — Spam Protection</p>
                <p className="text-xs text-red-400 mb-2">Spam score: {result.spamScore}/100</p>
                {result.spamReasons && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {result.spamReasons.map((r, i) => <span key={i} className="text-xs bg-red-500/10 px-2 py-0.5 rounded text-red-300">{r}</span>)}
                  </div>
                )}
                <button onClick={() => setStep(0)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm">← Rewrite Message</button>
              </div>
            )}
          </div>
        )}
      </div>

      {result && result.invalidNumbers && result.invalidNumbers.length > 0 && step !== 3 && (
        <div className="bg-slate-900/50 rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-red-400 font-medium mb-1.5">Invalid emails rejected:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.invalidNumbers.map((inv, i) => (
              <span key={i} className="text-xs bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg text-red-300">
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
// Toggle Row — for enterprise anti-spam switches
// ================================================================
function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-200 font-medium">{label}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${value ? 'bg-green-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ================================================================
// EMAIL DELIVERABILITY TAB — recipient domains, tips, best practices
// ================================================================
function CountrySupportTab() {
  const [search, setSearch] = useState('');
  const [expandedRegion, setExpandedRegion] = useState(null);

  const MAILBOX_PROVIDERS = [
    { region: 'North America', flag: '🌎', providers: [
      { name: 'Gmail', domain: 'gmail.com', note: 'Largest provider — 1.5B+ users', volume: '~27%' },
      { name: 'Google Workspace', domain: 'yourcompany.com (Google)', note: 'Business Gmail', volume: '—' },
      { name: 'Outlook.com', domain: 'outlook.com', note: 'Microsoft consumer', volume: '~7%' },
      { name: 'Yahoo Mail', domain: 'yahoo.com', note: 'Aggressive spam filter', volume: '~5%' },
      { name: 'AOL Mail', domain: 'aol.com', note: 'Legacy (Yahoo-owned)', volume: '~1%' },
      { name: 'iCloud Mail', domain: 'icloud.com', note: 'Apple — strict DKIM', volume: '~4%' },
    ]},
    { region: 'Asia Pacific', flag: '🌏', providers: [
      { name: 'Yahoo Japan', domain: 'yahoo.co.jp', note: 'Japan #1 — very strict', volume: '~15% JP' },
      { name: 'Naver', domain: 'naver.com', note: 'South Korea — strict auth', volume: '~10% KR' },
      { name: 'QQ Mail', domain: 'qq.com', note: 'China — Tencent', volume: '~20% CN' },
      { name: '163 Mail', domain: '163.com', note: 'China — NetEase', volume: '~15% CN' },
      { name: 'Rediffmail', domain: 'rediffmail.com', note: 'India legacy', volume: '~2% IN' },
      { name: 'Zoho Mail', domain: 'zoho.com', note: 'India-based business', volume: '—' },
    ]},
    { region: 'Europe & MENA', flag: '🌍', providers: [
      { name: 'Mail.ru', domain: 'mail.ru', note: 'Russia/CIS — strict filtering', volume: '~15% RU' },
      { name: 'Yandex Mail', domain: 'yandex.com', note: 'Russia — strict DKIM/SPF', volume: '~10% RU' },
      { name: 'GMX', domain: 'gmx.com', note: 'Germany/EU', volume: '~2% EU' },
      { name: 'Web.de', domain: 'web.de', note: 'Germany — 1&1', volume: '~2% DE' },
      { name: 'ProtonMail', domain: 'proton.me', note: 'Privacy-focused, very strict', volume: '—' },
      { name: 'Orange', domain: 'orange.fr', note: 'France telecom', volume: '~5% FR' },
    ]},
  ];

  const DELIVERABILITY_TIPS = [
    { icon: '🔐', priority: 'CRITICAL', title: 'DNS Authentication (SPF + DKIM + DMARC)', desc: 'Set all three DNS records for your sending domain. Without these, most providers will mark your emails as spam or reject them entirely.' },
    { icon: '📈', priority: 'CRITICAL', title: 'Warm Up New Accounts', desc: 'Start with 20-50 emails/day per account and gradually increase over 2 weeks. Sudden bulk sends from new accounts trigger immediate spam flags.' },
    { icon: '🎲', priority: 'HIGH', title: 'Use #RANDOM# in Subject Lines', desc: 'The #RANDOM# token generates a unique string per email, preventing exact-match spam detection across bulk sends. Essential for high-volume campaigns.' },
    { icon: '✨', priority: 'HIGH', title: 'Enable AI Polymorph', desc: 'AI rewrites each email body uniquely, so no two emails are identical. This dramatically reduces spam-filter triggering from duplicate content.' },
    { icon: '⏱️', priority: 'HIGH', title: 'Batch + Delay Strategy', desc: 'Keep batch size ≤50 per account. Add 60-120 second random delays between batches. Use Jitter to randomize timing and avoid pattern detection.' },
    { icon: '👤', priority: 'MEDIUM', title: 'Personalize Content', desc: 'Use recipient name and relevant context. Avoid generic "Dear Customer" — personalization improves open rates and reduces spam scoring.' },
    { icon: '📝', priority: 'MEDIUM', title: 'Include Plain-Text Alternative', desc: 'Always provide a text/plain version alongside HTML. Many spam filters penalize HTML-only emails as suspicious.' },
    { icon: '🚫', priority: 'MEDIUM', title: 'Avoid Spam Trigger Words', desc: 'Avoid: FREE, GUARANTEE, ACT NOW, LIMITED TIME, ALL CAPS, excessive exclamation marks (!!), and red text. These are classic spam signals.' },
    { icon: '📤', priority: 'MEDIUM', title: 'Always Include Unsubscribe Link', desc: 'CAN-SPAM (US) and GDPR (EU) require a visible, working unsubscribe link. Compliance improves sender reputation.' },
    { icon: '📊', priority: 'LOW', title: 'Monitor Bounce Rate', desc: 'Keep bounce rate under 3%. Suspend accounts exceeding 5% bounces. High bounce rates damage domain reputation permanently.' },
  ];

  const filtered = MAILBOX_PROVIDERS.map(region => ({
    ...region,
    providers: region.providers.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domain.toLowerCase().includes(search.toLowerCase()) ||
      p.note.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(r => r.providers.length > 0);

  const filteredTips = DELIVERABILITY_TIPS.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Icon.Mail} label="Mailbox Providers" value="18+" color="blue" />
        <StatCard icon={Icon.Globe} label="Regions" value={MAILBOX_PROVIDERS.length} color="purple" />
        <StatCard icon={Icon.Shield} label="Deliverability Tips" value={DELIVERABILITY_TIPS.length} color="cyan" />
        <StatCard icon={Icon.Send} label="Coverage" value="Global" sub="Any email domain" color="green" />
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Icon.Mail className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Email Deliverability — Global Mailbox Providers</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Our Gmail Mailer sends directly to any email address worldwide. Below are the major mailbox providers and their filtering behavior.
            Unlike MMS gateways (which required carrier-specific domains), email sending works universally — just enter recipient email addresses.
            Follow the deliverability tips below to maximize inbox placement and avoid spam folders.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon.Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by provider name, domain, or tip…"
          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Mailbox provider cards */}
      <div className="space-y-4">
        {filtered.map((region, ri) => (
          <div key={ri} className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedRegion(expandedRegion === ri ? null : ri)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{region.flag}</span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-white">{region.region}</h3>
                  <p className="text-xs text-gray-500">{region.providers.length} mailbox providers</p>
                </div>
              </div>
              <Icon.Plus className={`w-5 h-5 text-gray-500 transition-transform ${expandedRegion === ri ? 'rotate-45' : ''}`} />
            </button>

            {expandedRegion === ri && (
              <div className="px-5 pb-5 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                {region.providers.map((provider, ci) => (
                  <div key={ci} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon.Mail className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">{provider.name}</h4>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-mono font-bold">{provider.volume}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                      <p className="text-xs text-cyan-300 font-mono truncate">{provider.domain}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">{provider.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deliverability tips */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Shield className="w-4 h-4 text-green-400" /> Email Deliverability Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTips.map((tip, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${tip.priority === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' : tip.priority === 'HIGH' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
              <span className="text-xl flex-shrink-0">{tip.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-bold text-white">{tip.title}</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${tip.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : tip.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>{tip.priority}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ================================================================
// REPORTS TAB — campaigns + delivery reports
// ================================================================
function ReportsTab({ campaigns, deliveryReports, onCampaignClick }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (c) => {
    setSelected(c);
    onCampaignClick(c._id);
  };

  // Aggregate stats
  const totalSent = campaigns.reduce((s, c) => s + (c.totalSent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.totalDelivered || 0), 0);
  const totalUndelivered = campaigns.reduce((s, c) => s + (c.totalUndelivered || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Icon.Send} label="Total Campaigns" value={campaigns.length} color="purple" />
        <StatCard icon={Icon.CheckCircle} label="Total Sent" value={totalSent} color="blue" />
        <StatCard icon={Icon.Target} label="Delivery Rate" value={`${deliveryRate}%`} color="green" />
        <StatCard icon={Icon.XCircle} label="Undelivered" value={totalUndelivered} color="red" />
      </div>

      {/* Delivery donut */}
      {totalSent > 0 && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon.Target className="w-4 h-4 text-green-400" /> Delivery Breakdown
          </h3>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative" style={{ width: 140, height: 140 }}>
              <svg width="140" height="140">
                <circle cx="70" cy="70" r="55" fill="none" stroke="#1e293b" strokeWidth="14" />
                <circle cx="70" cy="70" r="55" fill="none" stroke="#22c55e" strokeWidth="14"
                  strokeDasharray={`${(deliveryRate / 100) * 2 * Math.PI * 55} ${2 * Math.PI * 55}`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-green-400">{deliveryRate}%</span>
                <span className="text-[10px] text-gray-500">delivered</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="text-sm text-gray-300">Delivered: <span className="font-bold text-white">{totalDelivered}</span></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-sm text-gray-300">Undelivered: <span className="font-bold text-white">{totalUndelivered}</span></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-700" /><span className="text-sm text-gray-300">Total attempts: <span className="font-bold text-white">{totalSent}</span></span></div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Layers className="w-4 h-4 text-purple-400" /> Campaign History
        </h3>
        {campaigns.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Icon.Report className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No campaigns yet. Send your first campaign from the Send Email tab.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c._id} className={`rounded-xl p-4 cursor-pointer transition border ${selected?._id === c._id ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                onClick={() => handleSelect(c)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      c.status === 'sent' ? 'bg-green-500/20 text-green-300' :
                      c.status === 'partial' ? 'bg-amber-500/20 text-amber-300' :
                      c.status === 'blocked_spam' ? 'bg-red-500/20 text-red-300' :
                      c.status === 'running' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>{c.status}</span>
                    <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.totalSent || 0} sent · {c.totalDelivered || 0} delivered
                  </div>
                </div>
                <p className="text-sm text-gray-300 truncate">{c.message?.substring(0, 80) || 'No message'}…</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery reports for selected campaign */}
      {selected && deliveryReports.length > 0 && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon.Report className="w-4 h-4 text-cyan-400" /> Delivery Details — {selected.message?.substring(0, 30) || 'Campaign'}…
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {deliveryReports.map((dr, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-xs">
                <span className="text-gray-300 font-mono">{dr.number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{dr.senderApiName}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    dr.status === 'sent' || dr.status === 'delivered' ? 'bg-green-500/20 text-green-300' :
                    dr.status === 'invalid' ? 'bg-red-500/20 text-red-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>{dr.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// INFO TAB — app info + features
// ================================================================
function InfoTab({ settings }) {
  const info = [
    { icon: Icon.Whatsapp, label: 'WhatsApp', value: settings?.whatsapp || 'Not set', color: 'text-green-400' },
    { icon: Icon.Mail, label: 'Email', value: settings?.email || 'Not set', color: 'text-indigo-400' },
    { icon: Icon.Phone, label: 'Phone', value: settings?.phone || settings?.whatsapp || 'Not set', color: 'text-blue-400' },
  ];

  const features = [
    { icon: Icon.Sparkle, label: 'AI-powered message suggestions', desc: 'Gemini AI helps you write spam-free messages' },
    { icon: Icon.Shield, label: 'Enterprise spam protection', desc: 'Multi-layer anti-spam: heuristic + AI + country rules' },
    { icon: Icon.Globe, label: 'Global email reach', desc: 'Send to any email address worldwide — no carrier restrictions' },
    { icon: Icon.Bolt, label: 'Auto-routing sender APIs', desc: 'Intelligent load-balancing across multiple providers' },
    { icon: Icon.Inbox, label: 'Inbox & auto-reply', desc: 'Multi-language automatic email auto-responder' },
    { icon: Icon.Clock, label: 'Scheduled sends', desc: 'Plan campaigns for optimal delivery times' },
    { icon: Icon.Activity, label: 'Live progress tracking', desc: 'Real-time campaign delivery monitoring' },
    { icon: Icon.Target, label: 'Delivery reports', desc: 'Per-recipient delivery status tracking' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20">
            {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-8 h-8 text-white" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{settings?.platformName || 'Gmail Mailer'}</h2>
            <p className="text-xs text-purple-400/70 mt-0.5">{settings?.language === 'bn' ? 'Language: Bangla' : 'Language: English'}</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-5 leading-relaxed">
          {settings?.description || 'Enterprise Gmail Email Sending Module — send campaigns with AI-powered spam protection and auto-routing.'}
        </p>

        <div className="space-y-3">
          {info.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm text-gray-200">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Shield className="w-4 h-4 text-green-400" /> Platform Features
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <f.icon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-gray-200 font-medium">{f.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// INBOX & AUTO-REPLY TAB — preserved functionality, upgraded styling
// ================================================================
function InboxAutoReplyTab({ language, onToast, loginId }) {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, msgRes] = await Promise.all([
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getAutoReplyConfig' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getInboxMessages' }) }),
      ]);
      const cfg = await cfgRes.json();
      if (cfg.success) { setConfig(cfg.config); setWebhookUrl(cfg.webhookUrl || ''); }
      const msg = await msgRes.json();
      if (msg.success) setMessages(msg.messages);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'setAutoReplyConfig', enabled: config.enabled, languagePrompt: config.languagePrompt, replyMessage: config.replyMessage }),
      });
      const data = await res.json();
      if (data.success) { onToast('Auto-reply settings saved', 'success'); setConfig(data.config); }
      else onToast(data.error || 'Save failed', 'error');
    } catch { onToast('Network error', 'error'); }
    setSaving(false);
  };

  if (loading || !config) return <div className="flex items-center justify-center py-20"><Spinner size={24} /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/15 to-indigo-600/10 border border-purple-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Icon.Inbox className="w-6 h-6 text-purple-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">How Email Auto-Reply Works</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            When someone emails one of your connected inboxes (Gmail, Outlook, etc.), the system automatically replies with a language selection prompt.
            The sender chooses <span className="text-purple-300">1 (Bangla)</span>, <span className="text-purple-300">2 (English)</span>, or <span className="text-purple-300">3 (Sylheti)</span>,
            and then receives your pre-written reply in their chosen language \u2014 ideal for out-of-office, lead capture, or support acknowledgements.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Auto-Reply Status</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enable to automatically respond to incoming emails with language selection</p>
          </div>
          <button onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`relative w-14 h-7 rounded-full transition ${config.enabled ? 'bg-green-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition ${config.enabled ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5">
          <p className="text-xs text-gray-500 mb-2">Inbound Webhook URL (configure this in your email provider's inbound / IMAP-to-webhook forwarding):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-purple-300 bg-slate-900 px-3 py-2 rounded-lg font-mono break-all">{webhookUrl}</code>
            <button onClick={() => { navigator.clipboard?.writeText(webhookUrl); onToast('Webhook URL copied', 'success'); }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg flex-shrink-0 transition">Copy</button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">POST inbound emails to this URL with fields: {`{ action: 'emailInbound', From, Subject, Body, userEmail: '${loginId || 'YOUR_ID'}' }`}</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Step 1: Language Selection Prompt</h3>
        <p className="text-xs text-gray-500 mb-4">This email body is sent first when a message is received. It asks the sender to reply with a language choice.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'en', label: 'English Prompt', flag: '\ud83c\uddec\ud83c\udde7' },
            { key: 'bn', label: 'Bangla Prompt', flag: '\ud83c\udde7\ud83c\udde9' },
            { key: 'syl', label: 'Sylheti Prompt', flag: ' Sylheti' },
          ].map(({ key, label, flag }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1.5 block">{flag} {label}</label>
              <textarea
                value={config.languagePrompt?.[key] || ''}
                onChange={(e) => setConfig({ ...config, languagePrompt: { ...config.languagePrompt, [key]: e.target.value } })}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Step 2: Auto-Reply Messages</h3>
        <p className="text-xs text-gray-500 mb-4">After the sender replies with their language choice (1/2/3), this is the email they receive in that language.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'bn', label: 'Bangla Reply (Option 1)', flag: '\ud83c\udde7\ud83c\udde9' },
            { key: 'en', label: 'English Reply (Option 2)', flag: '\ud83c\uddec\ud83c\udde7' },
            { key: 'syl', label: 'Sylheti Reply (Option 3)', flag: ' Sylheti' },
          ].map(({ key, label, flag }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1.5 block">{flag} {label}</label>
              <textarea
                value={config.replyMessage?.[key] || ''}
                onChange={(e) => setConfig({ ...config, replyMessage: { ...config.replyMessage, [key]: e.target.value } })}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition flex items-center gap-2 shadow-lg shadow-purple-600/30">
          {saving ? <Spinner size={14} /> : <Icon.Check className="w-4 h-4" />}
          {saving ? 'Saving\u2026' : 'Save Auto-Reply Settings'}
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Recent Inbound Emails</h3>
          <button onClick={load} className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"><Icon.Refresh className="w-3.5 h-3.5" />Refresh</button>
        </div>
        {messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Icon.Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No inbound emails yet. Once your email provider webhook is configured, received messages will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon.Mail className="w-4 h-4 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-white">{m.fromNumber || m.fromEmail || 'Unknown sender'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      m.state === 'replied' ? 'bg-green-500/20 text-green-300' :
                      m.state === 'awaiting_language' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-700 text-gray-400'
                    }`}>
                      {m.state === 'replied' ? `Replied (${m.selectedLanguage || '?'})` : m.state === 'awaiting_language' ? 'Awaiting language' : 'Direct'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">Incoming: {m.incomingMessage || '(empty)'}</p>
                  {m.replySent && <p className="text-xs text-gray-500 mt-0.5">Reply: {m.replySent.slice(0, 80)}\u2026</p>}
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(m.receivedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
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
    } catch { onToast('Network error', 'error'); }
    setLoading(false);
  };

  return (
    <div className="mt-6 bg-slate-900/50 border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Icon.Calendar className="w-4 h-4 text-blue-400" /> Scheduled Sends
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 transition">
          <Icon.Plus className="w-3.5 h-3.5" /> {showForm ? 'Cancel' : 'Schedule new'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSchedule} className="space-y-3 mb-4 p-4 bg-white/5 rounded-xl border border-white/5">
          <input type="text" value={sMessage} onChange={(e) => setSMessage(e.target.value)}
            placeholder="Email body content"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <input type="text" value={sNumbers} onChange={(e) => setSNumbers(e.target.value)}
            placeholder="Recipient emails (comma or newline separated)"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <input type="datetime-local" value={sTime} onChange={(e) => setSTime(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <button type="submit" disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition">
            {loading ? <Spinner /> : <Icon.Clock className="w-4 h-4" />} Schedule
          </button>
        </form>
      )}

      {scheduled.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-6">No scheduled sends yet.</p>
      ) : (
        <div className="space-y-2">
          {scheduled.map((s) => (
            <div key={s._id} className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-blue-300 font-medium text-xs flex items-center gap-1.5"><Icon.Calendar className="w-3.5 h-3.5" /> {new Date(s.scheduledAt).toLocaleString()}</span>
                <span className="text-gray-500 text-xs">{s.numbers?.length || 0} recipients</span>
              </div>
              <p className="text-xs text-gray-300">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// AI CHAT POPUP — floating, Gemini-powered, language-aware
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
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
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-2xl shadow-purple-600/40 flex items-center justify-center text-white hover:scale-110 transition"
          aria-label="AI Support">
          <Icon.Chat className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Icon.Sparkle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AI Support</div>
                <div className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><Icon.Close className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Icon.Sparkle className="w-10 h-10 text-purple-500/50 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  {language === 'bn' ? 'হাই! আমি আপনাকে সাহায্য করতে পারি। কী জানতে চান?' : "Hi! I'm your AI assistant. How can I help you today?"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs ${m.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-gray-400 ml-1">Typing…</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleSend(); }}
              placeholder={language === 'bn' ? 'মেসেজ লিখুন…' : 'Type a message…'}
              className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs" />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center">
              {loading ? <Spinner size={14} /> : <Icon.Send2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
