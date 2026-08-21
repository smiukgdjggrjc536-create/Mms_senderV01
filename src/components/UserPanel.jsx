'use client';

import { useState, useEffect, useRef } from 'react';

export default function UserPanel({ mode, user, onLoginSuccess, onLogout }) {
  // ===== LOGIN MODE =====
  if (mode === 'login') {
    return <UserLogin onLoginSuccess={onLoginSuccess} />;
  }

  // ===== PANEL MODE =====
  return <UserDashboard user={user} onLogout={onLogout} />;
}

// ================================================================
// USER LOGIN — purple/indigo professional theme + password eye
// ================================================================
function UserLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-4 shadow-lg shadow-purple-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            SMS Campaign
          </h1>
          <p className="text-gray-500 text-sm mt-1">User Portal</p>
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
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
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
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
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

            {error && (
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
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-semibold transition shadow-lg shadow-purple-500/20 text-sm"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-gray-600 text-center mt-5">
            {isRegister
              ? 'New users get 100 SMS/month by default'
              : 'Don\'t have an account? Click Register'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// USER DASHBOARD — SMS sending + quota + history
// ================================================================
function UserDashboard({ user, onLogout }) {
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [limit, setLimit] = useState(user?.limit || 0);
  const [sent, setSent] = useState(user?.sent || 0);
  const [status, setStatus] = useState(user?.status || 'active');
  const toastTimer = useRef(null);

  const showToast = (msg, type) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'getUserCampaigns' }),
      });
      const data = await res.json();
      if (data.campaigns) {
        setCampaigns(data.campaigns);
        setLimit(data.limit);
        setSent(data.sent);
        setStatus(data.status);
      }
    } catch {}
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !numbers.trim()) {
      showToast('Please enter message and numbers', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign',
          email: user.email,
          message,
          numbers,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Campaign sent successfully!', 'success');
        setMessage('');
        setNumbers('');
        fetchCampaigns();
      } else {
        showToast(data.error || 'Failed to send', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  const usagePercent = limit > 0 ? Math.min((sent / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - sent, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-900 p-4 sm:p-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              SMS Campaign Sender
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Logged in as <span className="text-purple-300">{user.email}</span>
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>

        {status !== 'active' && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-200 text-sm">
            Your account is suspended. Contact the administrator.
          </div>
        )}

        {/* Quota card */}
        <div className="bg-gray-900/80 backdrop-blur rounded-xl p-5 mb-6 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Sending Quota</h2>
            <span className="text-sm text-gray-400">{sent} / {limit} sent</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{remaining} remaining</span>
            <span>{usagePercent.toFixed(0)}% used</span>
          </div>
        </div>

        {/* Campaign form */}
        <div className="bg-gray-900/80 backdrop-blur rounded-xl p-5 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Send New Campaign</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your SMS message here..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{message.length}/500</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Recipient Numbers <span className="text-gray-600">(comma separated)</span>
              </label>
              <input
                type="text"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                placeholder="+1234567890, +9876543210, ..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading || status !== 'active'}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-semibold transition text-sm"
            >
              {loading ? 'Processing...' : 'Send Campaign'}
            </button>
          </form>
        </div>

        {/* Campaign history */}
        <div className="bg-gray-900/80 backdrop-blur rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Campaign History</h2>
          {campaigns.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No campaigns yet</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c._id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'sent' ? 'bg-green-900/50 text-green-300' :
                      c.status === 'blocked' ? 'bg-red-900/50 text-red-300' :
                      'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">{c.message}</p>
                  <p className="text-xs text-gray-500">{c.numbers?.length || 0} recipients</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
