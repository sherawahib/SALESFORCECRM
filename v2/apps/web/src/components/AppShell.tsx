'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { loadUser, logout, can, type AuthUser } from '@/lib/api';
import { PERMISSIONS, PLATFORM_NAME } from '@ops/shared';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/my-hrms', label: 'My HRMS', always: true as const },
  { href: '/sales', label: 'Sales', perm: PERMISSIONS.SALES_DASHBOARD },
  { href: '/accounts', label: 'Accounts', perm: PERMISSIONS.ACC_INVOICES_READ },
  { href: '/hr', label: 'HR / HRMS', perm: PERMISSIONS.HR_DASHBOARD },
  { href: '/production', label: 'Production', perm: PERMISSIONS.PROD_PROJECTS_READ },
  { href: '/devops', label: 'DevOps', perm: PERMISSIONS.OPS_DEPLOYMENTS_READ },
  { href: '/it', label: 'IT', perm: PERMISSIONS.IT_AUDIT_READ },
  { href: '/admin', label: 'Admin', perm: PERMISSIONS.ADMIN_DEPARTMENTS },
] as const;

type NavItem = (typeof NAV)[number];
function navVisible(n: NavItem, perms: string[]) {
  if ('always' in n && n.always) return true;
  return can(perms, (n as { perm: string }).perm) || can(perms, PERMISSIONS.SUPER_ALL);
}

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const u = loadUser();
    if (!u) window.location.href = '/login';
    else setUser(u);
  }, []);

  if (!user) return <div className="p-8 text-slate-500">Loading…</div>;

  const perms = user.permissions || [];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <p className="font-semibold text-sm leading-tight">{PLATFORM_NAME}</p>
          <p className="text-xs text-slate-300 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.designation?.name || user.department?.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.filter((n) => navVisible(n, perms)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block px-3 py-2 rounded text-sm ${
                pathname.startsWith(n.href) ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
