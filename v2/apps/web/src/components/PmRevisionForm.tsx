'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type CrewMember = { id: number; name: string; designation: { name: string } };
export type ProductionCrew = {
  projectCategory: string;
  allowedDisciplines: ('design' | 'development')[];
  assignedDesignerId?: number | null;
  assignedDeveloperId?: number | null;
  designers: CrewMember[];
  developers: CrewMember[];
};

export function PmRevisionForm({
  projectId,
  onSuccess,
}: {
  projectId: number;
  onSuccess?: () => void;
}) {
  const [crew, setCrew] = useState<ProductionCrew | null>(null);
  const [crewError, setCrewError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [instructions, setInstructions] = useState('');
  const [discipline, setDiscipline] = useState<'design' | 'development'>('development');

  useEffect(() => {
    if (!projectId) return;
    setCrewError('');
    api<ProductionCrew>(`/api/v1/projects/${projectId}/production-crew`)
      .then((c) => {
        setCrew(c);
        setDiscipline(c.allowedDisciplines[0] ?? 'development');
      })
      .catch((e) => setCrewError(e instanceof Error ? e.message : 'Could not load departments'));
  }, [projectId]);

  const showDeptPicker = (crew?.allowedDisciplines.length ?? 0) > 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    try {
      await api(`/api/v1/projects/${projectId}/open-revision`, {
        method: 'POST',
        body: JSON.stringify({
          clientFeedback: feedback,
          discipline,
          instructions,
        }),
      });
      setFeedback('');
      setInstructions('');
      onSuccess?.();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to open revision');
    }
  }

  if (!projectId) {
    return <p className="text-sm text-slate-500">Select a project first.</p>;
  }

  if (crewError) {
    return <p className="text-sm text-red-600">{crewError}</p>;
  }

  if (!crew) {
    return <p className="text-sm text-slate-500">Loading departments…</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        <strong>Project Manager:</strong> choose the <strong>department</strong> (design or development). The{' '}
        <strong>{discipline === 'design' ? 'Design' : 'Development'} Head</strong> will assign a junior from Production →
        Head queue.
      </div>

      <label className="block text-sm font-medium">
        Client feedback (what changed?)
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          required
          rows={3}
          className="mt-1 w-full border rounded-lg px-3 py-2"
          placeholder="Client asked to update logo colors…"
        />
      </label>

      <label className="block text-sm font-medium">
        Department
        {showDeptPicker ? (
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as 'design' | 'development')}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          >
            <option value="design">Design department → Design Head</option>
            <option value="development">Development department → Dev Head</option>
          </select>
        ) : (
          <p className="mt-1 capitalize text-slate-700 font-normal">
            {discipline} only (project type: {crew.projectCategory})
          </p>
        )}
      </label>

      <label className="block text-sm font-medium">
        Instructions for production head
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          required
          rows={2}
          className="mt-1 w-full border rounded-lg px-3 py-2"
          placeholder="Deliver updated mockups by Friday…"
        />
      </label>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button type="submit" className="w-full py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">
        Open revision → route to {discipline === 'design' ? 'Design' : 'Development'} Head
      </button>
    </form>
  );
}
