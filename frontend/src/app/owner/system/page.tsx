'use client';

import { useEffect, useState } from 'react';
import ownerApi from '@/lib/ownerApi';
import { Activity, Database, Users, CheckCircle2 } from 'lucide-react';

export default function OwnerSystemHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      ownerApi.get('/platform/system-health'),
      ownerApi.get('/platform/metrics'),
    ])
      .then(([h, m]) => {
        setHealth(h.data);
        setMetrics(m.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="text-slate-500 text-sm">Checking system…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">System Health</h1>
        <p className="text-sm text-slate-500 mt-1">Platform connectivity and live counts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HealthCard
          icon={Database}
          title="MongoDB"
          status={health?.mongo === 'up' ? 'operational' : 'down'}
          detail={health?.mongo === 'up' ? 'Connected to primary' : 'Connection error'}
          accent={health?.mongo === 'up' ? 'emerald' : 'rose'}
        />
        <HealthCard
          icon={Users}
          title="Platform Owners"
          status="operational"
          detail={`${health?.owner_count ?? 0} configured`}
          accent="emerald"
        />
        <HealthCard
          icon={Activity}
          title="Background Jobs"
          status="operational"
          detail="Recurrence + auto-checkout running"
          accent="emerald"
        />
        <HealthCard
          icon={CheckCircle2}
          title="Tenants Onboarded"
          status="operational"
          detail={`${metrics?.tenants?.total ?? 0} total`}
          accent="indigo"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Last health check</h2>
        <p className="text-xs text-slate-500 font-mono">
          {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}
        </p>
      </div>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  title,
  status,
  detail,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: string;
  detail: string;
  accent: 'emerald' | 'rose' | 'indigo';
}) {
  const ACCENT: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${ACCENT[accent]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="text-[10px] font-bold uppercase text-slate-500">{status}</p>
        </div>
      </div>
      <p className="text-xs text-slate-600">{detail}</p>
    </div>
  );
}
