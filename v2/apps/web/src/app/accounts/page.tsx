'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api, can, loadUser } from '@/lib/api';
import { PERMISSIONS } from '@ops/shared';

type Invoice = {
  id: number;
  invoiceNumber: string;
  status: string;
  total: number | string;
  amountPaid: number | string;
  client: { contactName: string };
};
type Approval = { id: number; type: string; entityType: string; entityId: number; status: string; reason?: string; createdAt: string };

function summaryFromInvoices(invoices: Invoice[]) {
  let collected = 0;
  let outstanding = 0;
  let partialBalance = 0;
  for (const inv of invoices) {
    const total = Number(inv.total);
    const paid = Number(inv.amountPaid);
    collected += paid;
    const due = Math.max(0, total - paid);
    if (inv.status === 'partial') partialBalance += due;
    else if (inv.status !== 'paid') outstanding += due;
  }
  return { paidTotal: collected, unpaidTotal: outstanding, partialPaid: partialBalance };
}

export default function AccountsPage() {
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [summary, setSummary] = useState({ paidTotal: 0, unpaidTotal: 0, partialPaid: 0 });
  const [payModal, setPayModal] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const perms = loadUser()?.permissions ?? [];
  const canRecordPayment = can(perms, PERMISSIONS.ACC_PAYMENTS_RECORD) || can(perms, PERMISSIONS.SUPER_ALL);
  const canApprove = can(perms, PERMISSIONS.ACC_REFUND_APPROVE) || can(perms, PERMISSIONS.SUPER_ALL);

  const reload = async () => {
    setError('');
    try {
      const invs = await api<Invoice[]>('/api/v1/accounts/invoices');
      setInvoices(invs);
      setSummary(summaryFromInvoices(invs));
      try {
        const s = await api<typeof summary>('/api/v1/accounts/reports/summary');
        setSummary({
          paidTotal: Number(s.paidTotal),
          unpaidTotal: Number(s.unpaidTotal),
          partialPaid: Number(s.partialPaid),
        });
      } catch {
        /* keep client-computed summary */
      }
      if (canApprove) {
        const a = await api<Approval[]>('/api/v1/accounts/approvals');
        setApprovals(a);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts data');
    }
  };

  useEffect(() => {
    reload();
  }, []);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    if (!canRecordPayment) {
      setError('Only Accounts staff can record payments. Sign in as accounts.accounts_exec@ops.test');
      return;
    }
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api('/api/v1/accounts/payments', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: payModal.id, amount, method: 'bank' }),
      });
      setPayModal(null);
      setSuccess(`Payment of $${amount.toFixed(2)} recorded for ${payModal.invoiceNumber}`);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      setError(
        msg.includes('Forbidden')
          ? 'You do not have permission to record payments. Use an Accounts login (accounts.accounts_exec@ops.test).'
          : msg
      );
    } finally {
      setSaving(false);
    }
  }

  async function resolveApproval(id: number, approve: boolean) {
    try {
      await api(`/api/v1/accounts/approvals/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve approval');
    }
  }

  return (
    <AppShell title="Accounts" subtitle="Payments · reconciliation · approve Sales Manager refund/chargeback requests">
      {!canRecordPayment && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>View only:</strong> your role can see invoices but cannot record payments. Sign in as{' '}
          <code className="font-mono text-xs">accounts.accounts_exec@ops.test</code> (password <code className="font-mono">demo123</code>).
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-sm text-emerald-700">Collected (paid)</p>
          <p className="text-2xl font-bold">${Number(summary.paidTotal).toFixed(2)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">Outstanding</p>
          <p className="text-2xl font-bold">${Number(summary.unpaidTotal).toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Partial — balance due</p>
          <p className="text-2xl font-bold">${Number(summary.partialPaid).toFixed(2)}</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'invoices', label: 'All invoices' },
          { id: 'approvals', label: `Approvals (${approvals.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'invoices' && (
        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const balance = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
                return (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.client.contactName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">${Number(inv.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${Number(inv.amountPaid).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${balance.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {inv.status !== 'paid' && canRecordPayment && balance > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayModal(inv);
                            setPayAmount(String(balance));
                            setError('');
                          }}
                          className="text-brand-600 hover:underline text-xs font-medium"
                        >
                          Record payment
                        </button>
                      )}
                      {inv.status !== 'paid' && !canRecordPayment && (
                        <span className="text-xs text-slate-400">Accounts only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-3">
          {!canApprove && (
            <p className="text-sm text-slate-500">Approvals require Accounts Manager role.</p>
          )}
          {canApprove && approvals.length === 0 && <p className="text-sm text-slate-500">No pending approvals.</p>}
          {canApprove &&
            approvals.map((a) => (
              <div key={a.id} className="bg-white border rounded-lg p-4 flex justify-between items-start shadow-sm">
                <div>
                  <p className="font-medium capitalize">
                    {a.type} — {a.entityType} #{a.entityId}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{a.reason}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resolveApproval(a.id, true)} className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">
                    Approve
                  </button>
                  <button type="button" onClick={() => resolveApproval(a.id, false)} className="px-3 py-1.5 bg-slate-200 text-sm rounded-lg">
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={recordPayment} className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold">Record payment — {payModal.invoiceNumber}</h3>
            <p className="text-sm text-slate-600">
              Balance due: ${Math.max(0, Number(payModal.total) - Number(payModal.amountPaid)).toFixed(2)}
            </p>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setPayModal(null); setError(''); }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
