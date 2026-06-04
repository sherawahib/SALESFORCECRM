'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api } from '@/lib/api';
import { DEMO_PASSWORD } from '@ops/shared';

type Dashboard = {
  total: number;
  active: number;
  onLeave: number;
  pendingLeave: number;
  todayAttendance: number;
  byDept: { id: number; name: string; _count: { users: number } }[];
};

type Employee = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  department: { id: number; name: string; slug: string };
  designation: { id: number; name: string; slug: string };
  team?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  employeeProfile?: {
    employeeCode: string;
    phone?: string | null;
    dateOfJoining?: string | null;
    employmentType: string;
    employmentStatus: string;
  } | null;
};

type OrgStructure = {
  departments: { id: number; name: string; slug: string; designations: { id: number; name: string; slug: string }[] }[];
  teams: { id: number; name: string; department: { name: string } }[];
  managers: { id: number; name: string }[];
};

type LeaveRow = {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string;
  user: { id: number; name: string };
};

type AttendanceRow = {
  id: number;
  workDate: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  user: { name: string; employeeProfile?: { employeeCode: string } | null };
};

const emptyForm = {
  name: '',
  email: '',
  password: DEMO_PASSWORD,
  departmentId: 0,
  designationId: 0,
  teamId: 0,
  managerId: 0,
  phone: '',
  dateOfJoining: new Date().toISOString().slice(0, 10),
  employmentType: 'full_time' as const,
  employmentStatus: 'active' as const,
  emergencyContact: '',
  notes: '',
};

