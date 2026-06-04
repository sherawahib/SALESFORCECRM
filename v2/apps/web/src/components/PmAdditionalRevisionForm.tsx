'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProductionCrew } from './PmRevisionForm';

/** Additional revision — PM picks department; head assigns junior. */
export function PmAdditionalRevisionForm({
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
  const [discipline, setDiscipline] = useState<'design' | 'development'>('design');

  useEffect(() => {
    if (!projectId) return;
    setCrewError('');
    api<ProductionCrew>(`/api/v1/projects/${projectId}/production-crew?anyDepartment=1`)
      .then((c) => {
        setCrew(c);
        setDiscipline('design');
      })
      .catch((e) => setCrewError(e instanceof Error ? e.message : 'Could not load crew'));
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    try {
      await api(`/api/v1/projects/${projectId}/open-additional-revision`, {
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
      setSubmitError(e instanceof Error ? e.message : 'Failed to open additional revision');
    }
  }

  if (!projectId) return <p className="text-sm text-slate-500">Select a project first.</p>;
  if (crewError) return <p className="text-sm text-red-600">{crewError}</p>;
  if (!crew) return <p className="text-sm text-slate-500">Loading departments…</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg bg-violet-50 border border-violet-300 px-4 py-3 text-sm text-violet-950">
        <strong>Additional revision:</strong> pick <strong>Design</strong> or <strong>Development</strong> — the department head
        assigns the junior in Production → Head queue.
      </div>

      <label className="block text-sm font-medium">
        What is the additional work?
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          required
          rows={2}
          className="mt-1 w-full border rounded-lg px-3 py-2"
        />
      </label>

      <label className="block text-sm font-medium">
        Department
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as 'design' | 'development')}
          className="mt-1 w-full border rounded-lg px-3 py-2"
        >
          <option value="design">Design → Design Head</option>
          <option value="development">Development → Dev Head</option>
        </select>
      </label>

      <label className="block text-sm font-medium">
        Instructions for head
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          required
          rows={2}
          className="mt-1 w-full border rounded-lg px-3 py-2"
        />
      </label>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button type="submit" className="w-full py-3 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700">
        Open additional revision → {discipline === 'design' ? 'Design' : 'Development'} Head
      </button>
    </form>
  );
}
