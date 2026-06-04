import { revisionCrewStatusLabel } from '@ops/shared';

const STYLES: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
  new: 'bg-slate-100 text-slate-700',
  paid: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-orange-100 text-orange-800',
  partial: 'bg-yellow-100 text-yellow-800',
  prospect: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-800',
  delivery: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-slate-200 text-slate-800',
  scheduled: 'bg-sky-100 text-sky-800',
  cancelled: 'bg-slate-200 text-slate-600',
  pending_assignment: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review_pending: 'bg-amber-100 text-amber-800',
  client_review: 'bg-indigo-100 text-indigo-800',
  open_revision: 'bg-rose-100 text-rose-800',
  incomplete: 'bg-orange-100 text-orange-900',
  missing_requirement: 'bg-red-100 text-red-800',
  successfully_done: 'bg-emerald-100 text-emerald-800',
  pending_head_assignment: 'bg-violet-100 text-violet-800',
  on_leave: 'bg-amber-100 text-amber-800',
  terminated: 'bg-red-100 text-red-800',
  present: 'bg-emerald-100 text-emerald-800',
  absent: 'bg-red-100 text-red-800',
  remote: 'bg-blue-100 text-blue-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  holiday: 'bg-slate-200 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] || 'bg-slate-100 text-slate-700';
  const label = revisionCrewStatusLabel(status);
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
