'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api, can, loadUser } from '@/lib/api';
import { PERMISSIONS } from '@ops/shared';
import { PmAdditionalRevisionForm } from '@/components/PmAdditionalRevisionForm';
import { PmRevisionForm } from '@/components/PmRevisionForm';

type Revision = {
  id: number;
  revisionNumber: number;
  status: string;
  productionDiscipline?: string | null;
  openedReason?: string;
  notifySeller?: boolean;
  sellerNotifiedAt?: string | null;
  assignee?: { name: string; designation?: { name: string }; team?: { name: string } };
};

type ProjectHub = {
  id: number;
  projectCode: string;
  title: string;
  status: string;
  lifecycle: string;
  projectCategory: string;
  isFrozen: boolean;
  budgetTotal: number | string;
  budgetRecalculated?: number;
  sellerBrief?: string;
  client: { contactName: string; companyName?: string; email?: string; phone?: string };
  lead?: { id: number; leadCode: string; status: string };
  projectManager?: { name: string };
  assignedDesigner?: { id: number; name: string } | null;
  assignedDeveloper?: { id: number; name: string } | null;
  invoices: { id: number; invoiceNumber: string; status: string; total: number | string; isUpsell?: boolean }[];
  revisions: Revision[];
  budgetLines: { lineType: string; description: string; amount: number | string }[];
};

