'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api } from '@/lib/api';

type Portal = {
  profile: {
    name: string;
    email: string;
    isActive: boolean;
    employmentStatus: string;
    department: { name: string };
    designation: { name: string };
    team?: { name: string } | null;
    manager?: { name: string } | null;
    employee?: {
      employeeCode: string;
      phone?: string | null;
      dateOfJoining?: string | null;
      employmentType: string;
      personalEmail?: string | null;
      emergencyContact?: string | null;
      address?: string | null;
    } | null;
  };
  leave: {
    balance: {
      annual: { allowance: number; used: number; remaining: number };
      sick: { allowance: number; used: number; remaining: number };
    };
    requests: { id: number; leaveType: string; startDate: string; endDate: string; days: number; status: string; reason?: string }[];
    pendingCount: number;
  };
  payroll: {
    baseSalary: number;
    currency: string;
    payFrequency: string;
    bankName?: string | null;
    bankLast4?: string | null;
    latestNet: number | null;
    ytdNet: number;
  } | null;
  salarySlips: {
    id: number;
    periodLabel: string;
    grossPay: number;
    deductions: number;
    netPay: number;
    allowances?: string | null;
    notes?: string | null;
    issuedAt: string;
  }[];
  attendance: {
    today?: { status: string; checkIn?: string; checkOut?: string } | null;
    thisMonth: { workDate: string; status: string }[];
  };
  cafeteria: {
    breakfast?: string | null;
    lunch?: string | null;
    dinner?: string | null;
    snacks?: string | null;
    notes?: string | null;
  } | null;
};

