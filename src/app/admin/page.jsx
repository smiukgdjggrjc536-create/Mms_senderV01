"use client";
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ configs: [], usersCount: 0 });
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    fetch('/api/admin/config').then(res => res.json()).then(data => setStats(data));
  }, []);

  const saveConfig = async () => {
    await fetch('/api/admin/config', {
      method: 'POST',
      body: JSON.stringify({ keyName: 'GEMINI_API_KEY', keyValue: apiKey }),
      headers: { 'Content-Type': 'application/json' }
    });
    alert('API Key Saved & Applied Real-time!');
    window.location.reload();
  };

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">Super Admin Panel</h1>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl text-gray-400">Total Users</h3>
          <p className="text-4xl font-bold mt-2">{stats.usersCount}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-xl text-gray-400">System Health</h3>
          <p className="text-4xl font-bold text-green-400 mt-2">100% Online</p>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl mb-4 border-b border-gray-700 pb-2">API Agent Configuration</h2>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Enter New Gemini Free API Key" 
            className="flex-1 p-3 rounded bg-gray-700 border-none text-white focus:ring-2 focus:ring-blue-500"
            onChange={e => setApiKey(e.target.value)}
          />
          <button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-bold">Save API</button>
        </div>
        <div className="mt-4">
          <p className="text-gray-400">Current APIs in DB:</p>
          {stats.configs.map(c => (
            <div key={c._id} className="mt-2 text-sm text-green-400">✔️ {c.keyName} is Active</div>
          ))}
        </div>
      </div>
    </div>
  );
            }