export default function ProjectHubPage() {
  const params = useParams();
  const id = Number(params.id);
  const [project, setProject] = useState<ProjectHub | null>(null);
  const [tab, setTab] = useState('board');
  const [upsell, setUpsell] = useState({ description: 'Additional scope', amount: 500, markPaid: false });
  const [invForm, setInvForm] = useState({ description: 'Services', quantity: 1, unitPrice: 1000, markPaid: false });
  const [exception, setException] = useState({ type: 'refund' as 'refund' | 'chargeback', reason: '' });
  const user = loadUser();
  const canInvoice = can(user?.permissions, PERMISSIONS.SALES_INVOICES_CREATE);
  const canUpsell = can(user?.permissions, PERMISSIONS.SALES_UPSELL);
  const canPmRev = can(user?.permissions, PERMISSIONS.SALES_CLIENT_REVISIONS);
  const canAssignRev = can(user?.permissions, PERMISSIONS.SALES_REVISIONS_ASSIGN);
  const canManager =
    can(user?.permissions, PERMISSIONS.SALES_LEADS_MANAGER) || can(user?.permissions, PERMISSIONS.SUPER_ALL);
  const frozen = project?.isFrozen;

  const load = () => api<ProjectHub>(`/api/v1/projects/${id}`).then(setProject);

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  async function markNotified(revId: number) {
    await api(`/api/v1/projects/${id}/revisions/${revId}/client-notified`, { method: 'POST', body: '{}' });
    load();
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/v1/sales/projects/${id}/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        items: [{ description: invForm.description, quantity: invForm.quantity, unitPrice: invForm.unitPrice }],
        markPaid: invForm.markPaid,
      }),
    });
    load();
  }

  async function addUpsell(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/v1/projects/${id}/upsell`, {
      method: 'POST',
      body: JSON.stringify(upsell),
    });
    load();
  }

  async function closeProject() {
    if (!confirm('Close project as complete?')) return;
    await api(`/api/v1/projects/${id}/close`, { method: 'POST', body: '{}' });
    load();
  }

  async function requestException(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/v1/projects/${id}/financial-exception`, { method: 'POST', body: JSON.stringify(exception) });
    setException({ type: 'refund', reason: '' });
    alert('Submitted for Accounts approval');
  }

  if (!project) return <AppShell title="Project">Loading…</AppShell>;

  const budget = Number(project.budgetRecalculated ?? project.budgetTotal);

  return (
    <AppShell
      title={project.projectCode}
      subtitle={canAssignRev ? 'Open revisions here — assign Design or Development crew' : 'Project hub'}
    >
      <Link href="/sales" className="text-sm text-brand-600 hover:underline mb-4 inline-block">
        ← Back to Sales
      </Link>

      {frozen && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
          Project frozen (refund/chargeback). Production halted.
        </p>
      )}

      {/* Phase 4 UI: budget top */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 col-span-1">
          <p className="text-xs font-semibold text-indigo-600 uppercase">Project budget</p>
          <p className="text-3xl font-bold text-indigo-900 mt-1">${budget.toFixed(2)}</p>
          <p className="text-xs text-indigo-700 mt-1">Original + paid upsells</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase">Lifecycle</p>
          <div className="mt-2 flex gap-2">
            <StatusBadge status={project.lifecycle} />
            <StatusBadge status={project.status} />
          </div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase">PM / Category</p>
          <p className="font-medium mt-2">{project.projectManager?.name || 'Unassigned'}</p>
          <p className="text-sm capitalize text-slate-600">{project.projectCategory}</p>
          <p className="text-xs text-slate-500 mt-2">
            Designer: {project.assignedDesigner?.name || '—'} · Developer: {project.assignedDeveloper?.name || '—'}
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'board', label: canAssignRev ? 'Revisions & production' : 'Production board' },
          { id: 'invoices', label: `Invoices (${project.invoices.length})` },
          { id: 'overview', label: 'Account' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'board' && (
        <div className="space-y-6">
          {/* revisions middle */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Revision ledger (v1, v2, v3…)</h3>
            {project.revisions.length === 0 && <p className="text-sm text-slate-500">No revisions yet.</p>}
            <ul className="space-y-3">
              {[...project.revisions].reverse().map((r) => (
                <li key={r.id} className="border rounded-lg p-4 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold">v{r.revisionNumber}</span>
                      <StatusBadge status={r.status} />
                      <p className="text-slate-600 mt-2">{r.openedReason}</p>
                      {r.assignee && (
                        <p className="text-xs text-slate-500 mt-1">
                          Assigned: {r.assignee.name} ({r.productionDiscipline || r.assignee.team?.name || r.assignee.designation?.name})
                        </p>
                      )}
                    </div>
                    {r.status === 'client_review' && r.notifySeller && !r.sellerNotifiedAt && canPmRev && (
                      <button type="button" onClick={() => markNotified(r.id)} className="text-xs text-brand-600 font-medium shrink-0">
                        Mark client notified
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* controls bottom */}
          {!frozen && project.lifecycle !== 'completed' && (
            <div className="bg-slate-50 border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">Management controls</h3>
              {canAssignRev && (
                <>
                  <div className="border-b pb-4 mb-4">
                    <p className="text-xs font-semibold text-amber-800 mb-2">Client revision (category rules)</p>
                    <PmRevisionForm projectId={id} onSuccess={load} />
                  </div>
                  <div className="border-b pb-4 mb-4">
                    <p className="text-xs font-semibold text-violet-800 mb-2">Additional revision (Design or Development)</p>
                    <PmAdditionalRevisionForm projectId={id} onSuccess={load} />
                  </div>
                </>
              )}
              {canUpsell && (
                <form onSubmit={addUpsell} className="grid md:grid-cols-3 gap-2 items-end border-t pt-4">
                  <p className="md:col-span-3 text-xs font-semibold text-slate-600">Sales Manager — upsell</p>
                  <input value={upsell.description} onChange={(e) => setUpsell({ ...upsell, description: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" placeholder="Upsell description" />
                  <input type="number" value={upsell.amount} onChange={(e) => setUpsell({ ...upsell, amount: +e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={upsell.markPaid} onChange={(e) => setUpsell({ ...upsell, markPaid: e.target.checked })} />
                    Paid now
                  </label>
                  <button type="submit" className="md:col-span-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
                    Add upsell to budget
                  </button>
                </form>
              )}
              {canManager && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <button type="button" onClick={closeProject} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                    Close project complete
                  </button>
                  <form onSubmit={requestException} className="flex flex-wrap gap-2 items-center">
                    <select value={exception.type} onChange={(e) => setException({ ...exception, type: e.target.value as 'refund' | 'chargeback' })} className="border rounded-lg px-2 py-1 text-sm">
                      <option value="refund">Refund</option>
                      <option value="chargeback">Chargeback</option>
                    </select>
                    <input value={exception.reason} onChange={(e) => setException({ ...exception, reason: e.target.value })} placeholder="Reason" className="border rounded-lg px-2 py-1 text-sm" required />
                    <button type="submit" className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">
                      Escalate to Accounts
                    </button>
                  </form>
                  <p className="w-full text-xs text-slate-500">Close, refund, and chargeback are Sales Manager actions only.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-4">
          {canInvoice && !frozen && (
            <form onSubmit={createInvoice} className="bg-white border rounded-lg p-4 space-y-3 shadow-sm max-w-lg">
              <p className="text-sm font-semibold text-brand-700">Sales Manager — issue invoice</p>
              <input value={invForm.description} onChange={(e) => setInvForm({ ...invForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="number" value={invForm.unitPrice} onChange={(e) => setInvForm({ ...invForm, unitPrice: +e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={invForm.markPaid} onChange={(e) => setInvForm({ ...invForm, markPaid: e.target.checked })} />
                Mark paid → activate production delivery
              </label>
              <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                Create invoice
              </button>
            </form>
          )}
          <ul className="space-y-2">
            {project.invoices.map((inv) => (
              <li key={inv.id} className="bg-white border rounded-lg px-4 py-3 flex justify-between text-sm">
                <span className="font-mono">
                  {inv.invoiceNumber}
                  {inv.isUpsell ? ' (upsell)' : ''}
                </span>
                <StatusBadge status={inv.status} />
                <span className="font-medium">${Number(inv.total).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'overview' && (
        <div className="bg-white border rounded-lg p-6 max-w-lg">
          <p className="font-medium text-lg">{project.client.contactName}</p>
          <p className="text-slate-600">{project.client.companyName}</p>
          <p className="text-sm mt-4">{project.sellerBrief || 'No brief'}</p>
          {project.lead && <p className="text-xs text-slate-400 mt-4">Lead {project.lead.leadCode}</p>}
        </div>
      )}
    </AppShell>
  );
}