export default function HrPage() {
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [credModal, setCredModal] = useState<{ email: string; password: string } | null>(null);

  const [leaveForm, setLeaveForm] = useState({
    userId: 0,
    leaveType: 'annual' as const,
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [attForm, setAttForm] = useState({
    userId: 0,
    workDate: new Date().toISOString().slice(0, 10),
    status: 'present' as const,
    checkIn: '09:00',
    checkOut: '18:00',
  });

  const reload = useCallback(() => {
    api<Dashboard>('/api/v1/hr/dashboard').then(setDash).catch(console.error);
    api<Employee[]>('/api/v1/hr/employees').then(setEmployees).catch(console.error);
    api<OrgStructure>('/api/v1/hr/org-structure').then(setOrg).catch(console.error);
    api<LeaveRow[]>('/api/v1/hr/leave').then(setLeaves).catch(console.error);
    api<AttendanceRow[]>('/api/v1/hr/attendance').then(setAttendance).catch(console.error);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const deptDesignations =
    org?.departments.find((d) => d.id === form.departmentId)?.designations ?? [];
  const isProduction = org?.departments.find((d) => d.id === form.departmentId)?.slug === 'production';

  function openCreate() {
    setEditId(0);
    setForm({
      ...emptyForm,
      departmentId: org?.departments[0]?.id ?? 0,
      designationId: org?.departments[0]?.designations[0]?.id ?? 0,
    });
    setShowForm(true);
    setError('');
  }

  function openEdit(e: Employee) {
    setEditId(e.id);
    setForm({
      name: e.name,
      email: e.email,
      password: '',
      departmentId: e.department.id,
      designationId: e.designation.id,
      teamId: e.team?.id ?? 0,
      managerId: e.manager?.id ?? 0,
      phone: e.employeeProfile?.phone ?? '',
      dateOfJoining: e.employeeProfile?.dateOfJoining
        ? new Date(e.employeeProfile.dateOfJoining).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      employmentType: (e.employeeProfile?.employmentType as 'full_time') || 'full_time',
      employmentStatus: (e.employeeProfile?.employmentStatus as 'active') || 'active',
      emergencyContact: '',
      notes: '',
    });
    setShowForm(true);
    setError('');
  }

  async function saveEmployee(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        teamId: form.teamId || null,
        managerId: form.managerId || null,
        email: form.email.trim().toLowerCase(),
      };
      if (editId) {
        const body: Record<string, unknown> = { ...payload };
        if (!form.password) delete body.password;
        await api(`/api/v1/hr/employees/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMsg('Employee updated');
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        const res = await api<{ loginEmail: string; temporaryPassword: string }>('/api/v1/hr/employees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setCredModal({ email: res.loginEmail, password: res.temporaryPassword });
        setMsg('Employee created with login credentials');
      }
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function submitLeave(ev: React.FormEvent) {
    ev.preventDefault();
    await api('/api/v1/hr/leave', { method: 'POST', body: JSON.stringify(leaveForm) });
    setMsg('Leave request recorded');
    reload();
  }

  async function submitAttendance(ev: React.FormEvent) {
    ev.preventDefault();
    await api('/api/v1/hr/attendance', { method: 'POST', body: JSON.stringify(attForm) });
    setMsg('Attendance saved');
    reload();
  }

  return (
    <AppShell
      title="HR / HRMS"
      subtitle="Employee records · department & role assignment · login credentials · leave · attendance"
    >
      {msg && <p className="mb-3 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{msg}</p>}

      <Tabs
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'employees', label: `Employees (${employees.length})` },
          { id: 'leave', label: `Leave (${leaves.filter((l) => l.status === 'pending').length})` },
          { id: 'attendance', label: 'Attendance' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'dashboard' && dash && (
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-slate-500">Total employees</p>
            <p className="text-2xl font-bold">{dash.total}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{dash.active}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-slate-500">On leave</p>
            <p className="text-2xl font-bold text-amber-600">{dash.onLeave}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-slate-500">Pending leave requests</p>
            <p className="text-2xl font-bold text-brand-600">{dash.pendingLeave}</p>
          </div>
          <div className="md:col-span-4 bg-white border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-3">Headcount by department</p>
            <div className="flex flex-wrap gap-3">
              {dash.byDept.map((d) => (
                <span key={d.id} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
                  {d.name}: <strong>{d._count.users}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700"
          >
            + Add employee & create login
          </button>
          <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Login email</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{e.employeeProfile?.employeeCode || '—'}</td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.email}</td>
                    <td className="px-4 py-3">{e.department.name}</td>
                    <td className="px-4 py-3">{e.designation.name}</td>
                    <td className="px-4 py-3">
                      {e.isActive ? (
                        <StatusBadge status={e.employeeProfile?.employmentStatus || 'active'} />
                      ) : (
                        <StatusBadge status="terminated" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => openEdit(e)} className="text-brand-600 text-xs font-medium hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leave' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={submitLeave} className="bg-white border rounded-xl p-5 space-y-3 shadow-sm">
            <h3 className="font-bold">Record leave</h3>
            <label className="block text-sm">
              Employee
              <select
                value={leaveForm.userId}
                onChange={(e) => setLeaveForm({ ...leaveForm, userId: +e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                required
              >
                <option value={0}>— Select —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Type
              <select
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as typeof leaveForm.leaveType })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                From
                <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required />
              </label>
              <label className="block text-sm">
                To
                <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required />
              </label>
            </div>
            <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
              Save leave request
            </button>
          </form>
          <div className="bg-white border rounded-xl divide-y max-h-[480px] overflow-auto">
            {leaves.map((l) => (
              <div key={l.id} className="p-4 flex justify-between gap-2 items-start">
                <div>
                  <p className="font-medium">{l.user.name}</p>
                  <p className="text-xs text-slate-500 capitalize">
                    {l.leaveType} · {l.days} day(s) · {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <StatusBadge status={l.status} />
                  {l.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await api(`/api/v1/hr/leave/${l.id}/resolve`, { method: 'POST', body: JSON.stringify({ approve: true }) });
                          reload();
                        }}
                        className="text-xs text-emerald-600 font-medium"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await api(`/api/v1/hr/leave/${l.id}/resolve`, { method: 'POST', body: JSON.stringify({ approve: false }) });
                          reload();
                        }}
                        className="text-xs text-red-600 font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={submitAttendance} className="bg-white border rounded-xl p-5 space-y-3 shadow-sm">
            <h3 className="font-bold">Mark attendance</h3>
            <label className="block text-sm">
              Employee
              <select value={attForm.userId} onChange={(e) => setAttForm({ ...attForm, userId: +e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required>
                <option value={0}>— Select —</option>
                {employees.filter((e) => e.isActive).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Date
              <input type="date" value={attForm.workDate} onChange={(e) => setAttForm({ ...attForm, workDate: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Status
              <select value={attForm.status} onChange={(e) => setAttForm({ ...attForm, status: e.target.value as typeof attForm.status })} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="present">Present</option>
                <option value="remote">Remote</option>
                <option value="half_day">Half day</option>
                <option value="absent">Absent</option>
                <option value="holiday">Holiday</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input value={attForm.checkIn} onChange={(e) => setAttForm({ ...attForm, checkIn: e.target.value })} placeholder="Check in" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={attForm.checkOut} onChange={(e) => setAttForm({ ...attForm, checkOut: e.target.value })} placeholder="Check out" className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
              Save attendance
            </button>
          </form>
          <div className="bg-white border rounded-xl overflow-hidden max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">{new Date(a.workDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{a.user.name}</td>
                    <td className="px-3 py-2 capitalize">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-auto">
          <form onSubmit={saveEmployee} className="bg-white rounded-xl p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-bold">{editId ? 'Edit employee' : 'New employee & login'}</h3>
            <label className="block text-sm font-medium">
              Full name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required />
            </label>
            <label className="block text-sm font-medium">
              Work email (login)
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" required />
            </label>
            <label className="block text-sm font-medium">
              {editId ? 'New password (leave blank to keep)' : 'Initial password'}
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" minLength={editId ? 0 : 6} />
            </label>
            <label className="block text-sm font-medium">
              Department
              <select
                value={form.departmentId}
                onChange={(e) => {
                  const deptId = +e.target.value;
                  const des = org?.departments.find((d) => d.id === deptId)?.designations[0]?.id ?? 0;
                  setForm({ ...form, departmentId: deptId, designationId: des, teamId: 0 });
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                required
              >
                {org?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Role (designation)
              <select
                value={form.designationId}
                onChange={(e) => setForm({ ...form, designationId: +e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                required
              >
                {deptDesignations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {isProduction && (
              <label className="block text-sm font-medium">
                Production team
                <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: +e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value={0}>— None —</option>
                  {org?.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-medium">
              Reports to
              <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: +e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value={0}>— None —</option>
                {org?.managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm font-medium">
              Date of joining
              <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Employment
                <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as typeof form.employmentType })} className="mt-1 w-full border rounded-lg px-2 py-1.5">
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                </select>
              </label>
              <label className="block text-sm">
                HR status
                <select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as typeof form.employmentStatus })} className="mt-1 w-full border rounded-lg px-2 py-1.5">
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium">
                {editId ? 'Save changes' : 'Create employee'}
              </button>
            </div>
          </form>
        </div>
      )}

      {credModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-emerald-800">Login credentials created</h3>
            <p className="text-sm">
              Email: <code className="font-mono bg-slate-100 px-1">{credModal.email}</code>
            </p>
            <p className="text-sm">
              Password: <code className="font-mono bg-slate-100 px-1">{credModal.password}</code>
            </p>
            <p className="text-xs text-slate-500">Share securely with the employee. They can sign in on the login page.</p>
            <button type="button" onClick={() => setCredModal(null)} className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm">
              Done
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
