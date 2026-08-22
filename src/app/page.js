'use client';

import { useState, useEffect } from 'react';
import AdminPanel from '@/components/AdminPanel';
import UserPanel from '@/components/UserPanel';

// NEXT_PUBLIC_PANEL_MODE is set at build time:
//   "admin" → Netlify shows Admin Panel only
//   "user"  → Vercel shows User Panel only
//   "api"   → Render shows NO UI (headless backend API only)
//             This is the [CRITICAL RED ALERT] from the system directive:
//             Render.com must NEVER serve an Admin/User panel or any HTML/React UI.
//             Render is a HEADLESS backend — only REST API endpoints.
const PANEL_MODE = process.env.NEXT_PUBLIC_PANEL_MODE || 'user';

export default function Home() {
  // ────────────────────────────────────────────────────────────────────────
  // HEADLESS MODE (Render) — NO UI, NO Panel, NO login form.
  // Returns a minimal status block that confirms the API engine is alive.
  // All real functionality is served via /api/* REST endpoints.
  // ────────────────────────────────────────────────────────────────────────
  if (PANEL_MODE === 'api') {
    return (
      <main style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 400 }}>Headless MMS Gateway Engine</h1>
          <p style={{ fontSize: '0.8rem', marginTop: '8px', color: '#444' }}>Backend API only — no UI served on this host.</p>
          <p style={{ fontSize: '0.7rem', marginTop: '4px', color: '#333' }}>Endpoints: /api/admin/gateway/* · /api/system</p>
        </div>
      </main>
    );
  }

  const [view, setView] = useState('loading'); // loading | login | panel
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, [refreshKey]);

  const checkSession = async () => {
    setView('loading');
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

  // Primary refresh — reload the panel without losing data
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Loading screen with animation
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
        </div>
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
          <AdminPanel mode="panel" user={user} onLogout={handleLogout} onRefresh={handleRefresh} />
        ) : (
          <UserPanel mode="panel" user={user} onLogout={handleLogout} onRefresh={handleRefresh} />
        )}
      </main>
    );
  }

  return null;
}
