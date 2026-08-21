'use client';

import { useState, useEffect } from 'react';

export default function AdminPanel({ mode, user, onLoginSuccess, onLogout }) {
  // ===== LOGIN MODE =====
  if (mode === 'login') {
    return <AdminLogin onLoginSuccess={onLoginSuccess} />;
  }

  // ===== PANEL MODE =====
  return <AdminDashboard user={user} onLogout={onLogout} />;
}

// ================================================================
// ADMIN LOGIN — 3-layer security (username + password + API key)
// Blue/slate professional theme + password eye toggle
// ================================================================
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
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'adminLogin', username, password, apiKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({ role: 'admin', username: data.username });
      } else if (data.firstSetup) {
        // First time — credentials were auto-generated, show them
        setFirstSetupCreds(data.credentials);
        setError(data.message);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Admin Control
          </h1>
          <p className="text-gray-500 text-sm mt-1">Master Configuration Hub</p>
        </div>

        {/* First setup credentials display */}
        {firstSetupCreds && (
          <div className="mb-4 p-4 bg-blue-900/40 border border-blue-700/50 rounded-xl">
            <p className="text-blue-200 text-sm font-semibold mb-2">🔔 First Time Setup — Save These Credentials:</p>
            <div className="space-y-1 text-xs text-gray-300 font-mono">
              <p>Username: <span className="text-cyan-300">{firstSetupCreds.username}</span></p>
              <p>Password: <span className="text-cyan-300">{firstSetupCreds.password}</span></p>
              <p>API Key: <span className="text-cyan-300 break-all">{firstSetupCreds.apiKey}</span></p>
            </div>
            <p className="text-xs text-gray-400 mt-2">Now enter these below to login:</p>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Admin Username</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  placeholder="sk_••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showApiKey ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && !firstSetupCreds && (
              <div className="p-3 bg-red-900/40 border border-red-700/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-semibold transition shadow-lg shadow-blue-500/20 text-sm"
            >
              {loading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-xs text-gray-500">3-layer authentication: Username + Password + API Key</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// ADMIN DASHBOARD — full management hub
// ================================================================
function AdminDashboard({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [configStatus, setConfigStatus] = useState({ MONGODB_URI: false, GEMINI_API_KEY: false, SMS_API_KEY: false });
  const [configs, setConfigs] = useState({ MONGODB_URI: '', GEMINI_API_KEY: '', SMS_API_KEY: '' });
  const [mongoConnections, setMongoConnections] = useState([]);
  const [adminCreds, setAdminCreds] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});
  const [showSection, setShowSection] = useState('overview'); // overview | configs | mongo | users | campaigns | credentials
  const [newMongoLabel, setNewMongoLabel] = useState('');
  const [newMongoUri, setNewMongoUri] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserLimit, setNewUserLimit] = useState('100');
  // Credential change states
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credApiKeyDisplay, setCredApiKeyDisplay] = useState('');

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const apiCall = async (data) => {
    const res = await fetch('/api/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  };

  useEffect(() => {
    const loadData = async () => {
      const [u, c, s, m, ac] = await Promise.all([
        apiCall({ action: 'getUsers' }),
        apiCall({ action: 'getCampaigns' }),
        apiCall({ action: 'getConfigStatus' }),
        apiCall({ action: 'getMongoConnections' }),
        apiCall({ action: 'getAdminCredentials' }),
      ]);
      if (u.users) setUsers(u.users);
      if (c.campaigns) setCampaigns(c.campaigns);
      if (s.status) setConfigStatus(s.status);
      if (m.connections) setMongoConnections(m.connections);
      if (ac.credentials) {
        setAdminCreds(ac.credentials);
        setCredUsername(ac.credentials.username);
      }
    };
    loadData();
  }, []);

  const saveConfig = async (keyName) => {
    setLoading({ ...loading, [keyName]: true });
    const res = await apiCall({ action: 'saveConfig', keyName, keyValue: configs[keyName] });
    setLoading({ ...loading, [keyName]: false });
    if (res.success) {
      showToast('success', res.message);
      setConfigStatus({ ...configStatus, [keyName]: true });
    } else {
      showToast('error', res.error || 'Failed to save');
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      showToast('error', 'Email and password required');
      return;
    }
    const res = await apiCall({
      action: 'createUser',
      email: newUserEmail,
      password: newUserPassword,
      sendingLimit: parseInt(newUserLimit) || 100,
    });
    if (res.success) {
      showToast('success', 'User created!');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserLimit('100');
      const u = await apiCall({ action: 'getUsers' });
      if (u.users) setUsers(u.users);
    } else {
      showToast('error', res.error || 'Failed');
    }
  };

  const updateUserLimit = async (email, limit) => {
    const res = await apiCall({ action: 'updateUserLimit', email, limit: parseInt(limit) });
    if (res.success) showToast('success', 'Limit updated');
    else showToast('error', res.error);
  };

  const suspendUser = async (email) => {
    const res = await apiCall({ action: 'suspendUser', email });
    if (res.success) {
      showToast('success', 'User suspended');
      const u = await apiCall({ action: 'getUsers' });
      if (u.users) setUsers(u.users);
    }
  };

  const activateUser = async (email) => {
    const res = await apiCall({ action: 'activateUser', email });
    if (res.success) {
      showToast('success', 'User activated');
      const u = await apiCall({ action: 'getUsers' });
      if (u.users) setUsers(u.users);
    }
  };

  const deleteUser = async (email) => {
    if (!confirm(`Delete user ${email}?`)) return;
    const res = await apiCall({ action: 'deleteUser', email });
    if (res.success) {
      showToast('success', 'User deleted');
      const u = await apiCall({ action: 'getUsers' });
      if (u.users) setUsers(u.users);
    }
  };

  const addMongoConnection = async () => {
    if (!newMongoLabel || !newMongoUri) {
      showToast('error', 'Label and URI required');
      return;
    }
    const res = await apiCall({ action: 'addMongoConnection', label: newMongoLabel, uri: newMongoUri });
    if (res.success) {
      showToast('success', res.message);
      setNewMongoLabel('');
      setNewMongoUri('');
      const m = await apiCall({ action: 'getMongoConnections' });
      if (m.connections) setMongoConnections(m.connections);
    } else {
      showToast('error', res.error || 'Failed');
    }
  };

  const deleteMongoConnection = async (id) => {
    const res = await apiCall({ action: 'deleteMongoConnection', connectionId: id });
    if (res.success) {
      showToast('success', 'Connection deleted');
      const m = await apiCall({ action: 'getMongoConnections' });
      if (m.connections) setMongoConnections(m.connections);
    }
  };

  const setActiveMongo = async (id) => {
    const res = await apiCall({ action: 'setActiveMongo', connectionId: id });
    if (res.success) {
      showToast('success', res.message);
      const m = await apiCall({ action: 'getMongoConnections' });
      if (m.connections) setMongoConnections(m.connections);
    } else {
      showToast('error', res.error);
    }
  };

  // Admin credential changes
  const changeUsername = async () => {
    if (!credUsername || credUsername.trim().length < 3) {
      showToast('error', 'Username must be 3+ chars');
      return;
    }
    const res = await apiCall({ action: 'updateAdminUsername', newUsername: credUsername.trim() });
    if (res.success) showToast('success', 'Username updated!');
    else showToast('error', res.error);
  };

  const changePassword = async () => {
    if (!credPassword || credPassword.length < 8) {
      showToast('error', 'Password must be 8+ chars');
      return;
    }
    const res = await apiCall({ action: 'updateAdminPassword', newPassword: credPassword });
    if (res.success) {
      showToast('success', 'Password updated!');
      setCredPassword('');
    } else showToast('error', res.error);
  };

  const regenerateApiKey = async () => {
    if (!confirm('Generate new API key? The old one will stop working immediately.')) return;
    const res = await apiCall({ action: 'updateAdminApiKey' });
    if (res.success) {
      setCredApiKeyDisplay(res.apiKey);
      showToast('success', 'New API key generated! Save it now.');
    } else showToast('error', res.error);
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'configs', label: 'API Keys', icon: '🔑' },
    { id: 'mongo', label: 'MongoDB', icon: '🗄️' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'campaigns', label: 'Campaigns', icon: '📨' },
    { id: 'credentials', label: 'Admin Security', icon: '🛡️' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/50">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Master Configuration Hub
          </h1>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm transition"
          >
            Logout
          </button>
        </div>
        {/* Nav tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setShowSection(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                showSection === item.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* ===== OVERVIEW ===== */}
        {showSection === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={users.length} color="blue" />
            <StatCard label="Total Campaigns" value={campaigns.length} color="cyan" />
            <StatCard label="Gemini AI" value={configStatus.GEMINI_API_KEY ? 'Active' : 'Not Set'} color={configStatus.GEMINI_API_KEY ? 'green' : 'red'} />
            <StatCard label="SMS Gateway" value={configStatus.SMS_API_KEY ? 'Active' : 'Not Set'} color={configStatus.SMS_API_KEY ? 'green' : 'red'} />
            <StatCard label="MongoDB" value={configStatus.MONGODB_URI ? 'Active' : 'Not Set'} color={configStatus.MONGODB_URI ? 'green' : 'red'} />
            <StatCard label="DB Connections" value={mongoConnections.length} color="blue" />
            <StatCard label="Sent Campaigns" value={campaigns.filter(c => c.status === 'sent').length} color="green" />
            <StatCard label="Blocked" value={campaigns.filter(c => c.status === 'blocked').length} color="red" />
          </div>
        )}

        {/* ===== API KEYS (CONFIGS) ===== */}
        {showSection === 'configs' && (
          <div className="space-y-4">
            <ConfigCard
              title="Gemini API Key"
              description="For AI spam filtering (gemini-1.5-flash)"
              placeholder="AIza..."
              value={configs.GEMINI_API_KEY}
              onChange={(v) => setConfigs({ ...configs, GEMINI_API_KEY: v })}
              onSave={() => saveConfig('GEMINI_API_KEY')}
              active={configStatus.GEMINI_API_KEY}
              loading={loading.GEMINI_API_KEY}
              hint="Get free key: https://aistudio.google.com/apikey"
            />
            <ConfigCard
              title="SMS Gateway API Key"
              description="For sending SMS via your gateway provider"
              placeholder="Enter SMS gateway API key..."
              value={configs.SMS_API_KEY}
              onChange={(v) => setConfigs({ ...configs, SMS_API_KEY: v })}
              onSave={() => saveConfig('SMS_API_KEY')}
              active={configStatus.SMS_API_KEY}
              loading={loading.SMS_API_KEY}
            />
            <ConfigCard
              title="MongoDB URI"
              description="Primary database connection (backup/manual override)"
              placeholder="mongodb+srv://..."
              value={configs.MONGODB_URI}
              onChange={(v) => setConfigs({ ...configs, MONGODB_URI: v })}
              onSave={() => saveConfig('MONGODB_URI')}
              active={configStatus.MONGODB_URI}
              loading={loading.MONGODB_URI}
            />
          </div>
        )}

        {/* ===== MONGODB CONNECTIONS ===== */}
        {showSection === 'mongo' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
              <h2 className="text-lg font-semibold text-gray-200 mb-4">Add New MongoDB Connection</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newMongoLabel}
                  onChange={(e) => setNewMongoLabel(e.target.value)}
                  placeholder="Label (e.g. Account 2, Secondary DB)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="text"
                  value={newMongoUri}
                  onChange={(e) => setNewMongoUri(e.target.value)}
                  placeholder="mongodb+srv://username:password@cluster..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
                <button
                  onClick={addMongoConnection}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Add Connection
                </button>
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
              <h2 className="text-lg font-semibold text-gray-200 mb-4">Active Connections</h2>
              {mongoConnections.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No connections added yet</p>
              ) : (
                <div className="space-y-2">
                  {mongoConnections.map((c) => (
                    <div key={c._id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-200 text-sm font-medium">{c.label}</span>
                          {c.isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 font-medium">Active</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-1">{c.uriMasked}</p>
                      </div>
                      <div className="flex gap-2">
                        {!c.isActive && (
                          <button
                            onClick={() => setActiveMongo(c._id)}
                            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => deleteMongoConnection(c._id)}
                          className="px-3 py-1.5 bg-red-700/80 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== USERS ===== */}
        {showSection === 'users' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
              <h2 className="text-lg font-semibold text-gray-200 mb-4">Create New User</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="number"
                  value={newUserLimit}
                  onChange={(e) => setNewUserLimit(e.target.value)}
                  placeholder="SMS Limit"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button
                onClick={createUser}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
              >
                Create User
              </button>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
              <h2 className="text-lg font-semibold text-gray-200 mb-4">All Users ({users.length})</h2>
              {users.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No users yet. Create one above.</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u._id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-200 text-sm font-medium">{u.email}</span>
                          {u.status === 'suspended' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300">Suspended</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{u.sentCount} / {u.sendingLimit} SMS sent</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <input
                          type="number"
                          defaultValue={u.sendingLimit}
                          onBlur={(e) => updateUserLimit(u.email, e.target.value)}
                          className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-gray-100 text-xs"
                          title="SMS Limit"
                        />
                        {u.status === 'active' ? (
                          <button onClick={() => suspendUser(u.email)} className="px-2 py-1.5 bg-yellow-700/80 hover:bg-yellow-600 text-white rounded-lg text-xs transition">Suspend</button>
                        ) : (
                          <button onClick={() => activateUser(u.email)} className="px-2 py-1.5 bg-green-700/80 hover:bg-green-600 text-white rounded-lg text-xs transition">Activate</button>
                        )}
                        <button onClick={() => deleteUser(u.email)} className="px-2 py-1.5 bg-red-700/80 hover:bg-red-600 text-white rounded-lg text-xs transition">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== CAMPAIGNS ===== */}
        {showSection === 'campaigns' && (
          <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">All Campaigns ({campaigns.length})</h2>
            {campaigns.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No campaigns sent yet</p>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <div key={c._id} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'sent' ? 'bg-green-900/50 text-green-300' :
                          c.status === 'blocked' ? 'bg-red-900/50 text-red-300' :
                          'bg-yellow-900/50 text-yellow-300'
                        }`}>{c.status.toUpperCase()}</span>
                        <span className="text-xs text-gray-400">{c.userEmail}</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">{c.message}</p>
                    <p className="text-xs text-gray-500">{c.numbers?.length || 0} recipients • AI: {c.aiVerdict}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ADMIN CREDENTIALS (SECURITY) ===== */}
        {showSection === 'credentials' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
              <h2 className="text-lg font-semibold text-gray-200 mb-1">Admin Security Settings</h2>
              <p className="text-sm text-gray-500 mb-5">Change your admin login credentials. All three are required to login.</p>

              {/* Current credentials display */}
              {adminCreds && (
                <div className="mb-5 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
                  <p className="text-xs text-gray-500 mb-2">Current Credentials:</p>
                  <div className="space-y-1 text-sm font-mono">
                    <p className="text-gray-300">Username: <span className="text-cyan-300">{adminCreds.username}</span></p>
                    <p className="text-gray-300">API Key: <span className="text-cyan-300">{adminCreds.apiKeyMasked}</span></p>
                    <p className="text-gray-300">Password: <span className="text-cyan-300">•••••••• (hidden)</span></p>
                  </div>
                </div>
              )}

              {/* Change Username */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Change Username</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={credUsername}
                      onChange={(e) => setCredUsername(e.target.value)}
                      placeholder="New username (min 3 chars)"
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      onClick={changeUsername}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {/* Change Password */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Change Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      onClick={changePassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {/* Regenerate API Key */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Key</label>
                  <button
                    onClick={regenerateApiKey}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    🔄 Generate New API Key
                  </button>
                  {credApiKeyDisplay && (
                    <div className="mt-2 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                      <p className="text-xs text-amber-200 mb-1">⚠️ Save this new API key — it won't be shown again:</p>
                      <p className="text-sm text-cyan-300 font-mono break-all">{credApiKeyDisplay}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// Helper Components
// ================================================================
function StatCard({ label, value, color }) {
  const colors = {
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-800/30 text-blue-300',
    cyan: 'from-cyan-600/20 to-cyan-900/10 border-cyan-800/30 text-cyan-300',
    green: 'from-green-600/20 to-green-900/10 border-green-800/30 text-green-300',
    red: 'from-red-600/20 to-red-900/10 border-red-800/30 text-red-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color] || colors.blue} rounded-xl p-4 border`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ConfigCard({ title, description, placeholder, value, onChange, onSave, active, loading, hint }) {
  return (
    <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold text-gray-200">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          active ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-400'
        }`}>
          {active ? '✓ Active' : 'Not Set'}
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
        />
        <button
          onClick={onSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-600 mt-2">{hint}</p>}
    </div>
  );
}
