// src/pages/SignInPage.jsx - UPDATED WITH ROLE SELECT
import React, { useState } from 'react';
import { auth } from '../../services/api';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'editor', label: 'Editor' },
  { value: 'guest', label: 'Guest' },
  { value: 'subscriber', label: 'Subscriber' },
];

const normalizeRoleValue = (role) => {
  const v = String(role || 'editor').toLowerCase().replace(/[-\s]+/g, '_');
  const map = { admin: 'administrator', member: 'editor', viewer: 'subscriber', owner: 'owner', administrator: 'administrator', editor: 'editor', guest: 'guest', subscriber: 'subscriber' };
  return map[v] || 'editor';
};

export default function SignInPage({ setViewMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email.trim().toLowerCase());
      formData.append('password', password);
      formData.append('role', normalizeRoleValue(role));

      const res = await auth.login(formData);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('selected_role', normalizeRoleValue(role));

      const me = await auth.getMe().catch(() => null);
      if (me?.data) {
        localStorage.setItem('user_role', me.data.role);
        localStorage.setItem('user_email', me.data.email);
      }

      if (setViewMode) setViewMode('dashboard');
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials or role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-black p-4">
      <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl border bg-white dark:bg-[#09090b] dark:border-gray-800 p-7 space-y-4 shadow-sm">
        <h1 className="text-2xl font-bold dark:text-white">Sign In</h1>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Select role to continue</p>

        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none focus:border-indigo-500" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none focus:border-indigo-500" />

        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Role *</label>
          <select value={role} onChange={e=>setRole(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none focus:border-indigo-500">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <button disabled={loading} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading? 'Signing in...' : `Sign In as ${role}`}
        </button>
      </form>
    </div>
  );
}