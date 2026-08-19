"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      router.push(data.role === 'admin' ? '/admin' : '/user');
    } else {
      alert(data.error);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900">
      <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl text-white font-bold mb-6 text-center">Enterprise Login</h2>
        <input type="email" placeholder="Email" required className="w-full p-3 mb-4 rounded bg-gray-700 text-white border-none focus:ring-2 focus:ring-blue-500" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required className="w-full p-3 mb-6 rounded bg-gray-700 text-white border-none focus:ring-2 focus:ring-blue-500" onChange={e => setPassword(e.target.value)} />
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold">Sign In</button>
      </form>
    </div>
  );
}
