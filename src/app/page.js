'use client';

import { useState, useEffect } from 'react';
import AdminPanel from '@/components/AdminPanel';
import UserPanel from '@/components/UserPanel';

export default function Home() {
  const [view, setView] = useState('loading'); // loading | login | admin | user
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'getUserCampaigns' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser({
          email: data.email,
          role: data.role,
          limit: data.limit,
          sent: data.sent,
        });
        setView(data.role === 'admin' ? 'admin' : 'user');
      } else {
        setView('login');
      }
    } catch {
      setView('login');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser({
          email: data.email,
          role: data.role,
          limit: data.limit,
          sent: data.sent,
        });
        setView(data.role === 'admin' ? 'admin' : 'user');
        setEmail('');
        setPassword('');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    // Clear cookie by letting browser expire it — simplest approach
    document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    setView('login');
  };

  // Loading screen
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Login screen
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              SMS Campaign System
            </h1>
            <p className="text-gray-500 text-sm mt-2">Sign in to continue</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4"
          >
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-xs text-gray-600 text-center">
              First login creates the admin account
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Admin panel
  if (view === 'admin') {
    return (
      <main>
        <AdminPanel user={user} onLogout={handleLogout} />
      </main>
    );
  }

  // User panel
  if (view === 'user') {
    return (
      <main>
        <UserPanel user={user} onLogout={handleLogout} />
      </main>
    );
  }

  return null;
}
