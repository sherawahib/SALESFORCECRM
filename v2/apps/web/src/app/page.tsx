'use client';

import { useEffect } from 'react';
import { loadUser } from '@/lib/api';

export default function Home() {
  useEffect(() => {
    const u = loadUser();
    window.location.href = u ? '/sales' : '/login';
  }, []);
  return <div className="min-h-screen flex items-center justify-center text-slate-500">Redirecting…</div>;
}
