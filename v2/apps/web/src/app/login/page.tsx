'use client';

import { useState } from 'react';
import { login, saveSession } from '@/lib/api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@ops/shared';

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
  const [email, setEmail] = useState('it.super_admin@ops.test');
  const [password, setPassword] = useState(DEMO_PASSWORD);
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

  function pickAccount(accEmail: string) {
    setEmail(accEmail);
    setPassword(DEMO_PASSWORD);
  }

  const byDept = DEMO_ACCOUNTS.reduce<Record<string, typeof DEMO_ACCOUNTS>>((acc, row) => {
    if (!acc[row.department]) acc[row.department] = [];
    acc[row.department].push(row);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-700 to-slate-800 py-8 px-4">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">
        <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-xl p-8 space-y-4 h-fit">
          <h1 className="text-2xl font-bold text-slate-800">Ops Platform</h1>
          <p className="text-sm text-slate-500">Sign in — all test accounts use password <strong className="font-mono text-brand-600">{DEMO_PASSWORD}</strong></p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm"
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

        <div className="bg-white/95 rounded-xl shadow-xl p-6 max-h-[85vh] overflow-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Test accounts</h2>
          <p className="text-xs text-slate-500 mb-4">Click a row to fill the form, then Sign in (or Sign in directly).</p>
          {Object.entries(byDept).map(([dept, rows]) => (
            <div key={dept} className="mb-5">
              <h3 className="text-sm font-semibold text-brand-700 uppercase tracking-wide mb-2">{dept}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-1 pr-2">Role</th>
                    <th className="pb-1">Email</th>
                    <th className="pb-1 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.email}
                      className="border-b border-slate-100 hover:bg-brand-50 cursor-pointer"
                      onClick={() => pickAccount(row.email)}
                    >
                      <td className="py-2 pr-2 font-medium text-slate-800">{row.role}</td>
                      <td className="py-2 font-mono text-slate-600">{row.email}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="text-brand-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void doLogin(row.email, DEMO_PASSWORD);
                          }}
                        >
                          Go
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
