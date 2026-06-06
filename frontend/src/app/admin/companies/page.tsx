'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Company } from '@/types';
import {
  Briefcase, Plus, X, Pencil, Power, PowerOff, Loader2, CheckCircle2, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { CardSkeleton } from '@/components/SkeletonLoaders';

export default function CompaniesPage() {
  const { user, refreshCompanies, activeCompanyId, setActiveCompanyId } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string; type: string; is_default: boolean; company_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get<{ items: any[] }>('/business-units');
      setUnits(res.data.items || []);
    } catch {
      setUnits([]);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Company[]>('/companies/all');
      setCompanies(res.data || []);
    } catch {
      try {
        const fallback = await api.get<Company[]>('/companies');
        setCompanies(fallback.data || []);
      } catch {
        setCompanies([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    fetchUnits();
  }, [fetchCompanies, fetchUnits]);

  const isAdmin = user?.role === 'admin';
  const isPlatformOwner = user?.role === 'platform_owner';
  const canEdit = isAdmin || isPlatformOwner;

  const visibleCompanies = includeInactive
    ? companies
    : companies.filter((c) => c.is_active);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || '' });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: any = { name: form.name.trim() };
      if (form.description.trim()) payload.description = form.description.trim();
      if (editing) {
        await api.patch(`/companies/${editing.id}`, payload);
        setSuccess(`Updated "${payload.name}".`);
      } else {
        const res = await api.post<Company>('/companies', payload);
        setSuccess(`Created "${res.data.name}". A default HQ Business Unit was added.`);
      }
      setShowModal(false);
      await fetchCompanies();
      await refreshCompanies();
      fetchUnits();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Company) => {
    setBusyId(c.id);
    try {
      if (c.is_active) {
        await api.post(`/companies/${c.id}/deactivate`);
        setSuccess(`Deactivated "${c.name}".`);
      } else {
        await api.post(`/companies/${c.id}/activate`);
        setSuccess(`Activated "${c.name}".`);
      }
      await fetchCompanies();
      await refreshCompanies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const switchToCompany = (id: string) => {
    setActiveCompanyId(id);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Companies
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sub-organizations inside your tenant. Each company has its own Business Units and employee
            assignments. The first company you create becomes your default.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Company
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <X className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {isAdmin && !user?.primary_company_id && companies.length === 0 && (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Create your first company</h3>
            <p className="text-xs text-amber-800 mt-1">
              You have not pinned a default company yet. Once you create one, it will be auto-pinned
              to your account and used as the default scope across the admin panel.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {canEdit && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show inactive
          </label>
        )}
        <span className="text-xs text-slate-500">{visibleCompanies.length} company(ies)</span>
      </div>

      {visibleCompanies.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-2xl">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No companies yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            {canEdit
              ? 'Click "New Company" to create your first sub-organization.'
              : 'Your tenant admin has not created any companies yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCompanies.map((c) => {
            const companyUnits = units.filter((u) => u.company_id === c.id);
            const isActive = c.id === activeCompanyId;
            return (
              <div
                key={c.id}
                className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all ${
                  isActive ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                      {c.name}
                      {c.is_default && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Default
                        </span>
                      )}
                    </h3>
                    {c.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">{c.description}</p>
                    )}
                  </div>
                  {c.is_active ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  {companyUnits.length} business unit(s)
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {isActive ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        Current scope
                      </span>
                    ) : (
                      <button
                        onClick={() => switchToCompany(c.id)}
                        className="text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                      >
                        Switch to
                      </button>
                    )}
                    <Link
                      href={`/admin/settings/business-units?company_id=${c.id}`}
                      className="text-[10px] font-semibold text-slate-600 hover:bg-slate-100 px-2 py-1 rounded"
                    >
                      View units
                    </Link>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={busyId === c.id}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40"
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : c.is_active ? (
                          <PowerOff className="w-3.5 h-3.5" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editing ? `Edit ${editing.name}` : 'New Company'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Acme India, Acme USA"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Must be unique within your tenant.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                  placeholder="Optional summary of this sub-org."
                />
              </div>
              {!editing && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  A default HQ Business Unit will be created automatically under this company.
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
