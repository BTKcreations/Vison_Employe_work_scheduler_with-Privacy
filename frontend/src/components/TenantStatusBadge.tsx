'use client';

import { TenantStatus } from '@/types';

const STYLES: Record<TenantStatus, { bg: string; text: string; dot: string; label: string }> = {
  trial: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Trial' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
  suspended: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Suspended' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-500', label: 'Cancelled' },
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const s = STYLES[status] || STYLES.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
