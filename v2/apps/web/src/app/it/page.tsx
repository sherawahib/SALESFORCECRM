'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Tabs } from '@/components/Tabs';
import { api } from '@/lib/api';

type Audit = { id: string; entityType: string; entityId: number; action: string; createdAt: string; ipAddress?: string };
type Ticket = { id: number; subject: string; status: string; priority: string; body: string; createdAt: string };

export default function ItPage() {
  const [tab, setTab] = useState('audit');
  const [audit, setAudit] = useState<Audit[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', body: '', priority: 'medium' });

  useEffect(() => {
    api<Audit[]>('/api/v1/it/audit').then(setAudit).catch(console.error);
    api<Ticket[]>('/api/v1/it/tickets').then(setTickets).catch(console.error);
  }, []);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    await api('/api/v1/it/tickets', { method: 'POST', body: JSON.stringify(ticketForm) });
    setTicketForm({ subject: '', body: '', priority: 'medium' });
    api<Ticket[]>('/api/v1/it/tickets').then(setTickets);
    setTab('tickets');
  }

  return (
    <AppShell title="IT" subtitle="Audit trail · support tickets · integration credentials">
      <Tabs
        tabs={[
          { id: 'audit', label: 'Audit log' },
          { id: 'tickets', label: 'Support tickets' },
          { id: 'new', label: 'New ticket' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'audit' && (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm max-h-[600px] overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entity</th>
                <th className="px-4 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2 text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{a.action}</td>
                  <td className="px-4 py-2">
                    {a.entityType}#{a.entityId}
                  </td>
                  <td className="px-4 py-2">{a.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && <p className="p-6 text-sm text-slate-500">No audit entries yet. Actions appear as users work in the system.</p>}
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between">
                <p className="font-medium">{t.subject}</p>
                <span className="text-xs text-slate-500 capitalize">
                  {t.priority} · {t.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2">{t.body}</p>
              <p className="text-xs text-slate-400 mt-2">{new Date(t.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'new' && (
        <form onSubmit={createTicket} className="bg-white rounded-lg border p-6 max-w-lg space-y-4 shadow-sm">
          <input value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="Subject" className="w-full border rounded-lg px-3 py-2" required />
          <select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })} className="w-full border rounded-lg px-3 py-2">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <textarea value={ticketForm.body} onChange={(e) => setTicketForm({ ...ticketForm, body: e.target.value })} placeholder="Describe the issue" className="w-full border rounded-lg px-3 py-2" rows={5} required />
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium">
            Submit ticket
          </button>
        </form>
      )}
    </AppShell>
  );
}
