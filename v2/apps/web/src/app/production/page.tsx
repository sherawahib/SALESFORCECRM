'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { api, can, loadUser } from '@/lib/api';
import { PERMISSIONS, REVISION_CREW_STATUS_OPTIONS } from '@ops/shared';

type Project = {
  id: number;
  projectCode: string;
  title: string;
  status: string;
  projectCategory?: string;
  client: { contactName: string };
  team?: { name: string; slug: string };
};
type ProjectDetail = Project & {
  assignedDesigner?: { id: number; name: string } | null;
  assignedDeveloper?: { id: number; name: string } | null;
  assignments: { id: number; instructions: string; status: string; assigneeId: number }[];
  revisions: {
    id: number;
    revisionNumber: number;
    status: string;
    productionDiscipline?: string | null;
    openedReason?: string;
    assignee?: { name: string };
  }[];
  sellerBrief?: string;
};
type Task = { id: number; instructions: string; status: string; project: Project };
type Member = { id: number; name: string; designation: { slug: string; name: string }; team?: { slug: string } };
type HeadQueueItem = {
  id: number;
  revisionNumber: number;
  productionDiscipline?: string;
  openedReason?: string;
  project: {
    id: number;
    projectCode: string;
    title: string;
    projectCategory?: string;
    client: { contactName: string };
    assignedDesigner?: { id: number; name: string } | null;
    assignedDeveloper?: { id: number; name: string } | null;
  };
};
type CrewList = {
  designers: Member[];
  developers: Member[];
  allowedDisciplines: ('design' | 'development')[];
  assignedDesignerId?: number | null;
  assignedDeveloperId?: number | null;
};
type MyRevision = {
  id: number;
  revisionNumber: number;
  status: string;
  productionDiscipline?: string | null;
  openedReason?: string | null;
  developerNotes?: string | null;
  resolutionNote?: string | null;
  project: {
    id: number;
    projectCode: string;
    title: string;
    client: { contactName: string };
  };
};

const JUNIOR_EDITABLE = ['assigned', 'incomplete', 'missing_requirement'];

