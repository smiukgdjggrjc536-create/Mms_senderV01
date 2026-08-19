"use client";
import { useState } from 'react';

export default function UserDashboard() {
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState('');
  const [status, setStatus] = useState('');

  const sendCampaign = async () => {
    setStatus('AI Agent is checking your message...');
    const res = await fetch('/api/user/send', {
      method: 'POST',
      body: JSON.stringify({ message, numbers }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    setStatus(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
  };

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-indigo-400">Deep Sending Dashboard</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 shadow-xl">
        <h2 className="text-xl mb-4">Create New Campaign</h2>
        <textarea 
          placeholder="Type your message here (AI will audit this)"
          className="w-full p-4 mb-4 rounded bg-slate-700 text-white border-none focus:ring-2 focus:ring-indigo-500"
          rows="4"
          onChange={e => setMessage(e.target.value)}
        />
        <textarea 
          placeholder="Enter numbers separated by comma"
          className="w-full p-4 mb-4 rounded bg-slate-700 text-white border-none focus:ring-2 focus:ring-indigo-500"
          rows="2"
          onChange={e => setNumbers(e.target.value)}
        />
        <button onClick={sendCampaign} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded font-bold w-full transition-all">
          Audit & Send Campaign
        </button>
        {status && <div className="mt-4 p-4 rounded bg-slate-700 font-bold">{status}</div>}
      </div>
    </div>
  );
          }
