'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// ICON COMPONENTS (professional SVG, no emoji)
// ============================================================================
const Icon = {
  Dashboard: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>),
  Api: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>),
  Users: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>),
  Campaign: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>),
  Content: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>),
  Shield: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>),
  Settings: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>),
  Bell: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>),
  Log: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>),
  Database: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>),
  Lock: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>),
  Refresh: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>),
  Eye: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>),
  EyeOff: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>),
  Plus: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>),
  Trash: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>),
  Check: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>),
  Logout: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>),
  Send: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>),
  Activity: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>),
  Zap: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>),
};

// ============================================================================
// API HELPER
// ============================================================================
async function api(action, data = {}) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

// ============================================================================
// MAIN ADMIN PANEL
// ============================================================================
export default function AdminPanel({ mode, user, onLoginSuccess, onLogout, onRefresh }) {
  if (mode === 'login') return <AdminLogin onLoginSuccess={onLoginSuccess} />;
  return <AdminDashboard user={user} onLogout={onLogout} onRefresh={onRefresh} />;
}

// ============================================================================
// ADMIN LOGIN — 3-layer security (username + password + API key)
// ============================================================================
function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstSetupCreds, setFirstSetupCreds] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api('adminLogin', { username, password, apiKey });
      if (data.success) {
        onLoginSuccess({ role: data.role, username: data.username, permissions: data.permissions });
      } else if (data.firstSetup) {
        setFirstSetupCreds(data.credentials);
        setError(data.message);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Admin Control</h1>
          <p className="text-gray-500 text-sm mt-1">Master Configuration Hub</p>
        </div>

        {firstSetupCreds && (
          <div className="mb-4 p-4 bg-blue-900/40 border border-blue-700/50 rounded-xl">
            <p className="text-blue-300 text-sm font-semibold mb-2">Save these credentials:</p>
            <div className="space-y-1 text-sm font-mono text-blue-100">
              <p>Username: <span className="text-white">{firstSetupCreds.username}</span></p>
              <p>Password: <span className="text-white">{firstSetupCreds.password}</span></p>
              <p>API Key: <span className="text-white">{firstSetupCreds.apiKey}</span></p>
            </div>
            <p className="text-blue-400 text-xs mt-2">Now login with these credentials.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter username" />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">API Key</label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} required
                className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter API key" />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showApiKey ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-2.5 rounded-lg transition shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Authenticating...</> : <><Icon.Lock /> Secure Login</>}
          </button>
        </form>
        <p className="text-center text-gray-600 text-xs mt-4">3-Layer Security: Username + Password + API Key</p>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function AdminDashboard({ user, onLogout, onRefresh }) {
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icon.Dashboard /> },
    { id: 'apis', label: 'API Management', icon: <Icon.Api /> },
    { id: 'users', label: 'User Management', icon: <Icon.Users /> },
    { id: 'campaigns', label: 'Campaigns', icon: <Icon.Campaign /> },
    { id: 'content', label: 'Content & Templates', icon: <Icon.Content /> },
    { id: 'subadmins', label: 'Sub-Admins', icon: <Icon.Shield /> },
    { id: 'database', label: 'Database', icon: <Icon.Database /> },
    { id: 'blacklist', label: 'Blacklist', icon: <Icon.Lock /> },
    { id: 'alerts', label: 'Alerts', icon: <Icon.Bell /> },
    { id: 'logs', label: 'Activity Logs', icon: <Icon.Log /> },
    { id: 'security', label: 'Admin Security', icon: <Icon.Shield /> },
    { id: 'settings', label: 'Settings', icon: <Icon.Settings /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-gray-200">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center"><Icon.Shield /></div>
            <div><p className="font-bold text-white">Admin Panel</p><p className="text-xs text-gray-500">{user?.username}</p></div>
          </div>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto" style={{maxHeight: 'calc(100vh - 140px)'}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-blue-600/20 text-blue-400 border border-blue-700/30' : 'text-gray-400 hover:bg-slate-800 hover:text-gray-200'}`}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 space-y-2">
          <button onClick={onRefresh} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-cyan-400 hover:bg-cyan-900/20 transition"><Icon.Refresh />Primary Refresh</button>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition"><Icon.Logout />Logout</button>
        </div>
      </div>

      {/* Mobile toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 p-2 rounded-lg">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      {/* Main content */}
      <div className="lg:ml-64 p-6 pt-16 lg:pt-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'apis' && <ApiManagementTab />}
        {tab === 'users' && <UserManagementTab />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'subadmins' && <SubAdminTab />}
        {tab === 'database' && <DatabaseTab />}
        {tab === 'blacklist' && <BlacklistTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'security' && <SecurityTab user={user} />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SPINNER
// ============================================================================
function Spinner() { return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>; }

// ============================================================================
// ENTERPRISE DASHBOARD — sleek, modern, data-dense, no ugly boxes
// Reusable visual primitives
// ============================================================================

// Thin progress bar (used inside cards/rows)
function ProgressBar({ percent, color }) {
  const c = color || (percent > 80 ? 'from-red-500 to-rose-500' : percent > 50 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500');
  return (
    <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${c} transition-all duration-700`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

// Compact KPI tile — flat, glassy, subtle left accent. NOT the old bulky box.
function Kpi({ label, value, sub, tone = 'slate', live, trend }) {
  const tones = {
    slate:  { accent: 'bg-slate-600',   value: 'text-white',      glow: '' },
    green:  { accent: 'bg-emerald-500',  value: 'text-emerald-300', glow: 'shadow-emerald-500/10' },
    red:    { accent: 'bg-rose-500',     value: 'text-rose-300',    glow: 'shadow-rose-500/10' },
    amber:  { accent: 'bg-amber-500',    value: 'text-amber-300',   glow: 'shadow-amber-500/10' },
    blue:   { accent: 'bg-sky-500',      value: 'text-sky-300',     glow: 'shadow-sky-500/10' },
    violet: { accent: 'bg-violet-500',   value: 'text-violet-300',  glow: 'shadow-violet-500/10' },
    cyan:   { accent: 'bg-cyan-500',     value: 'text-cyan-300',    glow: 'shadow-cyan-500/10' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`relative bg-slate-900/50 border border-slate-800/80 rounded-lg px-4 py-3 overflow-hidden hover:border-slate-700 transition-colors`}>
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${t.accent}`} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide truncate">{label}</p>
        {live && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <p className={`text-2xl font-semibold tabular-nums ${t.value} leading-none`}>{value}</p>
        {trend != null && <span className={`text-[11px] font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</span>}
      </div>
      {sub && <p className="text-[11px] text-slate-600 mt-1 truncate">{sub}</p>}
    </div>
  );
}

// Radial gauge (pure SVG) for percentage metrics like inbox rate / panel health
function RadialGauge({ value, label, sub, color = '#34d399', size = 120 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">{value}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium mt-2">{label}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

// Horizontal bar row (for API usage list — clean, no boxes)
function UsageRow({ name, type, used, limit, percent, status, extras, last }) {
  const statusMap = {
    active:  { dot: 'bg-emerald-400', txt: 'text-emerald-400' },
    warning: { dot: 'bg-amber-400', txt: 'text-amber-400' },
    blocked: { dot: 'bg-rose-400', txt: 'text-rose-400' },
    paused:  { dot: 'bg-slate-500', txt: 'text-slate-500' },
  };
  const s = statusMap[status] || statusMap.paused;
  return (
    <div className={`py-3 ${last ? '' : 'border-b border-slate-800/60'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-none`} />
          <span className="text-sm text-slate-200 font-medium truncate">{name}</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wide flex-none">{type}</span>
        </div>
        <span className={`text-[10px] font-semibold ${s.txt} uppercase flex-none`}>{status}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1"><ProgressBar percent={percent} /></div>
        <span className="text-[11px] text-slate-500 tabular-nums flex-none w-24 text-right">{used}/{limit}</span>
      </div>
      {extras && <div className="flex gap-4 mt-1.5 text-[10px] text-slate-600">{extras}</div>}
    </div>
  );
}

// Live online-user pill list (uses users.withDetails)
function UserPresenceList({ users, limit = 8 }) {
  const sorted = [...(users || [])].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
  }).slice(0, limit);
  if (sorted.length === 0) return <p className="text-xs text-slate-600 py-4 text-center">No users yet.</p>;
  return (
    <div className="divide-y divide-slate-800/50">
      {sorted.map((u) => (
        <div key={u._id || u.email} className="flex items-center gap-3 py-2.5">
          <span className={`w-2 h-2 rounded-full flex-none ${u.isOnline ? 'bg-emerald-400 shadow-emerald-400/50 shadow-sm animate-pulse' : 'bg-slate-700'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-200 font-medium truncate">{u.email}</p>
            <p className="text-[10px] text-slate-600">last active {u.lastActiveAgo || '—'}</p>
          </div>
          <div className="flex-none text-right">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'suspended' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700/40 text-slate-400'}`}>{u.status}</span>
            {u.sentCount != null && <p className="text-[10px] text-slate-600 mt-0.5">{u.sentCount} sent</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mini bar chart (pure divs) for sending trend
function MiniBars({ values, labels }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2 h-20">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
            <div className="w-full max-w-[28px] rounded-t bg-gradient-to-t from-sky-600/40 to-sky-400 transition-all duration-700" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? '4px' : '2px' }} title={`${labels[i]}: ${v}`} />
          </div>
          <span className="text-[9px] text-slate-600 uppercase">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Section wrapper with header + optional action
function Section({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-slate-900/40 border border-slate-800/70 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// ENTERPRISE DASHBOARD TAB — replaces old boxy dashboard
// Same data shape (getDashboardStats), fully backward compatible.
// ============================================================================
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    const data = await api('getDashboardStats');
    if (data.success) { setStats(data.stats); setLastUpdated(new Date()); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval); }, [load]);

  if (loading && !stats) return <Spinner />;
  if (!stats) return <p className="text-slate-500">Failed to load stats.</p>;

  const ph = stats.apiHealth.panelHealth;
  const healthColor = ph > 70 ? '#34d399' : ph > 40 ? '#fbbf24' : '#fb7185';
  const healthTone = ph > 70 ? 'green' : ph > 40 ? 'amber' : 'red';
  const onlinePct = stats.users.total > 0 ? Math.round((stats.users.online / stats.users.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Top bar: title + live status + refresh ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Operations Overview
          </h2>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refresh 30s` : 'Auto-refresh every 30s'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-xs text-slate-400 hover:text-sky-400 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 transition">
          <Icon.Refresh /> Refresh
        </button>
      </div>

      {/* ── Row 1: Primary KPIs (6 compact tiles, replacing ugly boxes) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total Users" value={stats.users.total} sub={`${stats.users.suspended} suspended`} tone="blue" />
        <Kpi label="Online Now" value={stats.users.online} sub={`${onlinePct}% of total`} tone="green" live />
        <Kpi label="Sent Today" value={stats.sending.today} sub={`${stats.sending.running} running`} tone="cyan" />
        <Kpi label="Delivered" value={stats.inboxSpam.totalDelivered} sub={`${stats.inboxSpam.totalUndelivered} undelivered`} tone="violet" />
        <Kpi label="Spam Blocked" value={stats.inboxSpam.totalSpam} sub={`${stats.inboxSpam.spamRate}% rate`} tone="red" />
        <Kpi label="APIs Healthy" value={`${stats.apiHealth.good.length}/${stats.apiHealth.good.length + stats.apiHealth.warning.length + stats.apiHealth.blocked.length}`} sub={`${stats.apiHealth.blocked.length} blocked`} tone={stats.apiHealth.blocked.length > 0 ? 'amber' : 'green'} />
      </div>

      {/* ── Row 2: 3-column hero — Inbox gauge | Panel health gauge | Sending trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inbox quality */}
        <Section title="Delivery Quality" subtitle={`${stats.inboxSpam.totalSent} total messages sent`}>
          <div className="flex items-center gap-4">
            <RadialGauge value={stats.inboxSpam.inboxRate} label="Inbox Rate" sub={`${stats.inboxSpam.totalInbox} inbox`} color="#34d399" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Spam rate</span><span className="text-rose-400 font-semibold">{stats.inboxSpam.spamRate}%</span></div>
              <ProgressBar percent={stats.inboxSpam.spamRate} color="from-rose-500 to-red-500" />
              <div className="flex items-center justify-between text-xs pt-1"><span className="text-slate-500">Invalid numbers</span><span className="text-slate-300">{stats.inboxSpam.totalInvalid}</span></div>
              {stats.apiHealth.bestSenderForInbox && (
                <div className="mt-2 pt-2 border-t border-slate-800/60">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide">Best sender</p>
                  <p className="text-sm text-emerald-300 font-medium">{stats.apiHealth.bestSenderForInbox.name} · {stats.apiHealth.bestSenderForInbox.inboxRate}%</p>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Panel health */}
        <Section title="Platform Health" subtitle="Aggregated API health score">
          <div className="flex items-center gap-4">
            <RadialGauge value={ph} label="Panel Health" color={healthColor} />
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-500/5 border border-emerald-700/20 rounded-md py-2"><p className="text-lg font-semibold text-emerald-300">{stats.apiHealth.good.length}</p><p className="text-[9px] text-slate-600 uppercase">Good</p></div>
                <div className="bg-amber-500/5 border border-amber-700/20 rounded-md py-2"><p className="text-lg font-semibold text-amber-300">{stats.apiHealth.warning.length}</p><p className="text-[9px] text-slate-600 uppercase">Warn</p></div>
                <div className="bg-rose-500/5 border border-rose-700/20 rounded-md py-2"><p className="text-lg font-semibold text-rose-300">{stats.apiHealth.blocked.length}</p><p className="text-[9px] text-slate-600 uppercase">Blocked</p></div>
              </div>
              {(stats.apiHealth.blocked.length > 0 || stats.apiHealth.warning.length > 0) ? (
                <p className="text-[10px] text-slate-600 pt-1">
                  {stats.apiHealth.blocked.length > 0 && <span className="text-rose-400/80">⚠ {stats.apiHealth.blocked.map(a => a.name).join(', ')} blocked. </span>}
                  {stats.apiHealth.warning.length > 0 && <span className="text-amber-400/80">⚠ {stats.apiHealth.warning.map(a => a.name).join(', ')} need attention.</span>}
                </p>
              ) : (
                <p className="text-[10px] text-emerald-400/70 pt-1">✓ All APIs operating normally.</p>
              )}
            </div>
          </div>
        </Section>

        {/* Sending trend */}
        <Section title="Sending Volume" subtitle="Messages sent by period">
          <MiniBars values={[stats.sending.today, Math.round(stats.sending.week / 7), Math.round(stats.sending.month / 30), stats.sending.year]} labels={['Day', 'Avg/D', 'Avg/D', 'Year']} />
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/60">
            <div><p className="text-[10px] text-slate-600 uppercase">This week</p><p className="text-sm text-slate-200 font-semibold">{stats.sending.week}</p></div>
            <div><p className="text-[10px] text-slate-600 uppercase">Running now</p><p className="text-sm text-emerald-300 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{stats.sending.running} campaigns</p></div>
          </div>
        </Section>
      </div>

      {/* ── Row 3: API usage (clean rows, no boxes) + Live users ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* API usage — spans 2 cols */}
        <Section
          className="lg:col-span-2"
          title="API Usage & Routing"
          subtitle="Sender + Gemini AI — live consumption"
          action={<span className="text-[10px] text-slate-600">{stats.apiHealth.senderApis.length + stats.apiHealth.geminiApis.length} APIs</span>}
        >
          {stats.apiHealth.senderApis.length === 0 && stats.apiHealth.geminiApis.length === 0 ? (
            <p className="text-xs text-slate-600 py-6 text-center">No APIs configured. Add them in <span className="text-sky-400">API Management</span>.</p>
          ) : (
            <div>
              {stats.apiHealth.senderApis.map((a, i) => (
                <UsageRow
                  key={a.id}
                  name={a.name}
                  type="Sender"
                  used={a.used}
                  limit={a.limit}
                  percent={a.usagePercent}
                  status={a.status}
                  last={i === stats.apiHealth.senderApis.length - 1 && stats.apiHealth.geminiApis.length === 0}
                  extras={[
                    <span key="in">Inbox {a.inboxRate}%</span>,
                    <span key="sp">Spam {a.spamRate}%</span>,
                    <span key="hl">Health {a.healthScore}%</span>,
                    a.autoRoute && <span key="ar" className="text-sky-400/70">Auto-route</span>,
                  ]}
                />
              ))}
              {stats.apiHealth.geminiApis.map((a, i) => (
                <UsageRow
                  key={a.id}
                  name={a.name}
                  type="Gemini AI"
                  used={a.used}
                  limit={a.limit}
                  percent={a.usagePercent}
                  status={a.status}
                  last={i === stats.apiHealth.geminiApis.length - 1}
                  extras={[<span key="hl">Health {a.healthScore}%</span>, a.autoRoute && <span key="ar" className="text-sky-400/70">Auto-route</span>]}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Live users */}
        <Section
          title="Live User Presence"
          subtitle={`${stats.users.online} online of ${stats.users.total}`}
          action={<span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{onlinePct}%</span>}
        >
          <UserPresenceList users={stats.users.withDetails} />
        </Section>
      </div>

      {/* ── Row 4: Database usage (clean rows) ── */}
      <Section title="Database Connections" subtitle="MongoDB storage utilization">
        {stats.database.length === 0 ? (
          <p className="text-xs text-slate-600 py-3 text-center">Using default MongoDB connection.</p>
        ) : (
          <div>
            {stats.database.map((db, i) => (
              <UsageRow
                key={db.id}
                name={`${db.label}${db.isActive ? ' · Active' : ''}`}
                type="MongoDB"
                used={`${db.storageUsed}MB`}
                limit={`${db.storageLimit}MB`}
                percent={db.usagePercent}
                status={db.isActive ? 'active' : 'paused'}
                last={i === stats.database.length - 1}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ============================================================================
// API MANAGEMENT TAB
// ============================================================================
function ApiManagementTab() {
  const [senderApis, setSenderApis] = useState([]);
  const [geminiApis, setGeminiApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSenderForm, setShowSenderForm] = useState(false);
  const [showGeminiForm, setShowGeminiForm] = useState(false);
  const [senderForm, setSenderForm] = useState({ name: '', provider: 'custom', apiKey: '', apiSecret: '', endpoint: '', senderId: '', limit: 1000, priority: 0 });
  const [geminiForm, setGeminiForm] = useState({ name: '', apiKey: '', model: 'gemini-1.5-flash', limit: 1500, priority: 0 });
  const [testing, setTesting] = useState(null);     // apiId being tested
  const [testResult, setTestResult] = useState({});  // { [apiId]: {success, ...} }
  const [testModal, setTestModal] = useState(null);  // { api, number, message }

  // Provider templates — auto-fill endpoint + fields when provider changes
  const PROVIDER_TEMPLATES = {
    twilio: {
      label: 'Twilio',
      endpoint: 'https://api.twilio.com/2010-04-01',
      needsSecret: true,
      secretLabel: 'Auth Token',
      keyLabel: 'Account SID',
      help: 'apiKey = Account SID, apiSecret = Auth Token, senderId = Twilio phone number (e.g. +1234567890)',
    },
    vonage: {
      label: 'Vonage / Nexmo',
      endpoint: 'https://api.nexmo.com',
      needsSecret: true,
      secretLabel: 'API Signature Secret',
      keyLabel: 'API Key',
      help: 'apiKey = API Key, apiSecret = API Secret. Vonage Messages API v0.1 is used automatically.',
    },
    messagebird: {
      label: 'MessageBird',
      endpoint: 'https://rest.messagebird.com',
      needsSecret: false,
      keyLabel: 'Access Key (live_...)',
      help: 'apiKey = MessageBird Access Key. senderId = originator (e.g. +1234567890 or a text sender).',
    },
    custom: {
      label: 'Custom HTTP',
      endpoint: '',
      needsSecret: false,
      keyLabel: 'API Key / Bearer Token',
      help: 'Any HTTP endpoint. Body sent as JSON: {to, from, message, apiKey, sender}. Bearer auth header.',
    },
  };

  const load = async () => {
    setLoading(true);
    const [s, g] = await Promise.all([api('getSenderApis'), api('getGeminiApis')]);
    if (s.success) setSenderApis(s.apis);
    if (g.success) setGeminiApis(g.apis);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onProviderChange = (provider) => {
    const tmpl = PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom;
    setSenderForm((f) => ({ ...f, provider, endpoint: tmpl.endpoint || f.endpoint }));
  };

  const addSender = async (e) => {
    e.preventDefault();
    const data = await api('addSenderApi', senderForm);
    if (data.success) { setShowSenderForm(false); setSenderForm({ name: '', provider: 'custom', apiKey: '', apiSecret: '', endpoint: '', senderId: '', limit: 1000, priority: 0 }); load(); }
    else alert(data.error);
  };

  const addGemini = async (e) => {
    e.preventDefault();
    const data = await api('addGeminiApi', geminiForm);
    if (data.success) { setShowGeminiForm(false); setGeminiForm({ name: '', apiKey: '', model: 'gemini-1.5-flash', limit: 1500, priority: 0 }); load(); }
    else alert(data.error);
  };

  const runTest = async () => {
    if (!testModal) return;
    setTesting(testModal.api._id);
    setTestResult((r) => ({ ...r, [testModal.api._id]: null }));
    const data = await api('testSenderApi', { apiId: testModal.api._id, testNumber: testModal.number, testMessage: testModal.message });
    setTestResult((r) => ({ ...r, [testModal.api._id]: data }));
    setTesting(null);
    if (data.success) { setTestModal(null); load(); }
  };

  if (loading) return <Spinner />;

  const tmpl = PROVIDER_TEMPLATES[senderForm.provider] || PROVIDER_TEMPLATES.custom;

  // Health ring — SVG circular gauge (0-100)
  const HealthRing = ({ score, size = 48 }) => {
    const r = (size - 6) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score));
    const dash = (pct / 100) * c;
    const color = pct > 70 ? '#22c55e' : pct > 40 ? '#eab308' : '#ef4444';
    return (
      <svg width={size} height={size} className="flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500" />
        <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[11px] font-bold">{pct}</text>
      </svg>
    );
  };

  // 4-metric mini-grid for each sender API
  const ApiMetrics = ({ a }) => (
    <div className="grid grid-cols-4 gap-2 mt-3">
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Sent</p>
        <p className="text-sm font-bold text-white">{a.totalSent}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Inbox</p>
        <p className="text-sm font-bold text-green-400">{a.inboxRate}%</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Spam</p>
        <p className="text-sm font-bold text-red-400">{a.spamRate}%</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Left</p>
        <p className="text-sm font-bold text-cyan-400">{a.remaining}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">API Management</h2>

      {/* Sender APIs */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Sender APIs <span className="text-sm text-gray-500">({senderApis.length}/10)</span></h3>
          {senderApis.length < 10 && <button onClick={() => setShowSenderForm(!showSenderForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Sender API</button>}
        </div>

        {/* Add Sender Form — enterprise with provider selector */}
        {showSenderForm && (
          <form onSubmit={addSender} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name (e.g. Twilio Primary)" value={senderForm.name} onChange={e => setSenderForm({...senderForm, name: e.target.value})} required />
              {/* Provider selector dropdown */}
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={senderForm.provider} onChange={e => onProviderChange(e.target.value)}>
                {Object.entries(PROVIDER_TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={tmpl.keyLabel || 'API Key'} value={senderForm.apiKey} onChange={e => setSenderForm({...senderForm, apiKey: e.target.value})} required />
              {tmpl.needsSecret && (
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={tmpl.secretLabel || 'API Secret'} value={senderForm.apiSecret} onChange={e => setSenderForm({...senderForm, apiSecret: e.target.value})} />
              )}
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Endpoint URL" value={senderForm.endpoint} onChange={e => setSenderForm({...senderForm, endpoint: e.target.value})} />
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Sender ID / From number" value={senderForm.senderId} onChange={e => setSenderForm({...senderForm, senderId: e.target.value})} />
              <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Limit (total sends)" value={senderForm.limit} onChange={e => setSenderForm({...senderForm, limit: parseInt(e.target.value) || 0})} />
              <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Priority (higher=preferred)" value={senderForm.priority} onChange={e => setSenderForm({...senderForm, priority: parseInt(e.target.value) || 0})} />
            </div>
            {tmpl.help && <p className="text-xs text-gray-500 bg-slate-800/40 rounded-lg p-2">💡 {tmpl.help}</p>}
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Save Sender API</button>
          </form>
        )}

        {/* Sender API cards — enterprise with health ring + 4-metric grid + test send */}
        <div className="space-y-3">
          {senderApis.map(a => {
            const tr = testResult[a._id];
            return (
              <div key={a._id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <HealthRing score={a.healthScore} />
                    <div>
                      <span className="text-sm font-bold text-white">{a.name}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 uppercase">{(PROVIDER_TEMPLATES[a.provider] || {}).label || a.provider}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900/40 text-green-400' : a.status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>{a.status}</span>
                      {a.autoRoute && <span className="ml-2 text-xs text-cyan-400">⚡Auto-Route</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Test Send button */}
                    <button onClick={() => setTestModal({ api: a, number: '', message: 'Test from MMS Sender' })} className="flex items-center gap-1 bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs px-2.5 py-1 rounded-lg transition">
                      <Icon.Send /> Test
                    </button>
                    <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={a.autoRoute} onChange={async (e) => { await api('setAutoRoute', { id: a._id, type: 'sender', autoRoute: e.target.checked }); load(); }} />Auto</label>
                    <button onClick={async () => { if (confirm('Delete this API?')) { await api('deleteSenderApi', { id: a._id }); load(); } }} className="text-red-400 hover:text-red-300"><Icon.Trash /></button>
                  </div>
                </div>

                <ApiMetrics a={a} />

                {/* Usage bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Usage</span><span>{a.used}/{a.limit}</span></div>
                  <ProgressBar percent={a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0} />
                </div>

                {a.lastError && <p className="text-xs text-red-400/70 mt-2">⚠ Last error: {a.lastError}</p>}

                {/* Test result display */}
                {tr && (
                  <div className={`mt-2 text-xs rounded-lg p-2 ${tr.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {tr.success ? `✓ Test sent — Provider Msg ID: ${tr.providerMsgId || 'N/A'}` : `✗ Failed: ${tr.errorMessage || 'Unknown error'}${tr.errorCode ? ` (code ${tr.errorCode})` : ''}`}
                  </div>
                )}
              </div>
            );
          })}
          {senderApis.length === 0 && (
            <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm mb-2">No sender APIs configured.</p>
              <p className="text-gray-600 text-xs">Add a Twilio, Vonage, MessageBird, or custom HTTP sender to start sending real MMS/SMS.</p>
            </div>
          )}
        </div>
      </div>

      {/* Test Send Modal */}
      {testModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setTestModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Test Send — {testModal.api.name}</h3>
            <p className="text-xs text-gray-500">Provider: {(PROVIDER_TEMPLATES[testModal.api.provider] || {}).label || testModal.api.provider}</p>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Test number (E.164, e.g. +1234567890)" value={testModal.number} onChange={e => setTestModal({ ...testModal, number: e.target.value })} />
            <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-20" placeholder="Test message" value={testModal.message} onChange={e => setTestModal({ ...testModal, message: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={runTest} disabled={testing === testModal.api._id || !testModal.number} className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                {testing === testModal.api._id ? 'Sending…' : <><Icon.Send /> Send Test</>}
              </button>
              <button onClick={() => setTestModal(null)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini APIs */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Gemini AI APIs <span className="text-sm text-gray-500">({geminiApis.length}/10)</span></h3>
          {geminiApis.length < 10 && <button onClick={() => setShowGeminiForm(!showGeminiForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Gemini API</button>}
        </div>
        {showGeminiForm && (
          <form onSubmit={addGemini} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name" value={geminiForm.name} onChange={e => setGeminiForm({...geminiForm, name: e.target.value})} required />
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Gemini API Key" value={geminiForm.apiKey} onChange={e => setGeminiForm({...geminiForm, apiKey: e.target.value})} required />
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Model" value={geminiForm.model} onChange={e => setGeminiForm({...geminiForm, model: e.target.value})} />
            <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Daily Limit" value={geminiForm.limit} onChange={e => setGeminiForm({...geminiForm, limit: parseInt(e.target.value)})} />
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Save Gemini API</button>
          </form>
        )}
        <div className="space-y-2">
          {geminiApis.map(a => (
            <div key={a._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-white">{a.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{a.model}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900/40 text-green-400' : a.status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>{a.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={a.autoRoute} onChange={async (e) => { await api('setAutoRoute', { id: a._id, type: 'gemini', autoRoute: e.target.checked }); load(); }} />Auto-Route</label>
                  <button onClick={async () => { if (confirm('Delete?')) { await api('deleteGeminiApi', { id: a._id }); load(); } }} className="text-red-400 hover:text-red-300"><Icon.Trash /></button>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-2"><span>Used: {a.used}/{a.limit}</span><span>Remaining: {a.remaining}</span><span>Health: {a.healthScore}%</span></div>
              <div className="mt-2"><ProgressBar percent={a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0} /></div>
            </div>
          ))}
          {geminiApis.length === 0 && <p className="text-gray-600 text-sm py-4 text-center">No Gemini APIs. Add one for AI spam filtering & chat support.</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// USER MANAGEMENT TAB
// ============================================================================
function UserManagementTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', sendingLimit: 100, expiryDays: 30 });

  const load = async () => { setLoading(true); const data = await api('getUsers'); if (data.success) setUsers(data.users); setLoading(false); };
  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    const data = await api('createUser', form);
    if (data.success) { setShowForm(false); setForm({ email: '', password: '', sendingLimit: 100, expiryDays: 30 }); load(); }
    else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Create User</button>
      </div>
      {showForm && (
        <form onSubmit={createUser} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Send Limit" value={form.sendingLimit} onChange={e => setForm({...form, sendingLimit: parseInt(e.target.value)})} />
          <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Expiry (days)" value={form.expiryDays} onChange={e => setForm({...form, expiryDays: parseInt(e.target.value)})} />
          <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Create</button>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-xs uppercase border-b border-slate-800">
            <th className="text-left p-2">Email</th><th className="text-left p-2">Status</th><th className="text-left p-2">Limit</th><th className="text-left p-2">Sent</th><th className="text-left p-2">Expiry</th><th className="text-left p-2">IP</th><th className="text-left p-2">Last Active</th><th className="text-left p-2">Last Send</th><th className="text-left p-2">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                <td className="p-2 text-white">{u.email}</td>
                <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{u.isOnline ? 'Online' : u.status}</span></td>
                <td className="p-2 text-gray-400">{u.sendingLimit}</td>
                <td className="p-2 text-gray-400">{u.sentCount}</td>
                <td className="p-2 text-gray-400">{u.expiryDaysLeft != null ? `${u.expiryDaysLeft}d left` : 'No expiry'}</td>
                <td className="p-2 text-gray-500 text-xs">{u.ipAddress || '-'}</td>
                <td className="p-2 text-gray-500 text-xs">{u.lastActiveAgo}</td>
                <td className="p-2 text-gray-500 text-xs">{u.lastSendAgo}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <input type="number" placeholder="Limit" className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white text-xs" defaultValue={u.sendingLimit} onBlur={async (e) => { await api('updateUserLimit', { userId: u._id, limit: parseInt(e.target.value) }); }} />
                    <input type="number" placeholder="Days" className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white text-xs" onBlur={async (e) => { if (e.target.value) { await api('updateUserExpiry', { userId: u._id, expiryDays: parseInt(e.target.value) }); load(); } }} />
                    {u.status === 'active' ? <button onClick={async () => { await api('suspendUser', { userId: u._id }); load(); }} className="text-yellow-400 text-xs px-2">Block</button> : <button onClick={async () => { await api('activateUser', { userId: u._id }); load(); }} className="text-green-400 text-xs px-2">Unblock</button>}
                    <button onClick={async () => { if (confirm('Delete user?')) { await api('deleteUser', { userId: u._id }); load(); } }} className="text-red-400"><Icon.Trash /></button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="9" className="text-center text-gray-600 py-8">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// CAMPAIGNS TAB
// ============================================================================
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const data = await api('getCampaigns'); if (data.success) setCampaigns(data.campaigns); setLoading(false); };
  useEffect(() => { load(); }, []);
  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Campaigns</h2>
      <div className="space-y-2">
        {campaigns.map(c => (
          <div key={c._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{c.userEmail}</p>
                <p className="text-xs text-gray-500 mt-1">{c.message?.substring(0, 80)}...</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-2">
                  <span>Sent: {c.totalSent}</span><span>Delivered: {c.totalDelivered}</span><span>Undelivered: {c.totalUndelivered}</span><span>Invalid: {c.totalInvalid}</span><span>Inbox: {c.totalInbox}</span><span>Spam: {c.totalSpam}</span><span>API: {c.senderApiName || '-'}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'sent' ? 'bg-green-900/40 text-green-400' : c.status === 'running' ? 'bg-blue-900/40 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>{c.status}</span>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No campaigns yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// CONTENT & TEMPLATES TAB
// ============================================================================
function ContentTab() {
  const [templates, setTemplates] = useState([]);
  const [content, setContent] = useState([]);
  const [showTplForm, setShowTplForm] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', type: 'custom', content: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [t, c] = await Promise.all([api('getTemplates'), api('getContent')]);
    if (t.success) setTemplates(t.templates);
    if (c.success) setContent(c.assets);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addTpl = async (e) => {
    e.preventDefault();
    const data = await api('addTemplate', tplForm);
    if (data.success) { setShowTplForm(false); setTplForm({ name: '', type: 'custom', content: '' }); load(); }
    else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Content & Templates</h2>

      {/* Templates */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Message Templates</h3>
          <button onClick={() => setShowTplForm(!showTplForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Template</button>
        </div>
        {showTplForm && (
          <form onSubmit={addTpl} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Template Name" value={tplForm.name} onChange={e => setTplForm({...tplForm, name: e.target.value})} required />
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={tplForm.type} onChange={e => setTplForm({...tplForm, type: e.target.value})}>
                <option value="payment">Payment</option><option value="marketing">Marketing</option><option value="promo">Promo</option><option value="order">Order</option><option value="crypto">Crypto</option><option value="custom">Custom</option>
              </select>
            </div>
            <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" rows="4" placeholder="Message content. Use {name}, {amount} for variables." value={tplForm.content} onChange={e => setTplForm({...tplForm, content: e.target.value})} required />
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Save Template</button>
          </form>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => (
            <div key={t._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-white">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{t.type}</span>
                  <button onClick={async () => { await api('deleteTemplate', { id: t._id }); load(); }} className="text-red-400"><Icon.Trash /></button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t.content.substring(0, 100)}</p>
            </div>
          ))}
          {templates.length === 0 && <p className="text-gray-600 text-sm col-span-full text-center py-4">No templates yet.</p>}
        </div>
      </div>

      {/* Content Assets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Content Assets (Logos, Photos)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {content.map(c => (
            <div key={c._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
              {c.url && <img src={c.url} alt={c.name} className="w-full h-24 object-cover rounded mb-2" />}
              <p className="text-xs text-white">{c.name}</p>
              <p className="text-xs text-gray-500">{c.type} - {c.purpose}</p>
              <button onClick={async () => { await api('deleteContent', { id: c._id }); load(); }} className="text-red-400 mt-2"><Icon.Trash /></button>
            </div>
          ))}
          {content.length === 0 && <p className="text-gray-600 text-sm col-span-full text-center py-4">No content assets yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-ADMIN TAB
// ============================================================================
function SubAdminTab() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', permissions: ['dashboard'] });

  const allPerms = ['dashboard', 'apis', 'users', 'campaigns', 'content', 'database', 'blacklist', 'alerts', 'logs', 'settings'];

  const load = async () => { setLoading(true); const data = await api('getSubAdmins'); if (data.success) setSubs(data.subAdmins); setLoading(false); };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const data = await api('createSubAdmin', form);
    if (data.success) { setShowForm(false); setForm({ username: '', password: '', permissions: ['dashboard'] }); load(); }
    else alert(data.error);
  };

  const togglePerm = (perm) => {
    setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Sub-Admins</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Create Sub-Admin</button>
      </div>
      {showForm && (
        <form onSubmit={create} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Permissions (access control):</p>
            <div className="flex flex-wrap gap-2">
              {allPerms.map(p => (
                <label key={p} className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg cursor-pointer border ${form.permissions.includes(p) ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-slate-800 border-slate-700 text-gray-500'}`}>
                  <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} className="hidden" />{p}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Create Sub-Admin</button>
        </form>
      )}
      <div className="space-y-2">
        {subs.map(s => (
          <div key={s._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm text-white font-medium">{s.username}</p>
              <p className="text-xs text-gray-500">Permissions: {s.permissions?.join(', ')}</p>
            </div>
            <button onClick={async () => { if (confirm('Delete sub-admin?')) { await api('deleteSubAdmin', { id: s._id }); load(); } }} className="text-red-400"><Icon.Trash /></button>
          </div>
        ))}
        {subs.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No sub-admins yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// DATABASE TAB
// ============================================================================
function DatabaseTab() {
  const [conns, setConns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', uri: '', storageLimit: 512 });

  const load = async () => { setLoading(true); const data = await api('getMongoConnections'); if (data.success) setConns(data.connections); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const data = await api('addMongoConnection', form);
    if (data.success) { setShowForm(false); setForm({ label: '', uri: '', storageLimit: 512 }); load(); }
    else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Database Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Database</button>
      </div>
      {showForm && (
        <form onSubmit={add} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Label (e.g., Primary DB)" value={form.label} onChange={e => setForm({...form, label: e.target.value})} required />
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="MongoDB URI" value={form.uri} onChange={e => setForm({...form, uri: e.target.value})} required />
          <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Storage Limit (MB)" value={form.storageLimit} onChange={e => setForm({...form, storageLimit: parseInt(e.target.value)})} />
          <button type="submit" className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Add</button>
        </form>
      )}
      <div className="space-y-2">
        {conns.map(c => (
          <div key={c._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm text-white font-medium">{c.label} {c.isActive && <span className="text-xs text-green-400">(Active)</span>}</p>
              <p className="text-xs text-gray-500">{c.storageUsed}MB / {c.storageLimit}MB</p>
            </div>
            <div className="flex gap-2">
              {!c.isActive && <button onClick={async () => { await api('setActiveMongo', { id: c._id }); load(); }} className="text-green-400 text-xs px-2">Set Active</button>}
              <button onClick={async () => { await api('deleteMongoConnection', { id: c._id }); load(); }} className="text-red-400"><Icon.Trash /></button>
            </div>
          </div>
        ))}
        {conns.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">Using default ENV MongoDB connection.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// BLACKLIST TAB
// ============================================================================
function BlacklistTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [number, setNumber] = useState('');
  const [reason, setReason] = useState('spam');

  const load = async () => { setLoading(true); const data = await api('getBlacklist'); if (data.success) setList(data.blacklist); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const data = await api('addBlacklist', { number, reason });
    if (data.success) { setNumber(''); load(); } else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Blacklist</h2>
      <form onSubmit={add} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex gap-3">
        <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Phone number" value={number} onChange={e => setNumber(e.target.value)} required />
        <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm w-40" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">Add</button>
      </form>
      <div className="space-y-2">
        {list.map(b => (
          <div key={b._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
            <div><span className="text-sm text-white">{b.number}</span><span className="text-xs text-gray-500 ml-2">{b.reason}</span></div>
            <button onClick={async () => { await api('removeBlacklist', { id: b._id }); load(); }} className="text-red-400"><Icon.Trash /></button>
          </div>
        ))}
        {list.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No blacklisted numbers.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// ALERTS TAB
// ============================================================================
function AlertsTab() {
  const [settings, setSettings] = useState({ alertWhatsapp: '', alertEmail: '', alertOnCrash: true, alertOnApiDown: true, alertOnError: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { const data = await api('getAppSettings'); if (data.success) setSettings(data.settings); setLoading(false); })();
  }, []);

  const save = async () => {
    const data = await api('setAlertConfig', settings);
    if (data.success) alert('Alert settings saved'); else alert(data.error);
  };

  const testAlert = async () => {
    const data = await api('testAlert');
    if (data.success) alert('Test alert sent'); else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Alerts & Notifications</h2>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 max-w-lg">
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">WhatsApp Number (for alerts)</label>
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="+1234567890" value={settings.alertWhatsapp} onChange={e => setSettings({...settings, alertWhatsapp: e.target.value})} />
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Email (for alerts)</label>
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="admin@example.com" value={settings.alertEmail} onChange={e => setSettings({...settings, alertEmail: e.target.value})} />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={settings.alertOnCrash} onChange={e => setSettings({...settings, alertOnCrash: e.target.checked})} />Alert on server crash</label>
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={settings.alertOnApiDown} onChange={e => setSettings({...settings, alertOnApiDown: e.target.checked})} />Alert when API goes down</label>
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={settings.alertOnError} onChange={e => setSettings({...settings, alertOnError: e.target.checked})} />Alert on errors/bugs</label>
        </div>
        <div className="flex gap-3">
          <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">Save Settings</button>
          <button onClick={testAlert} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">Send Test Alert</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOGS TAB
// ============================================================================
function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { const data = await api('getActivityLogs', { limit: 200 }); if (data.success) setLogs(data.logs); setLoading(false); })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {logs.map((l, i) => (
          <div key={i} className="bg-slate-900/30 border border-slate-800/50 rounded-lg px-3 py-2 text-sm flex gap-3">
            <span className="text-gray-600 text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</span>
            <span className={`text-xs px-1.5 rounded ${l.actorType === 'admin' ? 'bg-blue-900/40 text-blue-400' : l.actorType === 'user' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>{l.actorType}</span>
            <span className="text-gray-300 flex-1">{l.action}: <span className="text-gray-500">{l.details}</span></span>
            {l.ipAddress && <span className="text-gray-600 text-xs">{l.ipAddress}</span>}
          </div>
        ))}
        {logs.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No activity logs yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// SECURITY TAB (admin credential management with mail verification)
// ============================================================================
function SecurityTab({ user }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => { setLoading(true); const data = await api('getAdminCredentials'); if (data.success) setInfo(data.credentials); setLoading(false); };
  useEffect(() => { load(); }, []);

  const doAction = async (action, data) => {
    const res = await api(action, { ...data, verificationCode });
    if (res.needVerification) {
      setPendingAction(action);
      setMessage(`Verification code sent to ${info?.email || 'admin email'}. Code: ${res.code || '(check console)'}`);
    } else if (res.success) {
      setMessage(`${action} completed successfully!`);
      setVerificationCode(''); setPendingAction(null);
      if (action === 'updateAdminApiKey') setMessage(`New API Key: ${res.apiKey}`);
      load();
    } else {
      setMessage(res.error || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Admin Security</h2>
      {info && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 max-w-lg">
          <div className="space-y-2 text-sm">
            <p className="text-gray-400">Current Username: <span className="text-white font-mono">{info.username}</span></p>
            <p className="text-gray-400">API Key: <span className="text-white font-mono">{info.apiKeyMasked}</span></p>
            <p className="text-gray-400">Email: <span className="text-white">{info.email || 'Not set (add email to enable verification)'}</span></p>
          </div>
        </div>
      )}
      {message && <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg px-4 py-2 text-sm text-blue-300">{message}</div>}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 max-w-lg">
        {pendingAction && (
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Verification Code</label>
            <div className="flex gap-2">
              <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="6-digit code" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} />
              <button onClick={() => doAction(pendingAction, pendingAction === 'updateAdminUsername' ? { newUsername } : pendingAction === 'updateAdminPassword' ? { newPassword } : {})} className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">Verify & Confirm</button>
            </div>
          </div>
        )}
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Change Username</label>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="New username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            <button onClick={() => doAction('updateAdminUsername', { newUsername })} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">Change</button>
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Change Password</label>
          <div className="flex gap-2">
            <input type="password" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="New password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button onClick={() => doAction('updateAdminPassword', { newPassword })} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">Change</button>
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Regenerate API Key</label>
          <button onClick={() => doAction('updateAdminApiKey', {})} className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg transition">Generate New API Key</button>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Set Admin Email (for verification)</label>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="admin@example.com" defaultValue={info?.email} onBlur={async (e) => { await api('updateAdminEmail', { email: e.target.value }); load(); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB
// ============================================================================
function SettingsTab() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { const data = await api('getAppSettings'); if (data.success) setSettings(data.settings); setLoading(false); })();
  }, []);

  const save = async () => {
    const data = await api('updateAppSettings', { settings });
    if (data.success) alert('Settings saved'); else alert(data.error);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 max-w-2xl">
        <h3 className="text-lg font-semibold text-gray-300">Primary Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Platform Name</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.platformName || ''} onChange={e => setSettings({...settings, platformName: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Logo URL</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.logoUrl || ''} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Description</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.description || ''} onChange={e => setSettings({...settings, description: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">WhatsApp Number</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.whatsapp || ''} onChange={e => setSettings({...settings, whatsapp: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Email</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.email || ''} onChange={e => setSettings({...settings, email: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Language</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.language || 'en'} onChange={e => setSettings({...settings, language: e.target.value})}>
              <option value="en">English</option><option value="bn">Bengali</option>
            </select>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 pt-4">MMS Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Default User Limit</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.defaultUserLimit || 100} onChange={e => setSettings({...settings, defaultUserLimit: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Default User Expiry (days)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.defaultUserExpiryDays || 30} onChange={e => setSettings({...settings, defaultUserExpiryDays: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Rate Limit (per minute)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.rateLimitPerMinute || 10} onChange={e => setSettings({...settings, rateLimitPerMinute: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Rate Limit (per hour)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.rateLimitPerHour || 100} onChange={e => setSettings({...settings, rateLimitPerHour: parseInt(e.target.value)})} />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 pt-4">Spam Protection</h3>
        <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={settings.spamProtection !== false} onChange={e => setSettings({...settings, spamProtection: e.target.checked})} />Enable spam protection (invalid numbers won't send)</label>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Country Rules (JSON)</label>
          <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" rows="3" placeholder='{"BD": "allow", "US": "allow"}' value={settings.countryRules || ''} onChange={e => setSettings({...settings, countryRules: e.target.value})} />
        </div>
        <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-6 py-2.5 rounded-lg transition font-semibold">Save All Settings</button>
      </div>
    </div>
  );
}
