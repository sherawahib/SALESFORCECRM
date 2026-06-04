'use client';

import { useState } from 'react';
import { login, saveSession } from '@/lib/api';
import { PLATFORM_NAME } from '@ops/shared';

function homeForDept(slug?: string) {
  const map: Record<string, string> = {
    sales: '/sales',
    accounts: '/accounts',
    hr: '/hr',
    production: '/production',
    devops: '/devops',
    it: '/admin',
  };
  return slug ? map[slug] || '/sales' : '/sales';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError('');
    try {
      const res = await login(loginEmail, loginPassword);
      saveSession(res.accessToken, res.refreshToken, {
        ...res.user,
        permissions: res.permissions || [],
      });
      const slug = res.user.designation?.slug;
      if (slug === 'project_manager') {
        window.location.href = '/sales?tab=scheduled-calls';
      } else if (slug === 'lead_finder' || slug === 'sales_manager') {
        window.location.href = slug === 'sales_manager' ? '/sales?tab=portfolio' : '/sales';
      } else if (slug === 'junior_designer' || slug === 'junior_developer') {
        window.location.href = '/production?tab=my-revisions';
      } else if (slug === 'design_head' || slug === 'dev_head') {
        window.location.href = '/production?tab=head-queue';
      } else if (slug === 'hr_executive' || slug === 'hr_manager') {
        window.location.href = '/hr';
      } else {
        window.location.href = homeForDept(res.user.department?.slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-brand-700 to-slate-800 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white rounded-xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{PLATFORM_NAME}</h1>
        <p className="text-sm text-slate-500">Sign in with your work email and password.</p>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
            required
            autoComplete="username"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
            required
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