export default function MyHrmsPage() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [selectedSlip, setSelectedSlip] = useState<Portal['salarySlips'][0] | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'annual' as 'annual' | 'sick',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const load = useCallback(() => {
    api<Portal>('/api/v1/hr/me')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load HRMS'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function requestLeave(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/api/v1/hr/me/leave', { method: 'POST', body: JSON.stringify(leaveForm) });
      setMsg('Leave request submitted — HR will review');
      setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  if (error && !data) {
    return (
      <AppShell title="My HRMS" subtitle="Personal HR portal">
        <p className="text-red-600 text-sm">{error}</p>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="My HRMS" subtitle="Loading your HR profile…">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  const p = data.profile;
  const emp = p.employee;

  return (
    <AppShell title="My HRMS" subtitle="Your profile, leave, payroll, salary slips & today's cafeteria menu">
      {msg && <p className="mb-3 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'profile', label: 'My details' },
          { id: 'leave', label: `Leave (${data.leave.pendingCount} pending)` },
          { id: 'payroll', label: 'Payroll & slips' },
          { id: 'meals', label: "Today's menu" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase">Employment status</p>
            <p className="mt-1">
              <StatusBadge status={p.employmentStatus} />
            </p>
            <p className="text-sm mt-2 text-slate-600">{p.designation.name}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase">Annual leave left</p>
            <p className="text-2xl font-bold text-brand-600">{data.leave.balance.annual.remaining}</p>
            <p className="text-xs text-slate-500">of {data.leave.balance.annual.allowance} days</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase">Sick leave left</p>
            <p className="text-2xl font-bold text-amber-600">{data.leave.balance.sick.remaining}</p>
            <p className="text-xs text-slate-500">of {data.leave.balance.sick.allowance} days</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase">Latest net pay</p>
            <p className="text-2xl font-bold text-emerald-600">
              {data.payroll?.latestNet != null
                ? `${data.payroll.currency} ${data.payroll.latestNet.toLocaleString()}`
                : '—'}
            </p>
            <p className="text-xs text-slate-500">YTD: {data.payroll?.ytdNet?.toLocaleString() ?? '—'}</p>
          </div>
          {data.cafeteria && (
            <div className="md:col-span-2 lg:col-span-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
              <p className="text-xs font-bold uppercase text-orange-800 mb-2">Today's cafeteria menu</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="font-medium">Breakfast</span>
                  <p className="text-slate-700">{data.cafeteria.breakfast || '—'}</p>
                </div>
                <div>
                  <span className="font-medium">Lunch</span>
                  <p className="text-slate-700">{data.cafeteria.lunch || '—'}</p>
                </div>
                <div>
                  <span className="font-medium">Snacks</span>
                  <p className="text-slate-700">{data.cafeteria.snacks || '—'}</p>
                </div>
                <div>
                  <span className="font-medium">Dinner</span>
                  <p className="text-slate-700">{data.cafeteria.dinner || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'profile' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm max-w-2xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="text-sm text-slate-500 font-mono">{emp?.employeeCode}</p>
            </div>
            <StatusBadge status={p.employmentStatus} />
          </div>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Work email</dt>
              <dd className="font-medium">{p.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Department</dt>
              <dd className="font-medium">{p.department.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium">{p.designation.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Team</dt>
              <dd>{p.team?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Manager</dt>
              <dd>{p.manager?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Joined</dt>
              <dd>{emp?.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd>{emp?.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Employment</dt>
              <dd className="capitalize">{emp?.employmentType?.replace(/_/g, ' ') || '—'}</dd>
            </div>
          </dl>
          {data.attendance.today && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Today attendance</p>
              <StatusBadge status={data.attendance.today.status} />
              {data.attendance.today.checkIn && (
                <p className="text-sm text-slate-600 mt-1">
                  {data.attendance.today.checkIn} – {data.attendance.today.checkOut || '…'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4">
                <p className="text-sm text-slate-500">Annual leave</p>
                <p className="text-lg font-bold">
                  {data.leave.balance.annual.remaining} <span className="text-sm font-normal text-slate-500">remaining</span>
                </p>
                <p className="text-xs text-slate-500">
                  Used {data.leave.balance.annual.used} / {data.leave.balance.annual.allowance}
                </p>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <p className="text-sm text-slate-500">Sick leave</p>
                <p className="text-lg font-bold">
                  {data.leave.balance.sick.remaining} <span className="text-sm font-normal text-slate-500">remaining</span>
                </p>
                <p className="text-xs text-slate-500">
                  Used {data.leave.balance.sick.used} / {data.leave.balance.sick.allowance}
                </p>
              </div>
            </div>
            <form onSubmit={requestLeave} className="bg-white border rounded-xl p-5 space-y-3 shadow-sm">
              <h3 className="font-bold">Request leave</h3>
              <select
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as 'annual' | 'sick' })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="annual">Annual leave</option>
                <option value="sick">Sick leave</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
              <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                Submit request
              </button>
            </form>
          </div>
          <div className="bg-white border rounded-xl divide-y max-h-[520px] overflow-auto shadow-sm">
            <p className="px-4 py-3 bg-slate-50 text-xs font-bold uppercase">My leave history</p>
            {data.leave.requests.map((l) => (
              <div key={l.id} className="px-4 py-3 flex justify-between gap-2">
                <div>
                  <p className="font-medium capitalize">{l.leaveType}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()} · {l.days}d
                  </p>
                  {l.reason && <p className="text-xs text-slate-600 mt-1">{l.reason}</p>}
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
            {data.leave.requests.length === 0 && <p className="p-4 text-sm text-slate-500">No leave requests yet.</p>}
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold">Payroll summary</h3>
            {data.payroll ? (
              <>
                <p className="text-sm text-slate-500">Base salary (monthly)</p>
                <p className="text-2xl font-bold">
                  {data.payroll.currency} {data.payroll.baseSalary.toLocaleString()}
                </p>
                <p className="text-sm">
                  Pay frequency: <span className="capitalize">{data.payroll.payFrequency}</span>
                </p>
                {data.payroll.bankName && (
                  <p className="text-sm text-slate-600">
                    Bank: {data.payroll.bankName} ****{data.payroll.bankLast4}
                  </p>
                )}
                <p className="text-sm border-t pt-3">
                  Year-to-date net: <strong>{data.payroll.currency} {data.payroll.ytdNet.toLocaleString()}</strong>
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Payroll not configured — contact HR.</p>
            )}
          </div>
          <div className="lg:col-span-2 bg-white border rounded-xl overflow-hidden shadow-sm">
            <p className="px-4 py-3 bg-slate-50 text-xs font-bold uppercase">Salary slips</p>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-right">Gross</th>
                  <th className="px-4 py-2 text-right">Deductions</th>
                  <th className="px-4 py-2 text-right">Net</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.salarySlips.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{s.periodLabel}</td>
                    <td className="px-4 py-3 text-right">${s.grossPay.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">${s.deductions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">${s.netPay.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setSelectedSlip(s)} className="text-brand-600 text-xs font-medium hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.salarySlips.length === 0 && <p className="p-6 text-sm text-slate-500">No salary slips published yet.</p>}
          </div>
        </div>
      )}

      {tab === 'meals' && (
        <div className="max-w-2xl bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Today's cafeteria menu</h3>
          {data.cafeteria ? (
            <div className="space-y-4">
              {[
                ['Breakfast', data.cafeteria.breakfast],
                ['Lunch', data.cafeteria.lunch],
                ['Snacks', data.cafeteria.snacks],
                ['Dinner', data.cafeteria.dinner],
              ].map(([label, val]) => (
                <div key={label} className="border-b pb-3 last:border-0">
                  <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                  <p className="text-slate-800 mt-1">{val || 'Not scheduled'}</p>
                </div>
              ))}
              {data.cafeteria.notes && <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{data.cafeteria.notes}</p>}
            </div>
          ) : (
            <p className="text-slate-500">No menu posted for today. Check back later or ask HR.</p>
          )}
        </div>
      )}

      {selectedSlip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="font-bold text-lg">Salary slip — {selectedSlip.periodLabel}</h3>
            <p className="text-xs text-slate-500">Issued {new Date(selectedSlip.issuedAt).toLocaleDateString()}</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt>Gross pay</dt>
                <dd className="font-medium">${selectedSlip.grossPay.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between text-red-700">
                <dt>Deductions</dt>
                <dd>-${selectedSlip.deductions.toLocaleString()}</dd>
              </div>
              {selectedSlip.allowances && (
                <div className="text-slate-600">
                  <dt>Allowances</dt>
                  <dd>{selectedSlip.allowances}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-bold text-emerald-800">
                <dt>Net pay</dt>
                <dd>${selectedSlip.netPay.toLocaleString()}</dd>
              </div>
            </dl>
            {selectedSlip.notes && <p className="text-xs text-slate-500">{selectedSlip.notes}</p>}
            <button type="button" onClick={() => setSelectedSlip(null)} className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
