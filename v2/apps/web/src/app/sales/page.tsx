'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api, can, loadUser } from '@/lib/api';
import { PERMISSIONS } from '@ops/shared';
import { PmAdditionalRevisionForm } from '@/components/PmAdditionalRevisionForm';
import { PmRevisionForm } from '@/components/PmRevisionForm';

type Dash = { role: string; pending?: number; active?: number; projects?: number; openRevisions?: number; submitted?: number };
type Lead = {
  id: number;
  leadCode: string;
  contactName: string;
  companyName?: string;
  status: string;
  project?: { id: number; projectCode: string };
  seller?: { name: string };
};
type PM = { id: number; name: string; email: string };
type Project = {
  id: number;
  projectCode: string;
  title: string;
  status: string;
  lifecycle?: string;
  projectCategory: string;
  budgetTotal?: number | string;
  client: { contactName: string };
  projectManager?: { name: string } | null;
  lead?: { leadCode: string; status: string } | null;
  _count: { invoices: number; revisions: number };
};
type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  status: string;
  total: number | string;
  isUpsell?: boolean;
  client: { contactName: string };
  project?: { id: number; projectCode: string };
};
type PortfolioRow = {
  id: number;
  projectCode: string;
  title: string;
  clientName: string;
  companyName?: string | null;
  projectManager?: { name: string } | null;
  lifecycle: string;
  status: string;
  projectCategory: string;
  lastPaymentAt: string | null;
  invoiceCount: number;
};
type Portfolio = { ongoing: PortfolioRow[]; closed: PortfolioRow[]; past: PortfolioRow[]; total: number };
type ScheduledCall = {
  id: number;
  title: string;
  notes?: string | null;
  scheduledAt: string;
  status: string;
  reminder15Sent: boolean;
  reminder5Sent: boolean;
  project?: { projectCode: string; client: { contactName: string } } | null;
  lead?: { leadCode: string; contactName: string } | null;
};

