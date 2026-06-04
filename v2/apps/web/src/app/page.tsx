'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@ops/shared';
import { loadUser } from '@/lib/api';

export default function Home() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    const u = loadUser();
    if (u) {
      window.location.href = '/sales';
      return;
    }
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setApiOk(!!d?.ok))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-brand-700 to-slate-800 px-4 text-center text-white">
      <h1 className="text-3xl font-bold">{PLATFORM_NAME}</h1>
      <p className="mt-2 text-slate-200 max-w-md">Sales, production, accounts, and HR — all in one place.</p>
      {apiOk === true && (
        <p className="mt-4 text-sm text-emerald-300">● System online — database connected</p>
      )}
      {apiOk === false && (
        <p className="mt-4 text-sm text-red-300">● API not responding — check Vercel environment variables</p>
      )}
      <Link
        href="/login"
        className="mt-8 inline-block px-8 py-3 bg-white text-brand-800 font-semibold rounded-lg hover:bg-slate-100"
      >
        Sign in
      </Link>
      <p className="mt-6 text-xs text-slate-400">
        Production: <span className="font-mono">salesforcecrm.vercel.app</span>
      </p>
    </div>
  );
}
