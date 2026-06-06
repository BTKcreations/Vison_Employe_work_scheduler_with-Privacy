'use client';

import { LucideIcon } from 'lucide-react';

export function OwnerMetricCard({
  label,
  value,
  icon: Icon,
  accent = 'slate',
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'slate' | 'amber' | 'emerald' | 'rose' | 'indigo';
  hint?: string;
}) {
  const ACCENT: Record<string, { bg: string; text: string; ring: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  };
  const a = ACCENT[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`w-10 h-10 rounded-xl ${a.bg} ${a.text} flex items-center justify-center ring-1 ${a.ring}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-extrabold text-slate-900 leading-none">{value}</div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
