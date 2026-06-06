'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { BusinessUnit, BusinessUnitList } from '@/types';
import {
  Building2, Plus, X, Pencil, Power, PowerOff, Loader2, CheckCircle2, MapPin, Hash, Mail
} from 'lucide-react';
import { CardSkeleton } from '@/components/SkeletonLoaders';

const TYPE_OPTIONS: { value: 'hq' | 'branch' | 'department' | 'subsidiary'; label: string; description: string }[] = [
  { value: 'hq', label: 'Head Office', description: 'Primary / default unit for the tenant.' },
  { value: 'branch', label: 'Branch', description: 'A physical or regional branch.' },
  { value: 'department', label: 'Department', description: 'An internal team or function.' },
  { value: 'subsidiary', label: 'Subsidiary', description: 'A separate legal entity under the tenant.' },
];

const TYPE_BADGE: Record<string, string> = {
  hq: 'bg-amber-100 text-amber-800',
  branch: 'bg-sky-100 text-sky-800',
  department: 'bg-violet-100 text-violet-800',
  subsidiary: 'bg-emerald-100 text-emerald-800',
};

export default function BusinessUnitsSettingsPage() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'department' as 'hq' | 'branch' | 'department' | 'subsidiary',
    code: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    contact_email: '',
    contact_phone: '',
    is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get<BusinessUnitList>('/business-units', {
        params: includeInactive ? { include_inactive: true } : undefined,
      });
      setUnits(res.data.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load business units.');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', type: 'department', code: '', description: '',
      address: '', city: '', state: '', country: '',
      timezone: 'Asia/Kolkata', currency: 'INR',
      contact_email: '', contact_phone: '',
      is_default: false,
    });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const openEdit = (u: BusinessUnit) => {
    setEditing(u);
    setForm({
      name: u.name,
      type: u.type,
      code: u.code || '',
      description: u.description || '',
      address: u.address || '',
      city: u.city || '',
      state: u.state || '',
      country: u.country || '',
      timezone: u.timezone || 'Asia/Kolkata',
      currency: u.currency || 'INR',
      contact_email: u.contact_email || '',
      contact_phone: u.contact_phone || '',
      is_default: u.is_default,
    });
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
    setSuccess('');
    try {
      const payload: any = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === null) delete payload[k];
      });
      if (editing) {
        await api.patch(`/business-units/${editing.id}`, payload);
        setSuccess(`Updated "${form.name}".`);
      } else {
        await api.post('/business-units', payload);
        setSuccess(`Created "${form.name}".`);
      }
      setShowModal(false);
      await fetchUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: BusinessUnit) => {
    setBusyId(u.id);
    try {
      if (u.is_active) {
        await api.post(`/business-units/${u.id}/deactivate`);
        setSuccess(`Deactivated "${u.name}".`);
      } else {
        await api.post(`/business-units/${u.id}/activate`);
        setSuccess(`Activated "${u.name}".`);
      }
      await fetchUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-violet-600" />
            Business Units
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Branches, departments, and subsidiaries inside your tenant. Each can have its own work hours, location, and contact details.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Business Unit
        </button>
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

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show inactive units
        </label>
        <span className="text-xs text-slate-500">{units.length} unit(s)</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : units.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-2xl">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No business units yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click "New Business Unit" to add a branch, department, or subsidiary.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => (
            <div
              key={u.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                    {u.name}
                    {u.is_default && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Default
                      </span>
                    )}
                  </h3>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_BADGE[u.type] || 'bg-slate-100 text-slate-800'}`}
                  >
                    {u.type}
                  </span>
                </div>
                {u.is_active ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    Inactive
                  </span>
                )}
              </div>

              {u.description && (
                <p className="text-xs text-slate-600 line-clamp-2 mb-2">{u.description}</p>
              )}

              <div className="space-y-1 text-xs text-slate-500">
                {u.code && (
                  <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" />{u.code}</div>
                )}
                {(u.city || u.country) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {[u.city, u.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {u.contact_email && (
                  <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{u.contact_email}</div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {u.employee_count ?? 0} employee(s)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(u)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u.id || (u.is_default && u.is_active)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={u.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {busyId === u.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : u.is_active ? (
                      <PowerOff className="w-3.5 h-3.5" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              {u.is_default && u.is_active && (
                <div className="mt-1 text-[10px] text-slate-400 italic">
                  Default unit cannot be deactivated.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900">
                {editing ? `Edit ${editing.name}` : 'New Business Unit'}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. HQ, BLR-01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {!editing && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Make this the default business unit
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
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
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50"
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
