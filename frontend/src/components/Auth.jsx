// src/pages/AuthPage.jsx - FIXED - Role correct allenkil mathram login
import React, { useState } from 'react';
import { auth } from '../services/api';

const normalizeRoleValue = (role) => {
  const value = String(role || 'editor').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const aliases = {
    owner: 'owner',
    administrator: 'administrator',
    admin: 'administrator',
    editor: 'editor',
    member: 'editor',
    guest: 'guest',
    subscriber: 'subscriber',
    viewer: 'subscriber',
  };
  return aliases[value] || 'editor';
};

const ROLES = [
  { value: 'owner', label: 'Owner', desc: 'Full access to everything' },
  { value: 'administrator', label: 'Administrator', desc: 'Manage boards, members & settings' },
  { value: 'editor', label: 'Editor', desc: 'Create, edit, delete tasks' },
  { value: 'guest', label: 'Guest', desc: 'View board + create tasks only' },
  { value: 'subscriber', label: 'Subscriber', desc: 'View only access' },
];

export default function AuthPage({ setViewMode, onAuthSuccess, t }) {
  const translate = t || ((key) => key);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email ||!password) {
      setError(translate('Email and password are required'));
      return;
    }
    if (mode === 'signup' &&!role) {
      setError(translate('Please select a role'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await auth.register({
          email: email.trim().toLowerCase(),
          password: password,
          name: name.trim() || email.split('@')[0],
          role: normalizeRoleValue(role),
        });

        const formData = new URLSearchParams();
        formData.append('username', email.trim().toLowerCase());
        formData.append('password', password);
        const loginRes = await auth.login(formData);
        localStorage.setItem('token', loginRes.data.access_token);
        localStorage.setItem('selected_role', normalizeRoleValue(role));
      } else {
        // SIGN IN - with role select
        const formData = new URLSearchParams();
        formData.append('username', email.trim().toLowerCase());
        formData.append('password', password);
        formData.append('role', normalizeRoleValue(role));

        const res = await auth.login(formData);
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('selected_role', normalizeRoleValue(role));
      }

      // The selected sign-in role is not authoritative; board access is resolved after login.
      try {
        const me = await auth.getMe();
        const actualRole = normalizeRoleValue(me.data?.role);

        localStorage.setItem('selected_role', actualRole || normalizeRoleValue(role));
        localStorage.setItem('user_role', actualRole || normalizeRoleValue(role));
        localStorage.setItem('user_email', me.data?.email || email.trim().toLowerCase());
      } catch (err) {
        localStorage.setItem('user_role', normalizeRoleValue(role));
      }

      if (onAuthSuccess) onAuthSuccess();
      if (setViewMode) setViewMode('dashboard');
      window.location.reload();

    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.msg || err.message || 'Authentication failed';
      setError(typeof msg === 'string'? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-black p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-[#09090b] dark:border-gray-800 shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">
            {mode === 'signin'? translate('Welcome back') : translate('Create account')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'signin'? translate('Sign in to your workspace') : translate('Create your workspace account')}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {mode === 'signin'? translate('Select your role to continue') : translate('Choose a role to get started')}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-gray-900 p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === 'signin'? 'bg-white dark:bg-[#18181b] shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500'}`}
          >
            {translate('Sign In')}
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === 'signup'? 'bg-white dark:bg-[#18181b] shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500'}`}
          >
            {translate('Sign Up')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-600 dark:text-gray-400">{translate('Full Name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-600 dark:text-gray-400">{translate('Email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@workflow.app"
              required
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-600 dark:text-gray-400">{translate('Password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-600 dark:text-gray-400">
              {translate('Select Role')} <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {translate(r.label)}
                </option>
              ))}
            </select>
            {/* FIXED: text- -> text-xs */}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {translate(ROLES.find((r) => r.value === role)?.desc)}
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading? translate('Please wait...') : mode === 'signin'? `${translate('Sign In')} — ${translate(ROLES.find(r=>r.value===role)?.label)}` : `${translate('Create account')} — ${translate(ROLES.find(r=>r.value===role)?.label)}`}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          {translate('Role can be changed later by Owner/Admin in Team settings')}
        </p>
      </div>
    </div>
  );
}
