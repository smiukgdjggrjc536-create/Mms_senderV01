'use client';

import { useState, useEffect } from 'react';
import AdminPanel from '@/components/AdminPanel';
import UserPanel from '@/components/UserPanel';

// NEXT_PUBLIC_PANEL_MODE is set at build time:
//   "admin" → Netlify shows Admin Panel only
//   "user"  → Vercel shows User Panel only
const PANEL_MODE = process.env.NEXT_PUBLIC_PANEL_MODE || 'user';

export default function Home() {
  const [view, setView] = useState('loading'); // loading | login | panel
  const [user, setUser] = useState(null);

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
        body: JSON.stringify({ action: 'checkSession' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView('panel');
      } else {
        setView('login');
      }
    } catch {
      setView('login');
    }
  };

  const handleLoginSuccess = (data) => {
    setUser(data);
    setView('panel');
  };

  const handleLogout = () => {
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

  // Login screen — pass panel mode so the right login form shows
  if (view === 'login') {
    return (
      <main>
        {PANEL_MODE === 'admin' ? (
          <AdminPanel mode="login" onLoginSuccess={handleLoginSuccess} />
        ) : (
          <UserPanel mode="login" onLoginSuccess={handleLoginSuccess} />
        )}
      </main>
    );
  }

  // Panel screen — show the right panel
  if (view === 'panel') {
    return (
      <main>
        {PANEL_MODE === 'admin' ? (
          <AdminPanel mode="panel" user={user} onLogout={handleLogout} />
        ) : (
          <UserPanel mode="panel" user={user} onLogout={handleLogout} />
        )}
      </main>
    );
  }

  return null;
}
