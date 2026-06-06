'use client';

import { useEffect, useState } from 'react';
import ownerApi from '@/lib/ownerApi';
import { PlatformAuditEntry } from '@/types';
import { ScrollText, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function OwnerAuditPage() {
  const [items, setItems] = useState<PlatformAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const limit = 50;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const r = await ownerApi.get<{ items: PlatformAuditEntry[]; total: number }>(
          `/platform/audit-log?limit=${limit}&skip=${skip}`
        );
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [skip]);

  const filtered = actionFilter
    ? items.filter((e) => e.action.includes(actionFilter))
    : items;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Platform Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">
          {total} total events. Every platform owner action is recorded here.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. tenant.onboarded, tenant.status.suspended)…"
          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">No audit events match.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-5 py-3">
                  Timestamp
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-5 py-3">
                  Action
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-5 py-3">
                  Description
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-5 py-3">
                  Actor
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-5 py-3">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700 max-w-md truncate">
                    {e.description || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    <div>{e.actor_name || '—'}</div>
                    <div className="text-[10px] text-slate-400">{e.actor_email || ''}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                    {e.ip_address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setSkip(Math.max(0, skip - limit))}
          disabled={skip === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs text-slate-500">
          Showing {skip + 1}–{Math.min(skip + limit, total)} of {total}
        </span>
        <button
          onClick={() => setSkip(skip + limit)}
          disabled={skip + limit >= total}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
