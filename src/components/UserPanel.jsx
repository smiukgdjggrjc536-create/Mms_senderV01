'use client';

import { useState, useEffect, useRef } from 'react';

export default function UserPanel({ user, onLogout }) {
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
      if (res.ok) {
        setCampaigns(data.campaigns || []);
        setLimit(data.limit ?? limit);
        setSent(data.sent ?? sent);
        setStatus(data.status || 'active');
      }
    } catch (e) {
      /* silent */
    }
  };

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !numbers.trim()) {
      showToast('Please fill in all fields', 'error');
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
          message: message.trim(),
          numbers: numbers.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Campaign Sent Successfully!', 'success');
        setMessage('');
        setNumbers('');
        fetchCampaigns();
      } else {
        showToast(data.error || 'Failed to send campaign', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  const remaining = Math.max(0, limit - sent);
  const usagePercent = limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-pulse ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              SMS Campaign Sender
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Logged in as <span className="text-indigo-300">{user.email}</span>
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>

        {/* Suspended banner */}
        {status !== 'active' && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-200 text-sm">
            Your account is suspended. Contact the administrator.
          </div>
        )}

        {/* Quota card */}
        <div className="bg-gray-900 rounded-xl p-5 mb-6 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Sending Quota</h2>
            <span className="text-sm text-gray-400">
              {sent} / {limit} sent
            </span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90
                  ? 'bg-red-500'
                  : usagePercent >= 70
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{remaining} remaining</span>
            <span>{usagePercent}% used</span>
          </div>
        </div>

        {/* Campaign form */}
        <div className="bg-gray-900 rounded-xl p-5 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Send New Campaign</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your SMS message here..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading || status !== 'active'}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition text-sm"
            >
              {loading ? 'Processing...' : 'Send Campaign'}
            </button>
          </form>
        </div>

        {/* Campaign history */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Campaign History</h2>
          {campaigns.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No campaigns yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="pb-2 pr-3 font-medium">Message</th>
                    <th className="pb-2 pr-3 font-medium">Recipients</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">AI Verdict</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c._id} className="border-b border-gray-800/50">
                      <td className="py-3 pr-3 text-gray-300 max-w-xs truncate">
                        {c.message}
                      </td>
                      <td className="py-3 pr-3 text-gray-400">
                        {Array.isArray(c.numbers) ? c.numbers.length : 0}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            c.status === 'sent'
                              ? 'bg-green-900/50 text-green-300'
                              : 'bg-red-900/50 text-red-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-gray-400 text-xs">{c.aiVerdict}</td>
                      <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
