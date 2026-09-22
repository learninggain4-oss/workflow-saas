// src/pages/SignUpPage.jsx - UPDATED WITH ROLE SELECT
import React, { useState } from 'react';
import { auth } from '../services/api';

const ROLES = [
  { value: 'owner', label: 'Owner - Full access' },
  { value: 'administrator', label: 'Administrator - Manage team' },
  { value: 'editor', label: 'Editor - Create & edit' },
  { value: 'guest', label: 'Guest - Limited' },
  { value: 'subscriber', label: 'Subscriber - View only' },
];

export default function SignUpPage({ setViewMode }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'editor' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.register({ email: form.email.trim().toLowerCase(), password: form.password, name: form.name, role: form.role });
      const fd = new URLSearchParams();
      fd.append('username', form.email.trim().toLowerCase());
      fd.append('password', form.password);
      fd.append('role', form.role);
      const res = await auth.login(fd);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('selected_role', form.role);
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-black p-4">
      <form onSubmit={handleRegister} className="w-full max-w-md rounded-2xl border bg-white dark:bg-[#09090b] dark:border-gray-800 p-7 space-y-4">
        <h1 className="text-2xl font-bold dark:text-white">Create Account</h1>
        <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Full Name" className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none" />
        <input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="Email" required className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none" />
        <input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="Password" required className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white outline-none" />
        <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-[#09090b] dark:text-white">
          {ROLES.map(r=> <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <button disabled={loading} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white">{loading?'Creating...':'Create Account'}</button>
      </form>
    </div>
  );
}