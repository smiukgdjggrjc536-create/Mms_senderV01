'use client';
import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [configStatus, setConfigStatus] = useState({
    MONGODB_URI: false,
    GEMINI_API_KEY: false,
    SMS_API_KEY: false,
  });
  const [configs, setConfigs] = useState({
    MONGODB_URI: '',
    GEMINI_API_KEY: '',
    SMS_API_KEY: '',
  });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});

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
      const [u, c, s] = await Promise.all([
        apiCall({ action: 'getUsers' }),
        apiCall({ action: 'getCampaigns' }),
        apiCall({ action: 'getConfigStatus' }),
      ]);
      if (u.users) setUsers(u.users);
      if (c.campaigns) setCampaigns(c.campaigns);
      if (s.status) setConfigStatus(s.status);
    };
    loadData();
  }, []);

  const saveConfig = async (keyName) => {
    setLoading({ ...loading, [keyName]: true });
    const res = await apiCall({
      action: 'saveConfig',
      keyName,
      keyValue: configs[keyName],
    });
    setLoading({ ...loading, [keyName]: false });
    if (res.success) {
      showToast('success', res.message);
      setConfigStatus({ ...configStatus, [keyName]: true });
    } else {
      showToast('error', res.error || 'Failed to save');
    }
  };

  const suspendUser = async (email) => {
    const res = await apiCall({ action: 'suspendUser', email });
    if (res.success) {
      showToast('success', 'User suspended');
      setUsers(
        users.map((u) =>
          u.email === email ? { ...u, status: 'suspended' } : u
        )
      );
    } else {
      showToast('error', res.error || 'Failed');
    }
  };

  const activateUser = async (email) => {
    const res = await apiCall({ action: 'activateUser', email });
    if (res.success) {
      showToast('success', 'User activated');
      setUsers(
        users.map((u) => (u.email === email ? { ...u, status: 'active' } : u))
      );
    } else {
      showToast('error', res.error || 'Failed');
    }
  };

  const configFields = [
    {
      label: 'MongoDB URI',
      key: 'MONGODB_URI',
      type: 'text',
      desc: 'Database connection string',
    },
    {
      label: 'Gemini API Key',
      key: 'GEMINI_API_KEY',
      type: 'password',
      desc: 'AI spam filter key',
    },
    {
      label: 'SMS Gateway API Key',
      key: 'SMS_API_KEY',
      type: 'password',
      desc: 'SMS sending key',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Master Configuration Hub
          </h1>
          <button
            onClick={() => {
              document.cookie = 'token=; Max-Age=0; path=/';
              window.location.href = '/';
            }}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm"
          >
            Logout
          </button>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  configStatus.MONGODB_URI ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></span>
              <span className="text-slate-300">Database</span>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {configStatus.MONGODB_URI ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  configStatus.GEMINI_API_KEY ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              ></span>
              <span className="text-slate-300">Gemini AI</span>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {configStatus.GEMINI_API_KEY ? 'Configured' : 'Not Configured'}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  configStatus.SMS_API_KEY ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              ></span>
              <span className="text-slate-300">Sending Module</span>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {configStatus.SMS_API_KEY ? 'Ready' : 'Not Configured'}
            </p>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-1">
            System AI Integrations
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Update configurations without touching the codebase
          </p>

          {configFields.map((cfg) => (
            <div key={cfg.key} className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {cfg.label}
              </label>
              <p className="text-xs text-slate-500 mb-2">{cfg.desc}</p>
              <div className="flex gap-2">
                <input
                  type={cfg.type}
                  value={configs[cfg.key]}
                  onChange={(e) =>
                    setConfigs({ ...configs, [cfg.key]: e.target.value })
                  }
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
                  placeholder={`Enter ${cfg.label}`}
                />
                <button
                  onClick={() => saveConfig(cfg.key)}
                  disabled={loading[cfg.key]}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {loading[cfg.key] ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* User Management Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Registered Users
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Role</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Sent/Limit</th>
                  <th className="text-left py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="py-4 text-center text-slate-500"
                    >
                      No users registered yet
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.email}
                      className="border-b border-slate-800/50"
                    >
                      <td className="py-2 px-2 text-white">{u.email}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            u.status === 'active'
                              ? 'bg-green-900 text-green-300'
                              : 'bg-red-900 text-red-300'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">
                        {u.sentCount}/{u.sendingLimit}
                      </td>
                      <td className="py-2 px-2">
                        {u.status === 'active' ? (
                          <button
                            onClick={() => suspendUser(u.email)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-500"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => activateUser(u.email)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-500"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campaign Logs Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Campaign History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 px-2">User Email</th>
                  <th className="text-left py-2 px-2">Message</th>
                  <th className="text-left py-2 px-2">Numbers</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">AI Verdict</th>
                  <th className="text-left py-2 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="py-4 text-center text-slate-500"
                    >
                      No campaigns yet
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-800/50"
                    >
                      <td className="py-2 px-2 text-white">{c.userEmail}</td>
                      <td className="py-2 px-2 text-slate-300">
                        {c.message
                          ? c.message.substring(0, 50) +
                            (c.message.length > 50 ? '...' : '')
                          : ''}
                      </td>
                      <td className="py-2 px-2 text-slate-300">
                        {c.numbers ? c.numbers.length : 0}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            c.status === 'sent'
                              ? 'bg-green-900 text-green-300'
                              : c.status === 'blocked'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-yellow-900 text-yellow-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">
                        {c.aiVerdict}
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString()
                          : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