export default function ProductionPage() {
  const [tab, setTab] = useState('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [headQueue, setHeadQueue] = useState<HeadQueueItem[]>([]);
  const [selected, setSelected] = useState<ProjectDetail | null>(null);
  const [projectCrew, setProjectCrew] = useState<CrewList | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignForm, setAssignForm] = useState({ assigneeId: 0, instructions: '', dueDate: '' });
  const [headAssignForm, setHeadAssignForm] = useState({ assigneeId: 0, instructions: '' });
  const [defaultCrewForm, setDefaultCrewForm] = useState({ designId: 0, devId: 0 });
  const [activeHeadRev, setActiveHeadRev] = useState<HeadQueueItem | null>(null);
  const [headCrew, setHeadCrew] = useState<CrewList | null>(null);
  const [headCrewError, setHeadCrewError] = useState('');
  const [headAssignError, setHeadAssignError] = useState('');
  const [headAssignSaving, setHeadAssignSaving] = useState(false);
  const [submitNotes, setSubmitNotes] = useState('');
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const [myRevisions, setMyRevisions] = useState<MyRevision[]>([]);
  const [revForms, setRevForms] = useState<Record<number, { status: string; notes: string }>>({});
  const [revSaveError, setRevSaveError] = useState('');
  const [revSavingId, setRevSavingId] = useState(0);
  const user = loadUser();
  const canAssign = can(user?.permissions, PERMISSIONS.PROD_PROJECTS_ASSIGN) || can(user?.permissions, PERMISSIONS.SUPER_ALL);
  const canHead = can(user?.permissions, PERMISSIONS.PROD_REVISIONS_MANAGE) || can(user?.permissions, PERMISSIONS.SUPER_ALL);
  const canSubmit = can(user?.permissions, PERMISSIONS.PROD_TASKS_SUBMIT);
  const slug = user?.designation?.slug;
  const isDesignHead = slug === 'design_head' || slug === 'super_admin' || slug === 'production_manager';
  const isDevHead = slug === 'dev_head' || slug === 'super_admin' || slug === 'production_manager';
  const isDeptHeadOnly = slug === 'design_head' || slug === 'dev_head';
  const canInitialDelivery = slug === 'production_manager' || slug === 'super_admin';
  const isJunior = slug === 'junior_designer' || slug === 'junior_developer';

  const reload = useCallback(() => {
    api<Project[]>('/api/v1/production/projects').then(setProjects);
    api<Task[]>('/api/v1/production/tasks').then(setTasks);
    if (canHead) api<HeadQueueItem[]>('/api/v1/production/head-queue').then(setHeadQueue);
    if (isJunior || canSubmit) {
      api<MyRevision[]>('/api/v1/production/my-revisions').then((list) => {
        setMyRevisions(list);
        setRevForms((prev) => {
          const next = { ...prev };
          for (const r of list) {
            if (!next[r.id]) {
              const defaultStatus =
                r.status === 'assigned' || r.status === 'incomplete'
                  ? 'incomplete'
                  : r.status === 'missing_requirement'
                    ? 'missing_requirement'
                    : 'incomplete';
              next[r.id] = {
                status: JUNIOR_EDITABLE.includes(r.status) ? defaultStatus : 'incomplete',
                notes: r.resolutionNote || r.developerNotes || '',
              };
            }
          }
          return next;
        });
      });
    }
  }, [canHead, isJunior, canSubmit]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'head-queue' && canHead) setTab('head-queue');
    if (t === 'my-revisions' && (isJunior || canSubmit)) setTab('my-revisions');
  }, [canHead, isJunior, canSubmit]);

  useEffect(() => {
    reload();
    if (canAssign || canHead) api<Member[]>('/api/v1/production/members').then(setMembers).catch(console.error);
  }, [canAssign, canHead, reload]);

  async function selectHeadRevision(r: HeadQueueItem) {
    setActiveHeadRev(r);
    setHeadAssignError('');
    setHeadCrew(null);
    const disc = r.productionDiscipline as 'design' | 'development' | undefined;
    const anyDept = r.openedReason?.includes('[Additional revision') ? '1' : '';
    try {
      const crew = await api<CrewList>(
        `/api/v1/production/projects/${r.project.id}/crew${anyDept ? '?anyDepartment=1' : ''}`
      );
      setHeadCrew(crew);
      const defaultId =
        disc === 'design'
          ? r.project.assignedDesigner?.id ?? crew.assignedDesignerId ?? 0
          : r.project.assignedDeveloper?.id ?? crew.assignedDeveloperId ?? 0;
      setHeadAssignForm({
        assigneeId: defaultId,
        instructions: r.openedReason?.split('[Instructions for production head]')[1]?.trim() || r.openedReason || '',
      });
    } catch (e) {
      setHeadCrewError(e instanceof Error ? e.message : 'Could not load juniors');
    }
  }

  async function openProject(id: number) {
    const p = await api<ProjectDetail>(`/api/v1/production/projects/${id}`);
    setSelected(p);
    const firstDelivery = p.status === 'pending_assignment';
    if (canHead && !isDeptHeadOnly && !firstDelivery) {
      const anyDept = p.projectCategory === 'combo' ? '?anyDepartment=1' : '';
      const crew = await api<CrewList>(`/api/v1/production/projects/${id}/crew${anyDept}`);
      setProjectCrew(crew);
      setDefaultCrewForm({
        designId: p.assignedDesigner?.id ?? 0,
        devId: p.assignedDeveloper?.id ?? 0,
      });
    } else {
      setProjectCrew(null);
    }
  }

  async function assignProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await api(`/api/v1/production/projects/${selected.id}/assign`, {
      method: 'POST',
      body: JSON.stringify(assignForm),
    });
    openProject(selected.id);
    reload();
  }

  async function headAssignRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!activeHeadRev) return;
    if (!headAssignForm.assigneeId) {
      setHeadAssignError('Select a junior designer or developer');
      return;
    }
    setHeadAssignSaving(true);
    setHeadAssignError('');
    try {
      await api(`/api/v1/production/revisions/${activeHeadRev.id}/head-assign`, {
        method: 'POST',
        body: JSON.stringify(headAssignForm),
      });
      setActiveHeadRev(null);
      setHeadCrew(null);
      setHeadAssignForm({ assigneeId: 0, instructions: '' });
      reload();
      if (selected) openProject(selected.id);
    } catch (err) {
      setHeadAssignError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setHeadAssignSaving(false);
    }
  }

  async function updateDefaultCrew(discipline: 'design' | 'development', assigneeId: number) {
    if (!selected || !assigneeId) return;
    try {
      await api(`/api/v1/production/projects/${selected.id}/default-crew`, {
        method: 'POST',
        body: JSON.stringify({ discipline, assigneeId }),
      });
      openProject(selected.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update crew');
    }
  }

  async function submitTask(taskId: number) {
    await api(`/api/v1/production/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ notes: submitNotes }),
    });
    setActiveTask(null);
    setSubmitNotes('');
    reload();
  }

  async function approveRevision(revId: number) {
    await api(`/api/v1/production/revisions/${revId}/approve`, { method: 'POST', body: '{}' });
    if (selected) openProject(selected.id);
    reload();
  }

  async function saveRevisionStatus(revisionId: number) {
    const form = revForms[revisionId];
    if (!form) return;
    setRevSavingId(revisionId);
    setRevSaveError('');
    try {
      await api(`/api/v1/production/revisions/${revisionId}/crew-status`, {
        method: 'POST',
        body: JSON.stringify({ status: form.status, notes: form.notes }),
      });
      reload();
    } catch (e) {
      setRevSaveError(e instanceof Error ? e.message : 'Failed to save status');
    } finally {
      setRevSavingId(0);
    }
  }

  const tabs = [{ id: 'projects', label: 'Projects' }];
  if (isJunior || canSubmit) {
    const activeCount = myRevisions.filter((r) => JUNIOR_EDITABLE.includes(r.status)).length;
    tabs.unshift({ id: 'my-revisions', label: `My revisions (${activeCount})` });
  }
  if (canHead) tabs.push({ id: 'head-queue', label: `Head queue (${headQueue.length})` });
  if (canSubmit) tabs.push({ id: 'tasks', label: `My tasks (${tasks.length})` });

  const juniorsForHeadRev = (disc?: string) => {
    if (headCrew) {
      return disc === 'design' ? headCrew.designers : headCrew.developers;
    }
    return members.filter((m) => {
      if (disc === 'design') return m.designation.slug === 'junior_designer';
      if (disc === 'development') return m.designation.slug === 'junior_developer';
      return m.designation.slug.includes('junior');
    });
  };

  return (
    <AppShell
      title="Production"
      subtitle={
        isJunior
          ? 'Update each revision: incomplete · missing requirement · successfully done'
          : isDeptHeadOnly
            ? 'Head queue: assign juniors when PM opens revisions · no first-time project assign'
            : 'Production Manager: initial delivery · Heads: revision crew · Juniors: tasks'
      }
    >
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'my-revisions' && (isJunior || canSubmit) && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            <strong>Designer / Developer:</strong> for every revision assigned to you, set the status below.
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li><strong>Incomplete revision</strong> — still in progress</li>
              <li><strong>Missing requirement</strong> — blocked; describe what is missing (PM & head are notified)</li>
              <li><strong>Successfully done</strong> — finished; sent to your head for review</li>
            </ul>
          </div>
          {revSaveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{revSaveError}</p>}
          {myRevisions.length === 0 && (
            <p className="text-sm text-slate-500 p-6 bg-white border rounded-lg">No revisions assigned yet.</p>
          )}
          {myRevisions.map((r) => {
            const editable = JUNIOR_EDITABLE.includes(r.status);
            const form = revForms[r.id] || { status: 'incomplete', notes: '' };
            return (
              <div key={r.id} className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap justify-between gap-2 items-start">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{r.project.projectCode} · v{r.revisionNumber}</p>
                    <p className="font-semibold">{r.project.client.contactName}</p>
                    <p className="text-xs capitalize text-slate-500">{r.productionDiscipline} revision</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4">{r.openedReason}</p>
                {editable ? (
                  <>
                    <label className="block text-sm font-medium">
                      Revision status
                      <select
                        value={form.status}
                        onChange={(e) =>
                          setRevForms({ ...revForms, [r.id]: { ...form, status: e.target.value } })
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                      >
                        {REVISION_CREW_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">
                      Notes {form.status === 'missing_requirement' && <span className="text-red-600">(required)</span>}
                      <textarea
                        value={form.notes}
                        onChange={(e) =>
                          setRevForms({ ...revForms, [r.id]: { ...form, notes: e.target.value } })
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                        rows={2}
                        placeholder={
                          form.status === 'missing_requirement'
                            ? 'What requirement or asset is missing from the client/PM?'
                            : 'Progress notes (optional)'
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={revSavingId === r.id}
                      onClick={() => saveRevisionStatus(r.id)}
                      className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {revSavingId === r.id ? 'Saving…' : 'Save revision status'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 border-t pt-3">
                    {r.status === 'review_pending'
                      ? 'Submitted — waiting for head approval.'
                      : r.status === 'client_review'
                        ? 'Approved by head — with Project Manager / client.'
                        : 'This revision is closed for updates.'}
                    {(r.resolutionNote || r.developerNotes) && (
                      <span className="block mt-1 text-slate-600">{r.resolutionNote || r.developerNotes}</span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'head-queue' && canHead && (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
            <strong>Design / Dev Head:</strong> PM opened a revision for your department. Select it below, pick a{' '}
            <strong>junior designer or developer</strong>, then Assign.
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg divide-y max-h-[520px] overflow-auto">
              {headQueue.length === 0 && (
                <p className="p-6 text-sm text-slate-500">
                  No revisions waiting. When a PM opens a revision, it appears here for the matching head.
                </p>
              )}
              {headQueue.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectHeadRevision(r)}
                  className={`w-full text-left p-4 hover:bg-brand-50 ${activeHeadRev?.id === r.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}
                >
                  <p className="font-mono text-xs">{r.project.projectCode} · v{r.revisionNumber}</p>
                  <p className="font-medium">{r.project.client.contactName}</p>
                  <p className="font-medium capitalize text-brand-800">{r.productionDiscipline} revision</p>
                  <p className="text-sm text-slate-600 line-clamp-2">{r.openedReason}</p>
                </button>
              ))}
            </div>
            <div className="bg-white border rounded-lg p-5">
              {activeHeadRev ? (
                <form onSubmit={headAssignRevision} className="space-y-3">
                  <h3 className="font-bold">
                    Assign junior {activeHeadRev.productionDiscipline} — {activeHeadRev.project.client.contactName}
                  </h3>
                  <p className="text-xs text-slate-500">{activeHeadRev.project.projectCode}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{activeHeadRev.openedReason}</p>
                  {headCrewError && <p className="text-sm text-red-600">{headCrewError}</p>}
                  {!headCrew && !headCrewError && <p className="text-sm text-slate-500">Loading juniors…</p>}
                  <label className="block text-sm font-medium">
                    Junior {activeHeadRev.productionDiscipline === 'design' ? 'designer' : 'developer'}
                    <select
                      value={headAssignForm.assigneeId}
                      onChange={(e) => setHeadAssignForm({ ...headAssignForm, assigneeId: +e.target.value })}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      required
                      disabled={!headCrew}
                    >
                      <option value={0}>— Select person —</option>
                      {juniorsForHeadRev(activeHeadRev.productionDiscipline).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.designation.name})
                        </option>
                      ))}
                    </select>
                    {headCrew && juniorsForHeadRev(activeHeadRev.productionDiscipline).length === 0 && (
                      <p className="text-xs text-red-600 mt-1">No juniors found. Check seed users or department filter.</p>
                    )}
                  </label>
                  <label className="block text-sm font-medium">
                    Instructions for junior
                    <textarea
                      value={headAssignForm.instructions}
                      onChange={(e) => setHeadAssignForm({ ...headAssignForm, instructions: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={3}
                    />
                  </label>
                  {headAssignError && <p className="text-sm text-red-600">{headAssignError}</p>}
                  <button
                    type="submit"
                    disabled={headAssignSaving || !headAssignForm.assigneeId}
                    className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {headAssignSaving ? 'Assigning…' : 'Assign junior & start work'}
                  </button>
                </form>
              ) : (
                <p className="text-slate-400 text-sm text-center mt-16">Select a revision from the queue.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} onClick={() => openProject(p.id)} className="border-t cursor-pointer hover:bg-brand-50">
                    <td className="px-4 py-2 font-mono text-xs">{p.projectCode}</td>
                    <td className="px-4 py-2">{p.client.contactName}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg border p-5 shadow-sm min-h-[320px]">
            {!selected ? (
              <p className="text-slate-400 text-sm text-center mt-16">Select a project.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500">{selected.projectCode}</p>
                  <h2 className="font-bold text-lg">{selected.title}</h2>
                  <StatusBadge status={selected.status} />
                </div>

                {isDeptHeadOnly && selected.status === 'pending_assignment' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <strong>First-time delivery:</strong> you do not assign juniors here. Production Manager sets up initial
                    delivery. When the PM opens a <strong>revision</strong>, use the <strong>Head queue</strong> tab to assign a
                    junior designer or developer.
                  </div>
                )}

                {canHead && !isDeptHeadOnly && selected.status !== 'pending_assignment' && (
                  <div className="border rounded-lg p-3 bg-slate-50 space-y-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-slate-500">Default project crew (change anytime)</p>
                    {(isDesignHead || selected.projectCategory !== 'development') && projectCrew?.designers.length ? (
                      <label className="block">
                        Designer
                        <select
                          value={defaultCrewForm.designId}
                          onChange={(e) => {
                            const v = +e.target.value;
                            setDefaultCrewForm({ ...defaultCrewForm, designId: v });
                            if (v) updateDefaultCrew('design', v);
                          }}
                          className="mt-1 w-full border rounded-lg px-2 py-1.5"
                        >
                          <option value={0}>Not assigned</option>
                          {projectCrew.designers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {(isDevHead || selected.projectCategory !== 'design') && projectCrew?.developers.length ? (
                      <label className="block">
                        Developer
                        <select
                          value={defaultCrewForm.devId}
                          onChange={(e) => {
                            const v = +e.target.value;
                            setDefaultCrewForm({ ...defaultCrewForm, devId: v });
                            if (v) updateDefaultCrew('development', v);
                          }}
                          className="mt-1 w-full border rounded-lg px-2 py-1.5"
                        >
                          <option value={0}>Not assigned</option>
                          {projectCrew.developers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      Current: {selected.assignedDesigner?.name || '—'} (design) · {selected.assignedDeveloper?.name || '—'} (dev)
                    </p>
                  </div>
                )}

                {isDeptHeadOnly && selected.status === 'pending_assignment' && tab !== 'head-queue' && (
                  <p className="text-sm text-brand-700 font-medium border-t pt-4">
                    → Revisions from PM appear under <button type="button" className="underline" onClick={() => setTab('head-queue')}>Head queue</button>
                  </p>
                )}

                {canInitialDelivery && canAssign && selected.status === 'pending_assignment' && (
                  <form onSubmit={assignProject} className="border-t pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Initial delivery assign (Production Manager)</p>
                    <select
                      value={assignForm.assigneeId}
                      onChange={(e) => setAssignForm({ ...assignForm, assigneeId: +e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      required
                    >
                      <option value={0}>Select team member</option>
                      {members.filter((m) => m.designation.slug.includes('junior')).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.designation.name})
                        </option>
                      ))}
                    </select>
                    <textarea
                      placeholder="Instructions"
                      value={assignForm.instructions}
                      onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={3}
                      required
                    />
                    <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                      Assign initial work
                    </button>
                  </form>
                )}

                {selected.revisions?.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Revisions</p>
                    {selected.revisions.map((r) => (
                      <div key={r.id} className="flex justify-between items-center py-2 border-b text-sm">
                        <span>
                          v{r.revisionNumber} — <StatusBadge status={r.status} />
                          {r.assignee && <span className="text-slate-500 ml-2">→ {r.assignee.name}</span>}
                        </span>
                        {r.status === 'missing_requirement' && (
                          <span className="text-xs text-red-600 font-medium">Blocked — missing info</span>
                        )}
                        {r.status === 'review_pending' && canHead && (
                          <button type="button" onClick={() => approveRevision(r.id)} className="text-xs text-brand-600 font-medium">
                            Approve → PM
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <p className="font-mono text-xs text-slate-500">{t.project.projectCode}</p>
              <p className="font-medium">{t.project.title}</p>
              <p className="text-sm text-slate-600 mt-2">{t.instructions}</p>
              <StatusBadge status={t.status} />
              {activeTask === t.id ? (
                <div className="mt-3 space-y-2">
                  <textarea value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} placeholder="Delivery notes" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                  <button type="button" onClick={() => submitTask(t.id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
                    Submit for head review
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setActiveTask(t.id)} className="mt-3 text-sm text-brand-600 font-medium">
                  Submit work
                </button>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-slate-500">No active assignments.</p>}
        </div>
      )}
    </AppShell>
  );
}
