'use client';

import { SubscriptionPlan } from '@/types';

const TIER_STYLES: Record<string, string> = {
  trial: 'bg-slate-100 text-slate-700 border-slate-200',
  starter: 'bg-sky-50 text-sky-700 border-sky-200',
  pro: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function PlanBadge({ plan }: { plan: SubscriptionPlan | null | undefined }) {
  if (!plan) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        No plan
      </span>
    );
  }
  const style = TIER_STYLES[plan.code] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      {plan.name}
    </span>
  );
}

export function PlanCodeBadge({ code }: { code: string | null | undefined }) {
  if (!code) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const style = TIER_STYLES[code] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      {code}
    </span>
  );
}