function formatLastPayment(iso: string | null) {
  if (!iso) return 'No payment recorded';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function PortfolioTable({ rows, showPm }: { rows: PortfolioRow[]; showPm?: boolean }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-slate-500">None in this category.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left">
        <tr>
          <th className="px-4 py-2">Project</th>
          <th className="px-4 py-2">Client</th>
          {showPm && <th className="px-4 py-2">PM</th>}
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">Last payment</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-t">
            <td className="px-4 py-2 font-mono text-xs">{p.projectCode}</td>
            <td className="px-4 py-2">{p.clientName}</td>
            {showPm && <td className="px-4 py-2">{p.projectManager?.name || '—'}</td>}
            <td className="px-4 py-2">
              <StatusBadge status={p.lifecycle} />
              <span className="ml-1">
                <StatusBadge status={p.status} />
              </span>
            </td>
            <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{formatLastPayment(p.lastPaymentAt)}</td>
            <td className="px-4 py-2 text-right">
              <Link href={`/projects/${p.id}`} className="text-brand-600 font-medium hover:underline">
                Hub
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SalesPage() {
  const user = loadUser();
  const isManager = can(user?.permissions, PERMISSIONS.SALES_LEADS_MANAGER) || can(user?.permissions, PERMISSIONS.SUPER_ALL);
  const canInvoice = can(user?.permissions, PERMISSIONS.SALES_INVOICES_CREATE) || isManager;
  const canUpsell = can(user?.permissions, PERMISSIONS.SALES_UPSELL) || isManager;
  const isPm =
    user?.designation?.slug === 'project_manager' ||
    can(user?.permissions, PERMISSIONS.SALES_PROJECTS_PM);
  const canAssignRev = can(user?.permissions, PERMISSIONS.SALES_REVISIONS_ASSIGN);
  const isFinder = !isManager && !isPm && can(user?.permissions, PERMISSIONS.SALES_LEADS_WRITE);

  const [tab, setTab] = useState(isManager ? 'billing' : isPm ? 'revisions' : 'submit');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t) setTab(t);
  }, []);
  const [revProjectId, setRevProjectId] = useState(0);
  const [dash, setDash] = useState<Dash | null>(null);
  const [managerLeads, setManagerLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [pms, setPms] = useState<PM[]>([]);
  const [pmId, setPmId] = useState(0);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [billingProjectId, setBillingProjectId] = useState(0);
  const [invForm, setInvForm] = useState({
    description: 'Professional services',
    quantity: 1,
    unitPrice: 2500,
    markPaid: false,
    projectCategory: 'development' as 'design' | 'development' | 'combo',
  });
  const [upsellForm, setUpsellForm] = useState({ description: 'Additional scope', amount: 500, markPaid: false });
  const [newLead, setNewLead] = useState({ contactName: '', companyName: '', phone: '', email: '', notes: '', projectCategory: 'development' as const });
  const [msg, setMsg] = useState('');
  const [dialerLeads, setDialerLeads] = useState<Lead[]>([]);
  const [selectedDialer, setSelectedDialer] = useState<Lead | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [callForm, setCallForm] = useState({
    projectId: 0,
    title: '',
    notes: '',
    scheduledAt: '',
  });
  const [callReminder, setCallReminder] = useState('');

  const billingProject = allProjects.find((p) => p.id === billingProjectId);

  useEffect(() => {
    api<Dash>('/api/v1/sales/dashboard').then(setDash).catch(console.error);
  }, []);

  const loadManager = useCallback(() => {
    api<Lead[]>('/api/v1/sales/leads?queue=manager').then(setManagerLeads).catch(console.error);
    api<PM[]>('/api/v1/sales/project-managers').then(setPms).catch(console.error);
  }, []);

  const loadBilling = useCallback(() => {
    api<Project[]>('/api/v1/sales/projects')
      .then((list) => {
        setAllProjects(list);
        setBillingProjectId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? 0;
        });
      })
      .catch(console.error);
    if (canInvoice) api<InvoiceRow[]>('/api/v1/sales/invoices').then(setInvoices).catch(console.error);
  }, [canInvoice]);

  const loadPortfolio = useCallback(() => {
    api<Portfolio>('/api/v1/sales/manager/project-portfolio').then(setPortfolio).catch(console.error);
  }, []);

  const loadScheduledCalls = useCallback(() => {
    api<ScheduledCall[]>('/api/v1/sales/scheduled-calls').then(setScheduledCalls).catch(console.error);
  }, []);

  const loadPm = useCallback(() => {
    api<Project[]>('/api/v1/sales/my-projects').then((list) => {
      setMyProjects(list);
      if (list.length && !revProjectId) setRevProjectId(list[0].id);
    }).catch(console.error);
    api<Lead[]>('/api/v1/sales/leads?queue=dialer').then(setDialerLeads).catch(console.error);
  }, [revProjectId]);

  useEffect(() => {
    if (isManager) {
      loadManager();
      loadBilling();
      loadPortfolio();
    }
    if (isPm) {
      loadPm();
      loadScheduledCalls();
    }
  }, [isManager, isPm, loadManager, loadPm, loadBilling, loadPortfolio, loadScheduledCalls]);

  useEffect(() => {
    if (!isPm || tab !== 'scheduled-calls') return;
    const tick = () => {
      const now = Date.now();
      for (const c of scheduledCalls) {
        if (c.status !== 'scheduled') continue;
        const at = new Date(c.scheduledAt).getTime();
        const mins = Math.round((at - now) / 60000);
        if (mins === 15 || mins === 5) {
          setCallReminder(`${c.title} starts in ${mins} minutes`);
        }
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [isPm, tab, scheduledCalls]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    const res = await api<{ lead: Lead; project: { id: number } }>('/api/v1/sales/leads', {
      method: 'POST',
      body: JSON.stringify(newLead),
    });
    setMsg(`Lead ${res.lead.leadCode} submitted to Sales Manager. Project ${res.project.id} created.`);
    setNewLead({ contactName: '', companyName: '', phone: '', email: '', notes: '', projectCategory: 'development' });
    api<Dash>('/api/v1/sales/dashboard').then(setDash);
  }

  async function assignPm() {
    if (!selectedLead || !pmId) return;
    await api(`/api/v1/sales/leads/${selectedLead.id}/assign-pm`, {
      method: 'POST',
      body: JSON.stringify({ projectManagerId: pmId }),
    });
    setMsg(`Assigned ${selectedLead.contactName} to Project Manager`);
    setSelectedLead(null);
    loadManager();
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!billingProjectId) return;
    await api(`/api/v1/sales/projects/${billingProjectId}/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        items: [{ description: invForm.description, quantity: invForm.quantity, unitPrice: invForm.unitPrice }],
        projectCategory: invForm.projectCategory,
        markPaid: invForm.markPaid,
      }),
    });
    setMsg('Invoice created successfully');
    loadBilling();
    if (isManager) loadPortfolio();
  }

  async function addUpsell(e: React.FormEvent) {
    e.preventDefault();
    if (!billingProjectId) return;
    await api(`/api/v1/projects/${billingProjectId}/upsell`, {
      method: 'POST',
      body: JSON.stringify(upsellForm),
    });
    setMsg('Upsell added to project');
    loadBilling();
    loadPortfolio();
  }

  async function scheduleCall(e: React.FormEvent) {
    e.preventDefault();
    if (!callForm.scheduledAt || !callForm.title.trim()) return;
    try {
      await api('/api/v1/sales/scheduled-calls', {
        method: 'POST',
        body: JSON.stringify({
          projectId: callForm.projectId || undefined,
          title: callForm.title,
          notes: callForm.notes || undefined,
          scheduledAt: new Date(callForm.scheduledAt).toISOString(),
        }),
      });
      setMsg('Call scheduled — reminders at 15 min and 5 min before');
      setCallForm({ projectId: myProjects[0]?.id ?? 0, title: '', notes: '', scheduledAt: '' });
      loadScheduledCalls();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not schedule call');
    }
  }

  async function updateCallStatus(id: number, status: 'completed' | 'cancelled') {
    await api(`/api/v1/sales/scheduled-calls/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadScheduledCalls();
  }

  const managerTabs = [
    { id: 'billing', label: 'Invoices & Upsell' },
    { id: 'portfolio', label: 'Project portfolio' },
    { id: 'manager', label: `Manager queue (${dash?.pending ?? 0})` },
    { id: 'projects', label: 'All projects (quick)' },
  ];
  const pmTabs = [
    { id: 'revisions', label: 'Revisions (assign crew)' },
    { id: 'scheduled-calls', label: 'Scheduled calls' },
    { id: 'dialer', label: 'Dialer queue' },
    { id: 'projects', label: 'My projects' },
  ];
  const finderTabs = [
    { id: 'submit', label: 'Submit lead' },
    { id: 'csv', label: 'CSV import' },
  ];

  const tabs = isManager ? managerTabs : isPm ? pmTabs : finderTabs;

  return (
    <AppShell
      title="Sales CRM"
      subtitle={
        isManager
          ? 'Invoices & upsells · assign PMs · manager queue'
          : isPm
            ? 'Assign revisions to Design or Development · dialer · client follow-up'
            : 'Submit new leads — routed to Sales Manager'
      }
    >
      {msg && <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{msg}</p>}
      {callReminder && (
        <p className="mb-4 text-sm text-amber-900 bg-amber-100 border border-amber-300 px-3 py-2 rounded-lg font-medium">
          Reminder: {callReminder}
        </p>
      )}

      {isPm && (
        <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Project Manager — add a revision:</strong> click tab{' '}
          <button type="button" onClick={() => setTab('revisions')} className="font-bold underline text-amber-800">
            Revisions (assign crew)
          </button>
          , pick your project, choose <strong>Design</strong> or <strong>Development</strong> — the department <strong>Head</strong> assigns the junior in Production → Head queue.
          Login: <span className="font-mono">sales.project_manager@ops.test</span>
        </div>
      )}

      {dash && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {dash.role === 'manager' && (
            <>
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-slate-500">Awaiting manager</p>
                <p className="text-2xl font-bold text-amber-600">{dash.pending}</p>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-slate-500">With PM</p>
                <p className="text-2xl font-bold text-brand-600">{dash.active}</p>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-slate-500">Open projects</p>
                <p className="text-2xl font-bold">{dash.projects}</p>
              </div>
            </>
          )}
          {dash.role === 'pm' && (
            <>
              <div className="bg-white border rounded-lg p-4 col-span-2">
                <p className="text-sm text-slate-500">Active projects</p>
                <p className="text-2xl font-bold text-brand-600">{dash.projects}</p>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-slate-500">Client revisions open</p>
                <p className="text-2xl font-bold text-amber-600">{dash.openRevisions}</p>
              </div>
            </>
          )}
          {dash.role === 'finder' && (
            <div className="bg-white border rounded-lg p-4 col-span-3">
              <p className="text-sm text-slate-500">Leads submitted</p>
              <p className="text-2xl font-bold">{dash.submitted}</p>
            </div>
          )}
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'billing' && isManager && (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
            <strong>Sales Manager — invoice & upsell:</strong> pick the <strong>account (client)</strong> below, then use Generate invoice or Add upsell on the right.
            Each lead has its own project — you must select one before creating billing.
          </div>

          <label className="block bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-bold uppercase text-indigo-800">Select account / project</span>
            <select
              value={billingProjectId || ''}
              onChange={(e) => setBillingProjectId(+e.target.value)}
              className="mt-2 w-full border rounded-lg px-3 py-3 text-base font-medium"
            >
              <option value="">— Choose client —</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client.contactName}
                  {p.client.contactName !== p.title ? ` · ${p.title}` : ''} ({p.projectCode})
                  {p.lifecycle === 'completed' ? ' — completed' : ''}
                </option>
              ))}
            </select>
          </label>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <p className="px-4 py-3 bg-indigo-50 text-xs font-bold uppercase text-indigo-800">
                All accounts ({allProjects.length})
              </p>
              <div className="max-h-[400px] overflow-auto divide-y">
                {allProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBillingProjectId(p.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-brand-50 ${billingProjectId === p.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}
                  >
                    <p className="font-medium text-sm">{p.client.contactName}</p>
                    <p className="font-mono text-xs text-slate-500">{p.projectCode}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p._count.invoices} invoice{p._count.invoices !== 1 ? 's' : ''}
                      {p.lifecycle === 'completed' && (
                        <span className="ml-1 text-slate-400">· completed (upsell OK)</span>
                      )}
                    </p>
                  </button>
                ))}
                {allProjects.length === 0 && (
                  <p className="p-4 text-sm text-slate-500">No projects yet. Submit leads from Lead Finder first.</p>
                )}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Recent invoices — click to select account</p>
              <ul className="space-y-2 max-h-48 overflow-auto text-sm">
                {invoices.slice(0, 15).map((inv) => (
                  <li key={inv.id}>
                    <button
                      type="button"
                      onClick={() => inv.project?.id && setBillingProjectId(inv.project.id)}
                      className={`w-full flex justify-between gap-2 border-b pb-2 text-left hover:bg-slate-50 rounded px-1 ${
                        inv.project?.id === billingProjectId ? 'bg-brand-50' : ''
                      }`}
                    >
                      <span>
                        <span className="font-mono text-xs block">
                          {inv.invoiceNumber}
                          {inv.isUpsell ? ' ↑' : ''}
                        </span>
                        <span className="text-xs text-slate-500">{inv.client.contactName}</span>
                      </span>
                      <StatusBadge status={inv.status} />
                    </button>
                  </li>
                ))}
                {invoices.length === 0 && <li className="text-slate-400">No invoices yet</li>}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {billingProject ? (
              <>
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <p className="text-xs text-slate-500">{billingProject.projectCode}</p>
                  <h2 className="text-xl font-bold">{billingProject.client.contactName}</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    PM: {billingProject.projectManager?.name || 'Unassigned'} ·{' '}
                    <span className="capitalize">{billingProject.projectCategory}</span>
                  </p>
                  <Link href={`/projects/${billingProject.id}`} className="text-sm text-brand-600 font-medium mt-2 inline-block hover:underline">
                    Open full project hub →
                  </Link>
                </div>

                {canInvoice && (
                  <form onSubmit={createInvoice} className="bg-white border-2 border-brand-200 rounded-xl p-6 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-brand-800">Generate invoice</h3>
                    <p className="text-sm text-slate-600">Sales Manager only — creates invoice on this project. Mark paid to start production.</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      <label className="block text-sm md:col-span-2">
                        Description
                        <input
                          value={invForm.description}
                          onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                          className="mt-1 w-full border rounded-lg px-3 py-2"
                          required
                        />
                      </label>
                      <label className="block text-sm">
                        Quantity
                        <input
                          type="number"
                          min={1}
                          value={invForm.quantity}
                          onChange={(e) => setInvForm({ ...invForm, quantity: +e.target.value })}
                          className="mt-1 w-full border rounded-lg px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        Unit price ($)
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={invForm.unitPrice}
                          onChange={(e) => setInvForm({ ...invForm, unitPrice: +e.target.value })}
                          className="mt-1 w-full border rounded-lg px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        Service category
                        <select
                          value={invForm.projectCategory}
                          onChange={(e) => setInvForm({ ...invForm, projectCategory: e.target.value as typeof invForm.projectCategory })}
                          className="mt-1 w-full border rounded-lg px-3 py-2"
                        >
                          <option value="design">Design</option>
                          <option value="development">Development</option>
                          <option value="combo">Combo</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input
                          type="checkbox"
                          checked={invForm.markPaid}
                          onChange={(e) => setInvForm({ ...invForm, markPaid: e.target.checked })}
                        />
                        Mark paid now → activate production delivery
                      </label>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Total: ${(invForm.quantity * invForm.unitPrice).toFixed(2)}
                    </p>
                    <button type="submit" className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">
                      Create invoice
                    </button>
                  </form>
                )}

                {canUpsell && (
                  <form onSubmit={addUpsell} className="bg-white border-2 border-emerald-200 rounded-xl p-6 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-emerald-800">Add upsell</h3>
                    <p className="text-sm text-slate-600">Additional paid scope — adds to project budget.</p>
                    <label className="block text-sm">
                      Description
                      <input
                        value={upsellForm.description}
                        onChange={(e) => setUpsellForm({ ...upsellForm, description: e.target.value })}
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        required
                      />
                    </label>
                    <label className="block text-sm">
                      Amount ($)
                      <input
                        type="number"
                        min={1}
                        value={upsellForm.amount}
                        onChange={(e) => setUpsellForm({ ...upsellForm, amount: +e.target.value })}
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        required
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={upsellForm.markPaid}
                        onChange={(e) => setUpsellForm({ ...upsellForm, markPaid: e.target.checked })}
                      />
                      Paid now
                    </label>
                    <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">
                      Add upsell to project
                    </button>
                  </form>
                )}
              </>
            ) : (
              <p className="text-slate-500 p-8 bg-white border rounded-xl">
                Select an account from the dropdown above or the list on the left to generate an invoice or upsell.
              </p>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === 'portfolio' && isManager && (
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <strong>Sales Manager — project portfolio:</strong> all accounts grouped by stage. <strong>Last payment</strong> shows
            the most recent Accounts payment or invoice marked paid.
          </div>
          {portfolio ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-slate-500">Ongoing</p>
                  <p className="text-2xl font-bold text-brand-600">{portfolio.ongoing.length}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-slate-500">Past / prospect</p>
                  <p className="text-2xl font-bold text-slate-600">{portfolio.past.length}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-sm text-slate-500">Closed</p>
                  <p className="text-2xl font-bold text-emerald-700">{portfolio.closed.length}</p>
                </div>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <p className="px-4 py-3 bg-brand-50 text-xs font-bold uppercase text-brand-800">Ongoing projects</p>
                <PortfolioTable rows={portfolio.ongoing} showPm />
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <p className="px-4 py-3 bg-slate-100 text-xs font-bold uppercase text-slate-700">Past / not yet in delivery</p>
                <PortfolioTable rows={portfolio.past} showPm />
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <p className="px-4 py-3 bg-emerald-50 text-xs font-bold uppercase text-emerald-800">Closed projects</p>
                <PortfolioTable rows={portfolio.closed} showPm />
              </div>
            </>
          ) : (
            <p className="text-slate-500">Loading portfolio…</p>
          )}
        </div>
      )}

      {tab === 'scheduled-calls' && isPm && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={scheduleCall} className="bg-white border-2 border-sky-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-sky-900">Schedule a client call</h2>
              <p className="text-sm text-slate-600">
                You will get in-app reminders <strong>15 minutes</strong> and <strong>5 minutes</strong> before the call.
              </p>
              <label className="block text-sm">
                Project (optional)
                <select
                  value={callForm.projectId || ''}
                  onChange={(e) => setCallForm({ ...callForm, projectId: +e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value="">— General call —</option>
                  {myProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.client.contactName} ({p.projectCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Title
                <input
                  value={callForm.title}
                  onChange={(e) => setCallForm({ ...callForm, title: e.target.value })}
                  placeholder="e.g. Kickoff with client"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                Date & time
                <input
                  type="datetime-local"
                  value={callForm.scheduledAt}
                  onChange={(e) => setCallForm({ ...callForm, scheduledAt: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                Notes
                <textarea
                  value={callForm.notes}
                  onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </label>
              <button type="submit" className="w-full py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700">
                Schedule call
              </button>
            </form>
          </div>
          <div className="lg:col-span-7 bg-white border rounded-xl overflow-hidden shadow-sm">
            <p className="px-4 py-3 bg-sky-50 text-xs font-bold uppercase text-sky-900">Upcoming & recent calls</p>
            <div className="divide-y max-h-[560px] overflow-auto">
              {scheduledCalls.map((c) => {
                const at = new Date(c.scheduledAt);
                const minsUntil = Math.round((at.getTime() - Date.now()) / 60000);
                return (
                  <div key={c.id} className="px-4 py-4 flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-slate-600">{at.toLocaleString()}</p>
                      {c.project && (
                        <p className="text-xs text-slate-500">
                          {c.project.client.contactName} · {c.project.projectCode}
                        </p>
                      )}
                      {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
                      {c.status === 'scheduled' && minsUntil > 0 && minsUntil <= 20 && (
                        <p className="text-xs text-amber-700 mt-1 font-medium">Starts in {minsUntil} min</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Reminders: {c.reminder15Sent ? '15m ✓' : '15m —'} · {c.reminder5Sent ? '5m ✓' : '5m —'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <StatusBadge status={c.status} />
                      {c.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateCallStatus(c.id, 'completed')}
                            className="text-xs text-emerald-700 font-medium hover:underline"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCallStatus(c.id, 'cancelled')}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {scheduledCalls.length === 0 && (
                <p className="p-6 text-sm text-slate-500">No scheduled calls yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'revisions' && isPm && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border rounded-xl overflow-hidden shadow-sm">
            <p className="px-4 py-3 bg-amber-50 text-xs font-bold uppercase text-amber-900">Your projects</p>
            <div className="max-h-[480px] overflow-auto divide-y">
              {myProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRevProjectId(p.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-brand-50 ${revProjectId === p.id ? 'bg-brand-50 border-l-4 border-amber-600' : ''}`}
                >
                  <p className="font-mono text-xs">{p.projectCode}</p>
                  <p className="font-medium text-sm">{p.client.contactName}</p>
                  <p className="text-xs text-slate-500 capitalize">{p.projectCategory} · {p._count.revisions} revisions</p>
                </button>
              ))}
              {myProjects.length === 0 && (
                <p className="p-4 text-sm text-slate-500">No projects yet. Sales Manager must assign you as PM first.</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border-2 border-amber-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-amber-900 mb-1">Client revision (project category)</h2>
              <p className="text-sm text-slate-600 mb-4">
                Standard revision — department must match project type (design / dev / combo).
              </p>
              {!canAssignRev && (
                <p className="mb-4 text-red-700 text-sm bg-red-50 p-3 rounded-lg">
                  Missing permission. Log out, run <code className="font-mono">npm run db:reset</code> in v2, log in again as Project Manager.
                </p>
              )}
              {canAssignRev && (
                <PmRevisionForm
                  projectId={revProjectId}
                  onSuccess={() => {
                    setMsg('Revision opened and assigned to production');
                    loadPm();
                  }}
                />
              )}
            </div>

            <div className="bg-white border-2 border-violet-300 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-violet-900 mb-1">Additional revision (any department)</h2>
              <p className="text-sm text-slate-600 mb-4">
                Extra scope — assign to <strong>Design</strong> or <strong>Development</strong> regardless of project category.
              </p>
              {canAssignRev && (
                <PmAdditionalRevisionForm
                  projectId={revProjectId}
                  onSuccess={() => {
                    setMsg('Additional revision opened and assigned');
                    loadPm();
                  }}
                />
              )}
            </div>

            {revProjectId > 0 && (
              <Link href={`/projects/${revProjectId}`} className="inline-block text-sm text-brand-600 hover:underline">
                View full revision history on project hub →
              </Link>
            )}
          </div>
        </div>
      )}

      {tab === 'csv' && isFinder && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!csvFile) return;
            const fd = new FormData();
            fd.append('file', csvFile);
            const token = localStorage.getItem('accessToken');
            const res = await fetch('/api/v1/sales/leads/import', {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            const data = await res.json();
            setMsg(`Imported ${data.imported} of ${data.total} leads to manager queue`);
            setCsvFile(null);
          }}
          className="bg-white border rounded-xl p-6 max-w-xl space-y-4"
        >
          <p className="text-sm text-slate-600">Bulk CSV import. Columns: contact_name, company_name, email, phone, source, notes</p>
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium">
            Upload CSV
          </button>
        </form>
      )}

      {tab === 'dialer' && isPm && (
        <div className="bg-white rounded-xl border shadow-sm grid lg:grid-cols-12 min-h-[480px]">
          <div className="lg:col-span-4 border-r divide-y max-h-[520px] overflow-auto">
            <p className="px-4 py-3 bg-slate-50 text-xs font-semibold uppercase text-slate-500">Dialer queue</p>
            {dialerLeads.map((l) => (
              <button key={l.id} type="button" onClick={() => setSelectedDialer(l)} className={`w-full text-left px-4 py-3 hover:bg-brand-50 ${selectedDialer?.id === l.id ? 'bg-brand-50' : ''}`}>
                <p className="font-medium">{l.contactName}</p>
                <p className="text-xs text-slate-500">{l.leadCode}</p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-8 p-5">
            {selectedDialer?.project ? (
              <>
                <h3 className="font-bold">{selectedDialer.contactName}</h3>
                <Link href={`/projects/${selectedDialer.project.id}`} className="text-brand-600 text-sm font-medium">
                  Open project hub →
                </Link>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {['no_answer', 'voicemail', 'not_interested', 'ready_to_buy'].map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={async () => {
                        await api(`/api/v1/sales/leads/${selectedDialer.id}/call`, { method: 'POST', body: JSON.stringify({ outcome: o }) });
                        loadPm();
                      }}
                      className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 capitalize"
                    >
                      {o.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Select a lead.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'submit' && isFinder && (
        <form onSubmit={submitLead} className="bg-white border rounded-xl p-6 max-w-xl space-y-4 shadow-sm">
          <p className="text-sm text-slate-600">Creates a project and sends the lead to Sales Manager.</p>
          {(['contactName', 'companyName', 'phone', 'email'] as const).map((f) => (
            <label key={f} className="block text-sm capitalize">
              {f.replace(/([A-Z])/g, ' $1')}
              <input
                required={f === 'contactName'}
                value={newLead[f]}
                onChange={(e) => setNewLead({ ...newLead, [f]: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
          ))}
          <label className="block text-sm">
            Project type
            <select value={newLead.projectCategory} onChange={(e) => setNewLead({ ...newLead, projectCategory: e.target.value as 'development' })} className="mt-1 w-full border rounded-lg px-3 py-2">
              <option value="design">Design</option>
              <option value="development">Development</option>
              <option value="combo">Combo</option>
            </select>
          </label>
          <textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Notes" className="w-full border rounded-lg px-3 py-2" rows={3} />
          <button type="submit" className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-semibold">
            Submit to Sales Manager
          </button>
        </form>
      )}

      {tab === 'manager' && isManager && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <p className="px-4 py-3 bg-slate-50 text-xs font-semibold uppercase text-slate-500">Pending approval</p>
            {managerLeads.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLead(l)}
                className={`w-full text-left px-4 py-3 border-t hover:bg-brand-50 ${selectedLead?.id === l.id ? 'bg-brand-50' : ''}`}
              >
                <p className="font-medium">{l.contactName}</p>
                <p className="text-xs text-slate-500">{l.leadCode} · {l.project?.projectCode}</p>
                <StatusBadge status={l.status} />
              </button>
            ))}
            {managerLeads.length === 0 && <p className="p-6 text-sm text-slate-500">No leads waiting.</p>}
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            {selectedLead?.project ? (
              <>
                <h3 className="font-bold">{selectedLead.contactName}</h3>
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Assign Project Manager</p>
                  <select value={pmId} onChange={(e) => setPmId(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value={0}>Select PM</option>
                    {pms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={assignPm} className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                    Assign PM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingProjectId(selectedLead.project!.id);
                      setTab('billing');
                    }}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
                  >
                    Invoice & upsell this project
                  </button>
                  <Link href={`/projects/${selectedLead.project.id}`} className="block text-center text-sm text-brand-600 hover:underline">
                    Open project hub
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Select a lead.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'projects' && isManager && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">PM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {allProjects.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{p.projectCode}</td>
                  <td className="px-4 py-3">{p.client.contactName}</td>
                  <td className="px-4 py-3">{p.projectManager?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setBillingProjectId(p.id);
                        setTab('billing');
                      }}
                      className="text-indigo-600 font-medium hover:underline"
                    >
                      Invoice
                    </button>
                    <Link href={`/projects/${p.id}`} className="text-brand-600 font-medium hover:underline">
                      Hub
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allProjects.length === 0 && <p className="p-6 text-slate-500">No projects yet.</p>}
        </div>
      )}

      {tab === 'projects' && isPm && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {myProjects.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{p.projectCode}</td>
                  <td className="px-4 py-3">{p.client.contactName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRevProjectId(p.id);
                        setTab('revisions');
                      }}
                      className="text-amber-700 font-medium hover:underline"
                    >
                      Add revision
                    </button>
                    <Link href={`/projects/${p.id}`} className="text-brand-600 font-medium hover:underline">
                      Hub
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {myProjects.length === 0 && <p className="p-6 text-slate-500">No projects assigned yet.</p>}
        </div>
      )}
    </AppShell>
  );
}
