'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

type Deployment = {
  id: number;
  environment: string;
  version?: string;
  stagingUrl?: string;
  repoUrl?: string;
  notes?: string;
  deployedAt: string;
  project?: { projectCode: string; title: string };
};
type Project = { id: number; projectCode: string; title: string };

export default function DevOpsPage() {
  const [rows, setRows] = useState<Deployment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ projectId: '', environment: 'staging', repoUrl: '', stagingUrl: '', version: '', notes: '' });

  const reload = () => api<Deployment[]>('/api/v1/devops/deployments').then(setRows);

  useEffect(() => {
    reload();
    api<Project[]>('/api/v1/production/projects').then(setProjects).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api('/api/v1/devops/deployments', {
      method: 'POST',
      body: JSON.stringify({
        projectId: form.projectId ? +form.projectId : undefined,
        environment: form.environment,
        repoUrl: form.repoUrl || undefined,
        stagingUrl: form.stagingUrl || undefined,
        version: form.version || undefined,
        notes: form.notes || undefined,
      }),
    });
    setForm({ projectId: '', environment: 'staging', repoUrl: '', stagingUrl: '', version: '', notes: '' });
    reload();
  }

  return (
    <AppShell title="DevOps" subtitle="Deployment log · environments · staging URLs linked to projects">
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-3 shadow-sm h-fit">
          <h2 className="font-semibold">Log deployment</h2>
          <label className="block text-sm">
            Project (optional)
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
              <option value="">— General —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Environment
            <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="preview">Preview</option>
            </select>
          </label>
          <input placeholder="Repo URL" value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Staging / live URL" value={form.stagingUrl} onChange={(e) => setForm({ ...form, stagingUrl: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Version / tag" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg font-medium">
            Record deployment
          </button>
        </form>
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <h2 className="font-semibold px-4 py-3 border-b bg-slate-50">Deployment history</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Env</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">URL</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 capitalize">{r.environment}</td>
                  <td className="px-4 py-2">{r.project?.projectCode || '—'}</td>
                  <td className="px-4 py-2">
                    {r.stagingUrl ? (
                      <a href={r.stagingUrl} target="_blank" rel="noreferrer" className="text-brand-600 text-xs">
                        {r.stagingUrl}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{new Date(r.deployedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
