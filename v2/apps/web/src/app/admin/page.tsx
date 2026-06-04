'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Tabs } from '@/components/Tabs';
import { api } from '@/lib/api';

type Dept = { id: number; name: string; slug: string; _count: { users: number }; designations: { name: string; slug: string }[] };
type User = { id: number; name: string; email: string; isActive: boolean; department: { name: string }; designation: { name: string } };
type Desig = { id: number; name: string; slug: string; level: number; department: { name: string }; permissions: { permission: { slug: string } }[] };

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [desigs, setDesigs] = useState<Desig[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    api<Dept[]>('/api/v1/admin/departments').then(setDepts).catch(console.error);
    api<User[]>('/api/v1/admin/users').then(setUsers).catch(console.error);
    api<Desig[]>('/api/v1/admin/designations').then(setDesigs).catch(console.error);
    api<Record<string, string>>('/api/v1/admin/settings').then(setSettings).catch(console.error);
  }, []);

  return (
    <AppShell title="Administration" subtitle="Super Admin & IT — org structure, users, roles, system settings">
      <Tabs
        tabs={[
          { id: 'users', label: `Users (${users.length})` },
          { id: 'departments', label: 'Departments' },
          { id: 'roles', label: 'Role templates' },
          { id: 'settings', label: 'Settings' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'users' && (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">{u.department.name}</td>
                  <td className="px-4 py-3">{u.designation.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'departments' && (
        <div className="grid md:grid-cols-2 gap-4">
          {depts.map((d) => (
            <div key={d.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-lg">{d.name}</h3>
              <p className="text-sm text-slate-500">{d._count.users} users · {d.designations.length} role templates</p>
              <ul className="mt-3 text-sm space-y-1">
                {d.designations.map((des) => (
                  <li key={des.slug} className="text-slate-700">
                    {des.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-3 max-h-[600px] overflow-auto">
          {desigs.map((d) => (
            <div key={d.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <p className="font-medium">
                {d.name} <span className="text-slate-400 font-normal">({d.department.name})</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Level {d.level}</p>
              <p className="text-xs text-slate-600 mt-2 font-mono break-all">{d.permissions.map((p) => p.permission.slug).join(' · ')}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-white rounded-lg border p-6 shadow-sm max-w-md">
          <dl className="space-y-3 text-sm">
            {Object.entries(settings).map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500 font-mono text-xs">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </AppShell>
  );
}
